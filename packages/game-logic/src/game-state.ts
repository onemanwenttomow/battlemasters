import { GameState, GameAction, Faction, coordToKey, edgeKey, HexCoord, CannonFireState, CannonTileResult, TowerState, PlaceableTerrainType, UnitType } from './types.js';
import { createDefaultBoard, createBareBoard } from './board.js';
import { createUnit, getDefaultImperialArmy, getDefaultChaosArmy, resetUnitIdCounter, getUnitDefinition } from './units.js';
import { createBattleDeck, shuffleDeck, createRNG, createOgreSubDeck, createCannonTileDeck } from './cards.js';
import { resolveCombat, resolveCombatWithRolls } from './combat.js';
import { getTile, getDitchAttackModifier, getDitchDefenseModifier } from './board.js';
import { validateAction } from './validation.js';
import { hexDistance, getShortestPaths } from './hex.js';
import { getScenarioById } from './scenarios.js';

// ─── State Creation ────────────────────────────────────────────

/** Create a new game state ready for setup */
export function createInitialState(seed?: number): GameState {
  const gameSeed = seed ?? Math.floor(Math.random() * 2147483647);
  resetUnitIdCounter();

  return {
    board: createDefaultBoard(),
    units: new Map(),
    currentPhase: 'setup',
    activeFaction: 'chaos',
    battleDeck: [],
    discardPile: [],
    currentCard: null,
    combatLog: [],
    turnNumber: 0,
    winner: null,
    selectedUnitId: null,
    activatedUnitIds: [],
    seed: gameSeed,
    ogreSubDeck: [],
    ogreSubCardIndex: 0,
    ogreSubCardsTotal: 0,
    currentOgreSubCard: null,
    cannonFireState: null,
    towerState: { rubbleCount: 0, destroyed: false },
  };
}

// ─── Tower Helpers ──────────────────────────────────────────────

/** The tower hex coordinate */
const TOWER_COORD: HexCoord = { col: 5, row: 2 };

/** Destroy the tower: set destroyed flag and change terrain to plain */
function destroyTower(state: GameState): void {
  state.towerState.destroyed = true;
  // Clone tiles map and change tower terrain to plain
  const newTiles = new Map(state.board.tiles);
  const towerKey = coordToKey(TOWER_COORD);
  const towerTile = newTiles.get(towerKey);
  if (towerTile) {
    newTiles.set(towerKey, { ...towerTile, terrain: 'plain' });
  }
  state.board = { ...state.board, tiles: newTiles };
}

/** Add rubble to the tower if the coord is the tower hex. Returns { rubbleAdded, towerDestroyed } */
function addTowerRubble(state: GameState, coord: HexCoord): { rubbleAdded: boolean; towerDestroyed: boolean } {
  if (state.towerState.destroyed) return { rubbleAdded: false, towerDestroyed: false };
  if (coordToKey(coord) !== coordToKey(TOWER_COORD)) return { rubbleAdded: false, towerDestroyed: false };

  state.towerState = { ...state.towerState, rubbleCount: state.towerState.rubbleCount + 1 };
  if (state.towerState.rubbleCount >= 3) {
    destroyTower(state);
    return { rubbleAdded: true, towerDestroyed: true };
  }
  return { rubbleAdded: true, towerDestroyed: false };
}

// ─── State Machine ─────────────────────────────────────────────

/** Apply an action to the game state. Returns new state (immutable-style). */
export function applyAction(state: GameState, action: GameAction): GameState {
  const validation = validateAction(state, action);
  if (!validation.valid) {
    return state;
  }

  switch (action.type) {
    case 'START_GAME':
      return handleStartGame(state, action.scenarioId);
    case 'START_STANDARD_GAME':
      return handleStartStandardGame(state, action.terrainPlacer);
    case 'PLACE_TERRAIN':
      return handlePlaceTerrain(state, action.terrainType, action.position, action.orientation, action.fortifiedSides);
    case 'PLACE_HEDGE':
      return handlePlaceHedge(state, action.from, action.to);
    case 'REMOVE_TERRAIN':
      return handleRemoveTerrain(state, action.position);
    case 'REMOVE_HEDGE':
      return handleRemoveHedge(state, action.from, action.to);
    case 'FINISH_TERRAIN_PLACEMENT':
      return handleFinishTerrainPlacement(state);
    case 'SELECT_SIDE':
      return handleSelectSide(state, action.side);
    case 'PLACE_UNIT':
      return handlePlaceUnit(state, action.unitType, action.position);
    case 'AUTO_DEPLOY':
      return handleAutoDeploy(state);
    case 'DRAW_CARD':
      return handleDrawCard(state);
    case 'SELECT_UNIT':
      return handleSelectUnit(state, action.unitId);
    case 'MOVE_UNIT':
      return handleMoveUnit(state, action.unitId, action.to);
    case 'ATTACK':
      return handleAttack(state, action.attackerId, action.defenderId, action.attackerRolls, action.defenderRolls);
    case 'END_ACTIVATION':
      return handleEndActivation(state);
    case 'DRAW_OGRE_CARD':
      return handleDrawOgreCard(state);
    case 'END_OGRE_ACTIVATION':
      return handleEndOgreActivation(state);
    case 'FIRE_CANNON':
      return handleFireCannon(state, action.targetCoord);
    case 'SELECT_CANNON_PATH':
      return handleSelectCannonPath(state, action.path);
    case 'DRAW_CANNON_TILE':
      return handleDrawCannonTile(state);
    case 'END_CANNON_FIRE':
      return handleEndCannonFire(state);
    case 'PASS':
      return handlePass(state);
    default:
      return state;
  }
}

// ─── Action Handlers ───────────────────────────────────────────

function handleStartGame(state: GameState, scenarioId?: string): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed);

  const scenario = scenarioId ? getScenarioById(scenarioId) : undefined;

  // Place units
  const imperialArmy = scenario ? scenario.imperialArmy : getDefaultImperialArmy();
  const chaosArmy = scenario ? scenario.chaosArmy : getDefaultChaosArmy();

  for (const setup of [...imperialArmy.units, ...chaosArmy.units]) {
    const unit = createUnit(setup.type, setup.position);
    newState.units.set(unit.id, unit);
  }

  // Apply board terrain overrides for scenario
  if (scenario?.boardOverrides) {
    const overrides = scenario.boardOverrides;
    if (overrides.terrain) {
      const newTiles = new Map(newState.board.tiles);
      for (const override of overrides.terrain) {
        const key = coordToKey(override.coord);
        const existing = newTiles.get(key);
        if (existing) {
          newTiles.set(key, { ...existing, terrain: override.terrain, orientation: override.orientation, fortifiedSides: override.fortifiedSides });
        }
      }
      newState.board = { ...newState.board, tiles: newTiles };
    }
    if (overrides.hedges !== undefined) {
      const newHedges = new Set<string>();
      for (const [a, b] of overrides.hedges) {
        newHedges.add(edgeKey(a, b));
      }
      newState.board = { ...newState.board, hedges: newHedges };
    }
  }

  if (scenarioId) {
    newState.scenarioId = scenarioId;
  }

  // Check if scenario uses card-based deployment
  if (scenario?.cardDeployment && scenario.unplacedUnits && scenario.unplacedUnits.length > 0) {
    newState.cardDeployment = true;
    newState.allUnplacedUnits = scenario.unplacedUnits.map(u => ({ ...u }));
    newState.justDeployedUnitIds = [];
    if (scenario.cardDeploymentZones) {
      newState.cardDeploymentZones = {
        imperial: {
          rows: [...scenario.cardDeploymentZones.imperial.rows],
          cols: scenario.cardDeploymentZones.imperial.cols ? [...scenario.cardDeploymentZones.imperial.cols] : undefined,
        },
        chaos: {
          rows: [...scenario.cardDeploymentZones.chaos.rows],
          cols: scenario.cardDeploymentZones.chaos.cols ? [...scenario.cardDeploymentZones.chaos.cols] : undefined,
        },
      };
    }
    // Create and shuffle the battle deck immediately
    const deck = createBattleDeck();
    newState.battleDeck = shuffleDeck(deck, rng);
    newState.discardPile = [];
    newState.currentPhase = 'draw_card';
    newState.turnNumber = 1;
    return newState;
  }

  // Check if scenario uses hidden deployment (both factions place facedown)
  if (scenario?.hiddenDeployment && scenario.hiddenDeploymentZones && scenario.unplacedUnits && scenario.unplacedUnits.length > 0) {
    newState.hiddenDeployment = true;
    newState.hiddenDeploymentZones = {
      imperial: {
        rows: [...scenario.hiddenDeploymentZones.imperial.rows],
        cols: [...scenario.hiddenDeploymentZones.imperial.cols],
        additionalHexes: scenario.hiddenDeploymentZones.imperial.additionalHexes?.map(h => ({ ...h })),
      },
      chaos: {
        rows: [...scenario.hiddenDeploymentZones.chaos.rows],
        cols: [...scenario.hiddenDeploymentZones.chaos.cols],
        additionalHexes: scenario.hiddenDeploymentZones.chaos.additionalHexes?.map(h => ({ ...h })),
      },
    };
    newState.unplacedUnits = scenario.unplacedUnits.map(u => ({ ...u }));
    newState.deploymentTurn = 'chaos'; // Chaos places first
    newState.activeFaction = 'chaos';
    const chaosZone = newState.hiddenDeploymentZones.chaos;
    newState.deploymentZone = {
      faction: 'chaos',
      rows: chaosZone.rows,
      cols: chaosZone.cols,
      additionalHexes: chaosZone.additionalHexes,
    };
    newState.currentPhase = 'deployment';
    newState.turnNumber = 0;
    return newState;
  }

  // Check if scenario uses standard-game-style alternating deployment
  if (scenario?.deploymentSides && scenario.unplacedUnits && scenario.unplacedUnits.length > 0) {
    newState.standardGame = true;
    newState.deploymentSides = {
      imperial: [...scenario.deploymentSides.imperial],
      chaos: [...scenario.deploymentSides.chaos],
    };
    newState.unplacedUnits = scenario.unplacedUnits.map(u => ({ ...u }));
    newState.deploymentTurn = 'chaos';
    newState.activeFaction = 'chaos';
    newState.deploymentZone = { faction: 'chaos', rows: newState.deploymentSides.chaos };
    newState.currentPhase = 'deployment';
    newState.turnNumber = 0;
    return newState;
  }

  // Check if scenario has a deployment phase
  if (scenario?.deploymentZone && scenario.unplacedUnits && scenario.unplacedUnits.length > 0) {
    newState.deploymentZone = { ...scenario.deploymentZone };
    newState.unplacedUnits = scenario.unplacedUnits.map(u => ({ ...u }));
    newState.currentPhase = 'deployment';
    newState.turnNumber = 0;
    return newState;
  }

  // Create and shuffle the battle deck
  const deck = createBattleDeck();
  newState.battleDeck = shuffleDeck(deck, rng);
  newState.discardPile = [];

  newState.currentPhase = 'draw_card';
  newState.turnNumber = 1;

  return newState;
}

// ─── Standard Game Handlers ───────────────────────────────────

function handleStartStandardGame(state: GameState, terrainPlacer: Faction): GameState {
  const newState = cloneState(state);
  resetUnitIdCounter();

  newState.board = createBareBoard();
  newState.standardGame = true;
  newState.terrainPlacerFaction = terrainPlacer;
  newState.availableTerrain = { tower: 1, marsh: 2, ditch: 2, hedge: 4 };
  newState.currentPhase = 'terrain_placement';
  newState.activeFaction = terrainPlacer;

  return newState;
}

function handlePlaceTerrain(state: GameState, terrainType: PlaceableTerrainType, position: HexCoord, orientation?: number, fortifiedSides?: number): GameState {
  const newState = cloneState(state);

  const newTiles = new Map(newState.board.tiles);
  const key = coordToKey(position);
  const existing = newTiles.get(key);
  if (existing) {
    const updated = { ...existing, terrain: terrainType as import('./types.js').TerrainType };
    if (terrainType === 'ditch') {
      updated.orientation = orientation ?? 0;
      updated.fortifiedSides = fortifiedSides ?? 4;
    }
    newTiles.set(key, updated);
  }
  newState.board = { ...newState.board, tiles: newTiles };

  newState.availableTerrain = { ...newState.availableTerrain! };
  newState.availableTerrain[terrainType]--;

  return newState;
}

function handlePlaceHedge(state: GameState, from: HexCoord, to: HexCoord): GameState {
  const newState = cloneState(state);

  const newHedges = new Set(newState.board.hedges);
  newHedges.add(edgeKey(from, to));
  newState.board = { ...newState.board, hedges: newHedges };

  newState.availableTerrain = { ...newState.availableTerrain! };
  newState.availableTerrain.hedge--;

  return newState;
}

function handleRemoveTerrain(state: GameState, position: HexCoord): GameState {
  const newState = cloneState(state);

  const newTiles = new Map(newState.board.tiles);
  const key = coordToKey(position);
  const existing = newTiles.get(key);
  if (existing) {
    const removedType = existing.terrain as PlaceableTerrainType;
    newTiles.set(key, { ...existing, terrain: 'plain', orientation: undefined });
    newState.board = { ...newState.board, tiles: newTiles };

    newState.availableTerrain = { ...newState.availableTerrain! };
    newState.availableTerrain[removedType]++;
  }

  return newState;
}

function handleRemoveHedge(state: GameState, from: HexCoord, to: HexCoord): GameState {
  const newState = cloneState(state);

  const newHedges = new Set(newState.board.hedges);
  newHedges.delete(edgeKey(from, to));
  newState.board = { ...newState.board, hedges: newHedges };

  newState.availableTerrain = { ...newState.availableTerrain! };
  newState.availableTerrain.hedge++;

  return newState;
}

function handleFinishTerrainPlacement(state: GameState): GameState {
  const newState = cloneState(state);

  const opposite: Faction = newState.terrainPlacerFaction === 'imperial' ? 'chaos' : 'imperial';
  newState.sideSelectionFaction = opposite;
  newState.activeFaction = opposite;
  newState.currentPhase = 'side_selection';

  return newState;
}

function handleSelectSide(state: GameState, side: 'top' | 'bottom'): GameState {
  const newState = cloneState(state);

  const selectorFaction = newState.sideSelectionFaction!;
  const otherFaction: Faction = selectorFaction === 'imperial' ? 'chaos' : 'imperial';

  const topRows = [0, 1];
  const bottomRows = [10, 11];

  const selectorRows = side === 'top' ? topRows : bottomRows;
  const otherRows = side === 'top' ? bottomRows : topRows;

  newState.deploymentSides = {
    [selectorFaction]: selectorRows,
    [otherFaction]: otherRows,
  } as { imperial: number[]; chaos: number[] };

  // Build unplacedUnits for both factions (types only, no positions)
  const imperialTypes: UnitType[] = [
    'men_at_arms', 'men_at_arms', 'men_at_arms',
    'archer', 'archer',
    'crossbowman',
    'imperial_knights', 'imperial_knights', 'imperial_knights',
    'lord_knights',
    'mighty_cannon',
  ];
  const chaosTypes: UnitType[] = [
    'goblin', 'goblin',
    'beastman', 'beastman',
    'chaos_bowman', 'chaos_bowman',
    'orc', 'orc',
    'chaos_warrior', 'chaos_warrior',
    'wolf_rider', 'wolf_rider',
    'champions_of_chaos',
    'ogre_champion',
  ];

  newState.unplacedUnits = [
    ...imperialTypes.map(type => ({ type, faction: 'imperial' as Faction })),
    ...chaosTypes.map(type => ({ type, faction: 'chaos' as Faction })),
  ];

  // Chaos deploys first
  newState.deploymentTurn = 'chaos';
  const chaosRows = newState.deploymentSides.chaos;
  newState.deploymentZone = { faction: 'chaos', rows: chaosRows };
  newState.currentPhase = 'deployment';
  newState.activeFaction = 'chaos';

  return newState;
}

function handleAutoDeploy(state: GameState): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed + 9999);

  if (!newState.unplacedUnits || !newState.deploymentSides) return state;

  // Collect available hexes per faction
  const occupied = new Set<string>();
  for (const [, unit] of newState.units) {
    occupied.add(coordToKey(unit.position));
  }

  const getAvailableHexes = (rows: number[]): HexCoord[] => {
    const hexes: HexCoord[] = [];
    for (const [key, tile] of newState.board.tiles) {
      if (rows.includes(tile.coord.row) &&
          tile.terrain !== 'river' && tile.terrain !== 'marsh' &&
          !occupied.has(key)) {
        hexes.push(tile.coord);
      }
    }
    return hexes;
  };

  // Shuffle helper
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const imperialHexes = shuffle(getAvailableHexes(newState.deploymentSides.imperial));
  const chaosHexes = shuffle(getAvailableHexes(newState.deploymentSides.chaos));

  // Separate units by faction and shuffle
  const imperialUnits = shuffle(newState.unplacedUnits.filter(u => u.faction === 'imperial'));
  const chaosUnits = shuffle(newState.unplacedUnits.filter(u => u.faction === 'chaos'));

  // Place imperial units
  let impIdx = 0;
  for (const entry of imperialUnits) {
    if (impIdx >= imperialHexes.length) break;
    // Skip tower for no_tower units
    const def = getUnitDefinition(entry.type);
    let pos = imperialHexes[impIdx];
    const tile = newState.board.tiles.get(coordToKey(pos));
    if (tile?.terrain === 'tower' && def.special?.includes('no_tower')) {
      // Find next non-tower hex
      let found = false;
      for (let j = impIdx + 1; j < imperialHexes.length; j++) {
        const t = newState.board.tiles.get(coordToKey(imperialHexes[j]));
        if (t?.terrain !== 'tower') {
          [imperialHexes[impIdx], imperialHexes[j]] = [imperialHexes[j], imperialHexes[impIdx]];
          pos = imperialHexes[impIdx];
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    const unit = createUnit(entry.type, pos);
    newState.units.set(unit.id, unit);
    impIdx++;
  }

  // Place chaos units
  let chaosIdx = 0;
  for (const entry of chaosUnits) {
    if (chaosIdx >= chaosHexes.length) break;
    const def = getUnitDefinition(entry.type);
    let pos = chaosHexes[chaosIdx];
    const tile = newState.board.tiles.get(coordToKey(pos));
    if (tile?.terrain === 'tower' && def.special?.includes('no_tower')) {
      let found = false;
      for (let j = chaosIdx + 1; j < chaosHexes.length; j++) {
        const t = newState.board.tiles.get(coordToKey(chaosHexes[j]));
        if (t?.terrain !== 'tower') {
          [chaosHexes[chaosIdx], chaosHexes[j]] = [chaosHexes[j], chaosHexes[chaosIdx]];
          pos = chaosHexes[chaosIdx];
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    const unit = createUnit(entry.type, pos);
    newState.units.set(unit.id, unit);
    chaosIdx++;
  }

  // All units placed — transition to draw_card
  const deckRng = createRNG(state.seed);
  const deck = createBattleDeck();
  newState.battleDeck = shuffleDeck(deck, deckRng);
  newState.discardPile = [];
  newState.currentPhase = 'draw_card';
  newState.turnNumber = 1;
  newState.deploymentZone = undefined;
  newState.unplacedUnits = undefined;
  newState.deploymentTurn = undefined;

  return newState;
}

function handlePlaceUnit(state: GameState, unitType: import('./types.js').UnitType, position: HexCoord): GameState {
  const newState = cloneState(state);

  // Create the unit at the position
  const unit = createUnit(unitType, position);
  if (newState.hiddenDeployment) {
    unit.hidden = true;
  }
  newState.units.set(unit.id, unit);

  // Track just-deployed units in card deployment mode
  if (newState.cardDeployment) {
    newState.justDeployedUnitIds = [...(newState.justDeployedUnitIds || []), unit.id];
  }

  // Remove the first matching entry from unplacedUnits
  const idx = newState.unplacedUnits!.findIndex(u => u.type === unitType);
  newState.unplacedUnits = [...newState.unplacedUnits!];
  newState.unplacedUnits.splice(idx, 1);

  // Card deployment mode: when all card units placed, decide next phase
  if (newState.cardDeployment && newState.unplacedUnits.length === 0) {
    newState.deploymentZone = undefined;
    newState.unplacedUnits = undefined;

    const card = newState.currentCard!;

    // Check if any units of the card's types were already on board (not just-deployed)
    const justDeployed = new Set(newState.justDeployedUnitIds || []);
    let hasPreExistingUnits = false;

    if (card.special === 'ALL_MOVE') {
      // ALL_MOVE: any unit of this faction that was already on board can activate
      for (const [id, u] of newState.units) {
        if (u.faction === card.faction && !justDeployed.has(id)) {
          hasPreExistingUnits = true;
          break;
        }
      }
    } else {
      for (const [id, u] of newState.units) {
        if (u.faction === card.faction &&
            card.unitTypes.includes(u.definitionType) &&
            !justDeployed.has(id)) {
          hasPreExistingUnits = true;
          break;
        }
      }
    }

    if (hasPreExistingUnits) {
      // Enter activation/special phase for pre-existing units
      if (card.special === 'OGRE_RAMPAGE') {
        let ogre: import('./types.js').Unit | null = null;
        for (const [id, u] of newState.units) {
          if (u.definitionType === 'ogre_champion' && !justDeployed.has(id)) {
            ogre = u;
            break;
          }
        }
        if (ogre && ogre.hp > 0) {
          const ogreSubCardsTotal = ogre.hp;
          const subDeckRng = createRNG(state.seed + state.turnNumber + 7777);
          newState.ogreSubDeck = createOgreSubDeck(subDeckRng);
          newState.ogreSubCardIndex = 0;
          newState.ogreSubCardsTotal = ogreSubCardsTotal;
          newState.currentOgreSubCard = null;
          newState.selectedUnitId = ogre.id;
          newState.currentPhase = 'ogre_rampage';
          return newState;
        }
      } else if (card.special === 'CANNON_FIRE') {
        let cannon: import('./types.js').Unit | null = null;
        for (const [id, u] of newState.units) {
          if (u.definitionType === 'mighty_cannon' && !justDeployed.has(id)) {
            cannon = u;
            break;
          }
        }
        if (cannon && cannon.hp > 0) {
          newState.selectedUnitId = cannon.id;
          newState.cannonFireState = null;
          newState.currentPhase = 'cannon_fire';
          return newState;
        }
      } else {
        newState.currentPhase = 'activation';
        return newState;
      }
    }

    // No pre-existing units (or special unit not found) — end turn
    if (newState.currentCard) {
      newState.discardPile.push(newState.currentCard);
      newState.currentCard = null;
    }
    newState.selectedUnitId = null;
    newState.turnNumber++;
    newState.currentPhase = 'draw_card';
    return newState;
  }

  // Non-card-deployment: if all units placed, transition to draw_card
  if (!newState.cardDeployment && newState.unplacedUnits && newState.unplacedUnits.length === 0) {
    // Hidden deployment: reveal all hidden units
    if (newState.hiddenDeployment) {
      const newUnits = new Map(newState.units);
      for (const [id, u] of newUnits) {
        if (u.hidden) {
          newUnits.set(id, { ...u, hidden: false });
        }
      }
      newState.units = newUnits;
      newState.hiddenDeployment = false;
      newState.hiddenDeploymentZones = undefined;
    }
    const rng = createRNG(state.seed);
    const deck = createBattleDeck();
    newState.battleDeck = shuffleDeck(deck, rng);
    newState.discardPile = [];
    newState.currentPhase = 'draw_card';
    newState.turnNumber = 1;
    newState.deploymentZone = undefined;
    newState.unplacedUnits = undefined;
    newState.deploymentTurn = undefined;
    // Keep deploymentSides for facing direction reference during gameplay
  } else if (newState.hiddenDeployment && newState.deploymentTurn && newState.hiddenDeploymentZones) {
    // Hidden deployment: alternate turns between factions
    const otherFaction: Faction = newState.deploymentTurn === 'imperial' ? 'chaos' : 'imperial';
    const otherHasUnits = newState.unplacedUnits!.some(u => u.faction === otherFaction);
    const currentHasUnits = newState.unplacedUnits!.some(u => u.faction === newState.deploymentTurn);

    if (otherHasUnits) {
      newState.deploymentTurn = otherFaction;
      newState.activeFaction = otherFaction;
      const zone = newState.hiddenDeploymentZones[otherFaction];
      newState.deploymentZone = { faction: otherFaction, rows: zone.rows, cols: zone.cols, additionalHexes: zone.additionalHexes };
    } else if (currentHasUnits) {
      const zone = newState.hiddenDeploymentZones[newState.deploymentTurn];
      newState.deploymentZone = { faction: newState.deploymentTurn, rows: zone.rows, cols: zone.cols, additionalHexes: zone.additionalHexes };
    }
  } else if (newState.standardGame && newState.deploymentTurn && newState.deploymentSides) {
    // Standard game: alternate deployment turns
    const otherFaction: Faction = newState.deploymentTurn === 'imperial' ? 'chaos' : 'imperial';
    // Switch to other faction if they still have units to place
    const otherHasUnits = newState.unplacedUnits!.some(u => u.faction === otherFaction);
    const currentHasUnits = newState.unplacedUnits!.some(u => u.faction === newState.deploymentTurn);

    if (otherHasUnits) {
      newState.deploymentTurn = otherFaction;
      newState.activeFaction = otherFaction;
      newState.deploymentZone = { faction: otherFaction, rows: newState.deploymentSides[otherFaction] };
    } else if (currentHasUnits) {
      // Other faction done, keep current
      newState.deploymentZone = { faction: newState.deploymentTurn, rows: newState.deploymentSides[newState.deploymentTurn] };
    }
  }

  return newState;
}

function handleDrawCard(state: GameState): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed + state.turnNumber);

  // Clear justDeployedUnitIds at start of each draw
  if (newState.cardDeployment) {
    newState.justDeployedUnitIds = [];
  }

  // If deck is empty, reshuffle discard pile
  if (newState.battleDeck.length === 0) {
    newState.battleDeck = shuffleDeck([...newState.discardPile], rng);
    newState.discardPile = [];
  }

  if (newState.battleDeck.length === 0) {
    return state; // No cards at all (shouldn't happen)
  }

  const card = newState.battleDeck[0];
  newState.battleDeck = newState.battleDeck.slice(1);
  newState.currentCard = card;
  newState.activeFaction = card.faction;
  newState.activatedUnitIds = [];
  newState.selectedUnitId = null;

  // Reset activation flags for all units
  for (const [, unit] of newState.units) {
    unit.hasActivated = false;
    unit.hasAttacked = false;
    unit.hasMoved = false;
  }

  // Card deployment: check if unplaced units match this card
  if (newState.cardDeployment && newState.allUnplacedUnits && newState.allUnplacedUnits.length > 0) {
    const matchingUnits: { type: UnitType; faction: import('./types.js').Faction }[] = [];
    const remainingAll = [...newState.allUnplacedUnits];

    if (card.special === 'ALL_MOVE') {
      // ALL_MOVE deploys all remaining unplaced units of the card's faction
      for (let i = remainingAll.length - 1; i >= 0; i--) {
        if (remainingAll[i].faction === card.faction) {
          matchingUnits.push(remainingAll[i]);
          remainingAll.splice(i, 1);
        }
      }
    } else {
      // Match card's unitTypes to ALL unplaced units of matching faction per type
      for (const unitType of card.unitTypes) {
        for (let i = remainingAll.length - 1; i >= 0; i--) {
          if (remainingAll[i].type === unitType && remainingAll[i].faction === card.faction) {
            matchingUnits.push(remainingAll[i]);
            remainingAll.splice(i, 1);
          }
        }
      }
    }

    if (matchingUnits.length > 0) {
      // Move matched units to unplacedUnits for deployment
      newState.allUnplacedUnits = remainingAll;
      newState.unplacedUnits = matchingUnits;
      // Set deployment zone from cardDeploymentZones
      if (newState.cardDeploymentZones) {
        const zone = newState.cardDeploymentZones[card.faction];
        newState.deploymentZone = {
          faction: card.faction,
          rows: [...zone.rows],
          cols: zone.cols ? [...zone.cols] : undefined,
        };
      }
      newState.currentPhase = 'deployment';
      return newState;
    }
  }

  // Check for Ogre Rampage special card
  if (card.special === 'OGRE_RAMPAGE') {
    // Find the ogre champion
    let ogre: import('./types.js').Unit | null = null;
    for (const [, unit] of newState.units) {
      if (unit.definitionType === 'ogre_champion') {
        ogre = unit;
        break;
      }
    }

    if (ogre && ogre.hp > 0) {
      const ogreSubCardsTotal = ogre.hp; // remaining HP = draws allowed (maxHp is 6)
      const subDeckRng = createRNG(state.seed + state.turnNumber + 7777);
      newState.ogreSubDeck = createOgreSubDeck(subDeckRng);
      newState.ogreSubCardIndex = 0;
      newState.ogreSubCardsTotal = ogreSubCardsTotal;
      newState.currentOgreSubCard = null;
      newState.selectedUnitId = ogre.id;
      newState.currentPhase = 'ogre_rampage';
      return newState;
    }
    // Ogre is dead — skip this card, discard and go to draw_card
    newState.discardPile.push(card);
    newState.currentCard = null;
    newState.turnNumber++;
    newState.currentPhase = 'draw_card';
    return newState;
  }

  // Check for Cannon Fire special card
  if (card.special === 'CANNON_FIRE') {
    let cannon: import('./types.js').Unit | null = null;
    for (const [, unit] of newState.units) {
      if (unit.definitionType === 'mighty_cannon') {
        cannon = unit;
        break;
      }
    }

    if (cannon && cannon.hp > 0) {
      newState.selectedUnitId = cannon.id;
      newState.cannonFireState = null;
      newState.currentPhase = 'cannon_fire';
      return newState;
    }
    // Cannon is dead — skip this card
    newState.discardPile.push(card);
    newState.currentCard = null;
    newState.turnNumber++;
    newState.currentPhase = 'draw_card';
    return newState;
  }

  newState.currentPhase = 'activation';

  return newState;
}

function handleSelectUnit(state: GameState, unitId: string): GameState {
  const newState = cloneState(state);
  newState.selectedUnitId = unitId;
  return newState;
}

function handleMoveUnit(state: GameState, unitId: string, to: HexCoord): GameState {
  const newState = cloneState(state);
  const unit = newState.units.get(unitId)!;

  unit.position = { ...to };
  unit.hasMoved = true;

  // Check scenario capture_hex win condition after move
  if (newState.scenarioId) {
    const winner = checkWinCondition(newState);
    if (winner) {
      newState.winner = winner;
      newState.currentPhase = 'game_over';
      return newState;
    }
  }

  // If moving during cannon_fire phase, end the turn (move OR fire)
  if (newState.currentPhase === 'cannon_fire') {
    return endCannonFireTurn(newState);
  }

  // If moving during ogre rampage, auto-end this sub-card activation
  if (newState.currentPhase === 'ogre_rampage' && newState.currentOgreSubCard?.type === 'ogre_move') {
    return handleEndOgreActivation(newState);
  }

  return newState;
}

function handleAttack(
  state: GameState,
  attackerId: string,
  defenderId: string,
  providedAttackerRolls?: import('./types.js').DieResult[],
  providedDefenderRolls?: import('./types.js').DieResult[],
): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed + state.turnNumber + state.combatLog.length);

  const attacker = newState.units.get(attackerId)!;
  const defender = newState.units.get(defenderId)!;

  const attackerTerrain = getTile(state.board, attacker.position)?.terrain ?? 'plain';
  const defenderTerrain = getTile(state.board, defender.position)?.terrain ?? 'plain';
  const distance = hexDistance(attacker.position, defender.position);

  const chargeBonus = state.currentCard?.special === 'CHARGE' ? 1 : 0;

  const ditchAttackMod = getDitchAttackModifier(state.board, attacker.position, defender.position, attacker.definitionType);
  const ditchDefenseMod = getDitchDefenseModifier(state.board, attacker.position, defender.position);

  const context = { attackerTerrain, defenderTerrain, distance, chargeBonus, ditchAttackModifier: ditchAttackMod, ditchDefenseModifier: ditchDefenseMod };

  const result = (providedAttackerRolls && providedDefenderRolls)
    ? resolveCombatWithRolls(attacker, defender, providedAttackerRolls, providedDefenderRolls)
    : resolveCombat(attacker, defender, rng, context);

  // Apply damage
  defender.hp -= result.damage;
  attacker.hasAttacked = true;

  // Log the combat
  newState.combatLog.push({
    type: 'melee',
    turnNumber: state.turnNumber,
    result,
    attackerName: getUnitDefinition(attacker.definitionType).name,
    defenderName: getUnitDefinition(defender.definitionType).name,
  });

  // Remove destroyed unit
  if (result.unitDestroyed) {
    newState.units.delete(defenderId);
  }

  // Check win condition
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.currentPhase = 'game_over';
  }

  // If attacking during ogre rampage, auto-end this sub-card activation
  if (newState.currentPhase === 'ogre_rampage' && newState.currentOgreSubCard?.type === 'ogre_attack') {
    return handleEndOgreActivation(newState);
  }

  // If attacking during activation, auto-end this unit's activation
  // (a unit can't do anything after attacking)
  if (newState.currentPhase === 'activation') {
    return handleEndActivation(newState);
  }

  return newState;
}

function handleEndActivation(state: GameState): GameState {
  const newState = cloneState(state);

  // Mark current unit as activated
  if (newState.selectedUnitId) {
    const unit = newState.units.get(newState.selectedUnitId);
    if (unit) {
      unit.hasActivated = true;
      if (!newState.activatedUnitIds.includes(newState.selectedUnitId)) {
        newState.activatedUnitIds.push(newState.selectedUnitId);
      }
    }
    newState.selectedUnitId = null;
  }

  // Check if more activations are possible
  if (newState.currentCard && canActivateMore(newState)) {
    // Stay in activation phase for next unit
    return newState;
  }

  // Move current card to discard pile
  if (newState.currentCard) {
    newState.discardPile.push(newState.currentCard);
    newState.currentCard = null;
  }

  newState.turnNumber++;
  newState.currentPhase = 'draw_card';

  return newState;
}

function handleDrawOgreCard(state: GameState): GameState {
  const newState = cloneState(state);

  const subCard = newState.ogreSubDeck[newState.ogreSubCardIndex];
  newState.currentOgreSubCard = { ...subCard };
  newState.ogreSubCardIndex++;

  // Find the ogre and reset its move/attack flags for this sub-card
  for (const [, unit] of newState.units) {
    if (unit.definitionType === 'ogre_champion') {
      unit.hasMoved = false;
      unit.hasAttacked = false;
      newState.selectedUnitId = unit.id;
      break;
    }
  }

  return newState;
}

function handleEndOgreActivation(state: GameState): GameState {
  const newState = cloneState(state);
  newState.currentOgreSubCard = null;

  // Check if ogre is still alive
  let ogreAlive = false;
  for (const [, unit] of newState.units) {
    if (unit.definitionType === 'ogre_champion') {
      ogreAlive = true;
      break;
    }
  }

  // If more sub-cards remain and ogre is alive, stay in ogre_rampage
  if (ogreAlive && newState.ogreSubCardIndex < newState.ogreSubCardsTotal) {
    return newState;
  }

  // End the rampage — discard card, advance turn
  return endOgreRampage(newState);
}

function endOgreRampage(state: GameState): GameState {
  if (state.currentCard) {
    state.discardPile.push(state.currentCard);
    state.currentCard = null;
  }
  state.selectedUnitId = null;
  state.ogreSubDeck = [];
  state.ogreSubCardIndex = 0;
  state.ogreSubCardsTotal = 0;
  state.currentOgreSubCard = null;
  state.turnNumber++;
  state.currentPhase = 'draw_card';
  return state;
}

function handlePass(state: GameState): GameState {
  const newState = cloneState(state);

  // If passing during card deployment, return remaining unplaced units to allUnplacedUnits and finish deployment
  if (newState.currentPhase === 'deployment' && newState.cardDeployment) {
    if (newState.unplacedUnits && newState.unplacedUnits.length > 0) {
      newState.allUnplacedUnits = [...(newState.allUnplacedUnits || []), ...newState.unplacedUnits];
    }
    newState.unplacedUnits = undefined;
    newState.deploymentZone = undefined;

    // Same logic as end-of-deployment in handlePlaceUnit: check for pre-existing units
    const card = newState.currentCard!;
    const justDeployed = new Set(newState.justDeployedUnitIds || []);
    let hasPreExistingUnits = false;

    if (card.special === 'ALL_MOVE') {
      for (const [id, u] of newState.units) {
        if (u.faction === card.faction && !justDeployed.has(id)) {
          hasPreExistingUnits = true;
          break;
        }
      }
    } else {
      for (const [id, u] of newState.units) {
        if (u.faction === card.faction &&
            card.unitTypes.includes(u.definitionType) &&
            !justDeployed.has(id)) {
          hasPreExistingUnits = true;
          break;
        }
      }
    }

    if (hasPreExistingUnits) {
      if (card.special === 'OGRE_RAMPAGE') {
        let ogre: import('./types.js').Unit | null = null;
        for (const [id, u] of newState.units) {
          if (u.definitionType === 'ogre_champion' && !justDeployed.has(id)) {
            ogre = u;
            break;
          }
        }
        if (ogre && ogre.hp > 0) {
          const ogreSubCardsTotal = ogre.hp;
          const subDeckRng = createRNG(state.seed + state.turnNumber + 7777);
          newState.ogreSubDeck = createOgreSubDeck(subDeckRng);
          newState.ogreSubCardIndex = 0;
          newState.ogreSubCardsTotal = ogreSubCardsTotal;
          newState.currentOgreSubCard = null;
          newState.selectedUnitId = ogre.id;
          newState.currentPhase = 'ogre_rampage';
          return newState;
        }
      } else if (card.special === 'CANNON_FIRE') {
        let cannon: import('./types.js').Unit | null = null;
        for (const [id, u] of newState.units) {
          if (u.definitionType === 'mighty_cannon' && !justDeployed.has(id)) {
            cannon = u;
            break;
          }
        }
        if (cannon && cannon.hp > 0) {
          newState.selectedUnitId = cannon.id;
          newState.cannonFireState = null;
          newState.currentPhase = 'cannon_fire';
          return newState;
        }
      } else {
        newState.currentPhase = 'activation';
        return newState;
      }
    }

    // No pre-existing units — end turn
    if (newState.currentCard) {
      newState.discardPile.push(newState.currentCard);
      newState.currentCard = null;
    }
    newState.selectedUnitId = null;
    newState.turnNumber++;
    newState.currentPhase = 'draw_card';
    return newState;
  }

  // If passing during ogre rampage, end it early
  if (newState.currentPhase === 'ogre_rampage') {
    return endOgreRampage(newState);
  }

  // If passing during cannon fire, end the turn
  if (newState.currentPhase === 'cannon_fire') {
    return endCannonFireTurn(newState);
  }

  // If we're passing during activation, end the entire activation
  if (newState.currentCard) {
    newState.discardPile.push(newState.currentCard);
    newState.currentCard = null;
  }

  newState.selectedUnitId = null;
  newState.activatedUnitIds = [];
  newState.turnNumber++;
  newState.currentPhase = 'draw_card';

  return newState;
}

// ─── Cannon Fire Handlers ──────────────────────────────────────

function handleFireCannon(state: GameState, targetCoord: HexCoord): GameState {
  const newState = cloneState(state);
  const cannon = newState.units.get(newState.selectedUnitId!)!;
  const distance = hexDistance(cannon.position, targetCoord);
  const rng = createRNG(state.seed + state.turnNumber + 5555);
  const tileDeck = createCannonTileDeck(rng);

  // Find target unit at coord
  let targetUnitId: string | null = null;
  for (const [id, unit] of newState.units) {
    if (coordToKey(unit.position) === coordToKey(targetCoord)) {
      targetUnitId = id;
      break;
    }
  }

  const cannonName = getUnitDefinition(cannon.definitionType).name;
  const targetUnit = targetUnitId ? newState.units.get(targetUnitId) : null;
  const targetName = targetUnit ? getUnitDefinition(targetUnit.definitionType).name : null;

  if (distance === 1) {
    // Adjacent shot: auto-destroy target, but check for misfire
    const cannonFireState: CannonFireState = {
      cannonUnitId: cannon.id,
      targetCoord,
      targetUnitId,
      tileDeck,
      tileIndex: 1, // we draw the first tile immediately
      path: [],
      placedTiles: [],
      tileResults: [],
      pathStepIndex: 0,
      resolved: false,
      misfire: false,
      misfireTile: null,
      targetDestroyed: true,
      adjacentShot: true,
    };

    const firstTile = tileDeck[0];
    cannonFireState.placedTiles.push({ coord: targetCoord, tile: firstTile });

    if (firstTile.type === 'explosion') {
      // Misfire! Destroy the unit in target hex, then draw one more onto cannon's space
      cannonFireState.misfire = true;
      if (targetUnitId) {
        newState.units.delete(targetUnitId);
      }
      const rubble = addTowerRubble(newState, targetCoord);
      cannonFireState.tileResults.push({
        tileType: 'explosion',
        unitHit: targetName,
        damage: 0,
        destroyed: !!targetUnitId,
        towerRubbleAdded: rubble.rubbleAdded,
        towerDestroyed: rubble.towerDestroyed,
      });

      const misfireTile = tileDeck[1];
      cannonFireState.tileIndex = 2;
      cannonFireState.misfireTile = misfireTile;
      cannonFireState.placedTiles.push({ coord: { ...cannon.position }, tile: misfireTile });

      // Resolve misfire tile on cannon
      let cannonDestroyed = false;
      let cannonDamage = 0;
      if (misfireTile.type === 'bouncing') {
        cannon.hp -= 1;
        cannonDamage = 1;
        if (cannon.hp <= 0) {
          newState.units.delete(cannon.id);
          cannonDestroyed = true;
        }
      } else if (misfireTile.type === 'explosion') {
        newState.units.delete(cannon.id);
        cannonDestroyed = true;
      }
      cannonFireState.tileResults.push({
        tileType: misfireTile.type,
        unitHit: (cannonDamage > 0 || cannonDestroyed) ? cannonName : null,
        damage: cannonDamage,
        destroyed: cannonDestroyed,
      });

      cannonFireState.resolved = true;
    } else {
      // No misfire — target destroyed
      cannonFireState.tileResults.push({
        tileType: firstTile.type,
        unitHit: targetName,
        damage: 0,
        destroyed: !!targetUnitId,
      });
      if (targetUnitId) {
        newState.units.delete(targetUnitId);
      }
      cannonFireState.resolved = true;
    }

    newState.cannonFireState = cannonFireState;

    // Log cannon fire event
    newState.combatLog.push({
      type: 'cannon_fire',
      turnNumber: state.turnNumber,
      cannonName,
      targetName,
      targetDestroyed: cannonFireState.targetDestroyed,
      misfire: cannonFireState.misfire,
      tileResults: cannonFireState.tileResults,
    });

    // Check win condition
    const winner = checkWinCondition(newState);
    if (winner) {
      newState.winner = winner;
      newState.currentPhase = 'game_over';
    }

    return newState;
  }

  // Distant shot: calculate paths
  const paths = getShortestPaths(cannon.position, targetCoord);

  const cannonFireState: CannonFireState = {
    cannonUnitId: cannon.id,
    targetCoord,
    targetUnitId,
    tileDeck,
    tileIndex: 0,
    path: paths.length === 1 ? paths[0] : [], // auto-select if only one path
    placedTiles: [],
    tileResults: [],
    pathStepIndex: 0,
    resolved: false,
    misfire: false,
    misfireTile: null,
    targetDestroyed: false,
    adjacentShot: false,
  };

  newState.cannonFireState = cannonFireState;
  return newState;
}

function handleSelectCannonPath(state: GameState, path: HexCoord[]): GameState {
  const newState = cloneState(state);
  newState.cannonFireState!.path = path.map(c => ({ ...c }));
  return newState;
}

function handleDrawCannonTile(state: GameState): GameState {
  const newState = cloneState(state);
  const cfs = newState.cannonFireState!;

  const tile = cfs.tileDeck[cfs.tileIndex];
  cfs.tileIndex++;

  const isFirstTile = cfs.placedTiles.length === 0;

  // Determine the coord for this tile
  let tileCoord: HexCoord;
  if (cfs.path.length > 0 && cfs.pathStepIndex < cfs.path.length) {
    tileCoord = cfs.path[cfs.pathStepIndex];
  } else {
    // We've traversed all intermediate steps — this tile goes on the target
    tileCoord = cfs.targetCoord;
  }

  cfs.placedTiles.push({ coord: { ...tileCoord }, tile: { ...tile } });

  // Helper: find unit at a coord and get its name
  const findUnitAt = (coord: HexCoord): { id: string; name: string } | null => {
    for (const [id, unit] of newState.units) {
      if (coordToKey(unit.position) === coordToKey(coord)) {
        return { id, name: getUnitDefinition(unit.definitionType).name };
      }
    }
    return null;
  };

  // Check if target is in the tower
  const targetTerrain = getTile(newState.board, cfs.targetCoord)?.terrain ?? 'plain';
  const targetInTower = targetTerrain === 'tower';

  if (isFirstTile && tile.type === 'explosion') {
    // MISFIRE: explosion on first tile
    cfs.misfire = true;

    // Destroy unit in the first path hex (if any)
    const hitUnit = findUnitAt(tileCoord);
    if (hitUnit) {
      newState.units.delete(hitUnit.id);
    }
    const rubble = addTowerRubble(newState, tileCoord);
    cfs.tileResults.push({
      tileType: 'explosion',
      unitHit: hitUnit?.name ?? null,
      damage: 0,
      destroyed: !!hitUnit,
      towerRubbleAdded: rubble.rubbleAdded,
      towerDestroyed: rubble.towerDestroyed,
    });

    // Draw one more tile onto cannon's space
    const cannon = newState.units.get(cfs.cannonUnitId);
    const cannonName = cannon ? getUnitDefinition(cannon.definitionType).name : null;
    const misfireTile = cfs.tileDeck[cfs.tileIndex];
    cfs.tileIndex++;
    cfs.misfireTile = { ...misfireTile };
    const cannonCoord = cannon ? { ...cannon.position } : { col: 0, row: 0 };
    cfs.placedTiles.push({ coord: cannonCoord, tile: { ...misfireTile } });

    let cannonDestroyed = false;
    let cannonDamage = 0;
    if (cannon) {
      if (misfireTile.type === 'bouncing') {
        cannon.hp -= 1;
        cannonDamage = 1;
        if (cannon.hp <= 0) {
          newState.units.delete(cfs.cannonUnitId);
          cannonDestroyed = true;
        }
      } else if (misfireTile.type === 'explosion') {
        newState.units.delete(cfs.cannonUnitId);
        cannonDestroyed = true;
      }
    }
    const misfireRubble = addTowerRubble(newState, cannonCoord);
    cfs.tileResults.push({
      tileType: misfireTile.type,
      unitHit: (cannonDamage > 0 || cannonDestroyed) ? cannonName : null,
      damage: cannonDamage,
      destroyed: cannonDestroyed,
      towerRubbleAdded: misfireRubble.rubbleAdded,
      towerDestroyed: misfireRubble.towerDestroyed,
    });

    cfs.resolved = true;
  } else if (tile.type === 'explosion') {
    // Explosion: destroy unit in this hex (could be anyone, not necessarily the target)
    const hitUnit = findUnitAt(tileCoord);
    if (hitUnit) {
      newState.units.delete(hitUnit.id);
    }
    const rubble = addTowerRubble(newState, tileCoord);
    cfs.tileResults.push({
      tileType: 'explosion',
      unitHit: hitUnit?.name ?? null,
      damage: 0,
      destroyed: !!hitUnit,
      towerRubbleAdded: rubble.rubbleAdded,
      towerDestroyed: rubble.towerDestroyed,
    });
    cfs.resolved = true;
  } else if (tile.type === 'bouncing') {
    // 1 damage to any unit in that hex
    const hitUnit = findUnitAt(tileCoord);
    let destroyed = false;
    if (hitUnit) {
      const unit = newState.units.get(hitUnit.id)!;
      unit.hp -= 1;
      if (unit.hp <= 0) {
        newState.units.delete(hitUnit.id);
        destroyed = true;
      }
    }
    cfs.tileResults.push({
      tileType: 'bouncing',
      unitHit: hitUnit?.name ?? null,
      damage: hitUnit ? 1 : 0,
      destroyed,
    });
    cfs.pathStepIndex++;

    // Check if we've reached the end of the path
    if (cfs.pathStepIndex >= cfs.path.length) {
      if (targetInTower && cfs.targetUnitId && newState.units.has(cfs.targetUnitId)) {
        // Tower target: bouncing = 1 damage (not auto-destroy)
        const target = newState.units.get(cfs.targetUnitId)!;
        const targetName = getUnitDefinition(target.definitionType).name;
        target.hp -= 1;
        if (target.hp <= 0) {
          newState.units.delete(cfs.targetUnitId);
          cfs.targetDestroyed = true;
        }
        // Draw one more tile for the target hex to resolve against tower
        const extraTile = cfs.tileDeck[cfs.tileIndex];
        cfs.tileIndex++;
        cfs.placedTiles.push({ coord: { ...cfs.targetCoord }, tile: { ...extraTile } });
        if (extraTile.type === 'flying') {
          // Ball passes over tower — target survives (already took bouncing damage above)
          cfs.tileResults.push({
            tileType: 'flying',
            unitHit: null,
            damage: 0,
            destroyed: false,
          });
        } else if (extraTile.type === 'bouncing') {
          // 1 more damage to target
          const targetStill = newState.units.get(cfs.targetUnitId!);
          if (targetStill) {
            targetStill.hp -= 1;
            if (targetStill.hp <= 0) {
              newState.units.delete(cfs.targetUnitId!);
              cfs.targetDestroyed = true;
            }
            cfs.tileResults.push({
              tileType: 'bouncing',
              unitHit: targetName,
              damage: 1,
              destroyed: targetStill.hp <= 0,
            });
          } else {
            cfs.tileResults.push({
              tileType: 'bouncing',
              unitHit: null,
              damage: 0,
              destroyed: false,
            });
          }
        } else {
          // Explosion: eliminate target + add rubble
          const targetStill = newState.units.get(cfs.targetUnitId!);
          if (targetStill) {
            newState.units.delete(cfs.targetUnitId!);
            cfs.targetDestroyed = true;
          }
          const rubble = addTowerRubble(newState, cfs.targetCoord);
          cfs.tileResults.push({
            tileType: 'explosion',
            unitHit: targetStill ? targetName : null,
            damage: 0,
            destroyed: !!targetStill,
            towerRubbleAdded: rubble.rubbleAdded,
            towerDestroyed: rubble.towerDestroyed,
          });
        }
      } else {
        // Non-tower target: auto-destroy as before
        cfs.targetDestroyed = true;
        if (cfs.targetUnitId && newState.units.has(cfs.targetUnitId)) {
          newState.units.delete(cfs.targetUnitId);
        }
      }
      cfs.resolved = true;
    }
  } else {
    // Flying — no effect, continue
    cfs.tileResults.push({
      tileType: 'flying',
      unitHit: null,
      damage: 0,
      destroyed: false,
    });
    cfs.pathStepIndex++;

    if (cfs.pathStepIndex >= cfs.path.length) {
      if (targetInTower && cfs.targetUnitId && newState.units.has(cfs.targetUnitId)) {
        // Tower target: draw one more tile for the target hex
        const target = newState.units.get(cfs.targetUnitId)!;
        const targetName = getUnitDefinition(target.definitionType).name;
        const extraTile = cfs.tileDeck[cfs.tileIndex];
        cfs.tileIndex++;
        cfs.placedTiles.push({ coord: { ...cfs.targetCoord }, tile: { ...extraTile } });
        if (extraTile.type === 'flying') {
          // Ball passes over tower — target survives
          cfs.tileResults.push({
            tileType: 'flying',
            unitHit: null,
            damage: 0,
            destroyed: false,
          });
        } else if (extraTile.type === 'bouncing') {
          // 1 damage to target
          target.hp -= 1;
          if (target.hp <= 0) {
            newState.units.delete(cfs.targetUnitId!);
            cfs.targetDestroyed = true;
          }
          cfs.tileResults.push({
            tileType: 'bouncing',
            unitHit: targetName,
            damage: 1,
            destroyed: target.hp <= 0,
          });
        } else {
          // Explosion: eliminate target + add rubble
          newState.units.delete(cfs.targetUnitId!);
          cfs.targetDestroyed = true;
          const rubble = addTowerRubble(newState, cfs.targetCoord);
          cfs.tileResults.push({
            tileType: 'explosion',
            unitHit: targetName,
            damage: 0,
            destroyed: true,
            towerRubbleAdded: rubble.rubbleAdded,
            towerDestroyed: rubble.towerDestroyed,
          });
        }
      } else {
        // Non-tower target: auto-destroy as before
        cfs.targetDestroyed = true;
        if (cfs.targetUnitId && newState.units.has(cfs.targetUnitId)) {
          newState.units.delete(cfs.targetUnitId);
        }
      }
      cfs.resolved = true;
    }
  }

  // Log combat event when resolved
  if (cfs.resolved) {
    const cannon = state.units.get(cfs.cannonUnitId);
    const cannonName = cannon ? getUnitDefinition(cannon.definitionType).name : 'Cannon';
    const targetUnit = cfs.targetUnitId ? state.units.get(cfs.targetUnitId) : null;
    const targetName = targetUnit ? getUnitDefinition(targetUnit.definitionType).name : null;

    newState.combatLog.push({
      type: 'cannon_fire',
      turnNumber: state.turnNumber,
      cannonName,
      targetName,
      targetDestroyed: cfs.targetDestroyed,
      misfire: cfs.misfire,
      tileResults: [...cfs.tileResults],
    });
  }

  // Check win condition
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.currentPhase = 'game_over';
  }

  return newState;
}

function handleEndCannonFire(state: GameState): GameState {
  const newState = cloneState(state);
  return endCannonFireTurn(newState);
}

function endCannonFireTurn(state: GameState): GameState {
  state.cannonFireState = null;
  if (state.currentCard) {
    state.discardPile.push(state.currentCard);
    state.currentCard = null;
  }
  state.selectedUnitId = null;
  state.turnNumber++;
  state.currentPhase = 'draw_card';
  return state;
}

// ─── Helpers ───────────────────────────────────────────────────

function canActivateMore(state: GameState): boolean {
  if (!state.currentCard) return false;

  const justDeployed = state.justDeployedUnitIds ? new Set(state.justDeployedUnitIds) : null;

  // Check if there are eligible units that haven't activated
  for (const [id, unit] of state.units) {
    if (unit.faction !== state.currentCard.faction) continue;
    if (unit.hasActivated) continue;
    if (state.activatedUnitIds.includes(id)) continue;
    if (!state.currentCard.unitTypes.includes(unit.definitionType)) continue;
    // Skip units that were just deployed this turn
    if (justDeployed?.has(id)) continue;
    return true;
  }

  return false;
}

function checkWinCondition(state: GameState): Faction | null {
  // Check scenario-specific win conditions first
  if (state.scenarioId) {
    const scenario = getScenarioById(state.scenarioId);
    if (scenario) {
      for (const wc of scenario.winConditions) {
        if (wc.type === 'capture_hex' && wc.targetCoord) {
          const targetKey = coordToKey(wc.targetCoord);
          for (const [, unit] of state.units) {
            if (unit.faction === wc.faction && coordToKey(unit.position) === targetKey) {
              return wc.faction;
            }
          }
        }
      }
    }
  }

  // Standard elimination check
  let hasImperial = false;
  let hasChaos = false;

  for (const [, unit] of state.units) {
    if (unit.faction === 'imperial') hasImperial = true;
    if (unit.faction === 'chaos') hasChaos = true;
    if (hasImperial && hasChaos) return null; // Both still alive
  }

  // In card deployment mode, factions with unplaced units are not eliminated
  if (state.allUnplacedUnits && state.allUnplacedUnits.length > 0) {
    if (!hasImperial && state.allUnplacedUnits.some(u => u.faction === 'imperial')) hasImperial = true;
    if (!hasChaos && state.allUnplacedUnits.some(u => u.faction === 'chaos')) hasChaos = true;
    if (hasImperial && hasChaos) return null;
  }

  if (!hasImperial) return 'chaos';
  if (!hasChaos) return 'imperial';
  return null;
}

/** Deep clone game state (units map, arrays) */
function cloneState(state: GameState): GameState {
  const newUnits = new Map<string, import('./types.js').Unit>();
  for (const [id, unit] of state.units) {
    newUnits.set(id, { ...unit, position: { ...unit.position } });
  }

  return {
    ...state,
    board: { ...state.board, hedges: new Set(state.board.hedges) },
    units: newUnits,
    battleDeck: [...state.battleDeck],
    discardPile: [...state.discardPile],
    combatLog: [...state.combatLog],
    activatedUnitIds: [...state.activatedUnitIds],
    currentCard: state.currentCard ? { ...state.currentCard } : null,
    ogreSubDeck: state.ogreSubDeck.map(c => ({ ...c })),
    currentOgreSubCard: state.currentOgreSubCard ? { ...state.currentOgreSubCard } : null,
    towerState: { ...state.towerState },
    cannonFireState: state.cannonFireState ? {
      ...state.cannonFireState,
      tileDeck: state.cannonFireState.tileDeck.map(t => ({ ...t })),
      path: state.cannonFireState.path.map(c => ({ ...c })),
      placedTiles: state.cannonFireState.placedTiles.map(p => ({ coord: { ...p.coord }, tile: { ...p.tile } })),
      tileResults: state.cannonFireState.tileResults.map(r => ({ ...r })),
      targetCoord: { ...state.cannonFireState.targetCoord },
      misfireTile: state.cannonFireState.misfireTile ? { ...state.cannonFireState.misfireTile } : null,
    } : null,
    deploymentZone: state.deploymentZone ? {
      ...state.deploymentZone,
      rows: [...state.deploymentZone.rows],
      cols: state.deploymentZone.cols ? [...state.deploymentZone.cols] : undefined,
      additionalHexes: state.deploymentZone.additionalHexes?.map(h => ({ ...h })),
    } : undefined,
    hiddenDeployment: state.hiddenDeployment,
    hiddenDeploymentZones: state.hiddenDeploymentZones ? {
      imperial: {
        rows: [...state.hiddenDeploymentZones.imperial.rows],
        cols: [...state.hiddenDeploymentZones.imperial.cols],
        additionalHexes: state.hiddenDeploymentZones.imperial.additionalHexes?.map(h => ({ ...h })),
      },
      chaos: {
        rows: [...state.hiddenDeploymentZones.chaos.rows],
        cols: [...state.hiddenDeploymentZones.chaos.cols],
        additionalHexes: state.hiddenDeploymentZones.chaos.additionalHexes?.map(h => ({ ...h })),
      },
    } : undefined,
    unplacedUnits: state.unplacedUnits ? state.unplacedUnits.map(u => ({ ...u })) : undefined,
    availableTerrain: state.availableTerrain ? { ...state.availableTerrain } : undefined,
    deploymentSides: state.deploymentSides ? {
      imperial: [...state.deploymentSides.imperial],
      chaos: [...state.deploymentSides.chaos],
    } : undefined,
    allUnplacedUnits: state.allUnplacedUnits ? state.allUnplacedUnits.map(u => ({ ...u })) : undefined,
    justDeployedUnitIds: state.justDeployedUnitIds ? [...state.justDeployedUnitIds] : undefined,
    cardDeploymentZones: state.cardDeploymentZones ? {
      imperial: {
        rows: [...state.cardDeploymentZones.imperial.rows],
        cols: state.cardDeploymentZones.imperial.cols ? [...state.cardDeploymentZones.imperial.cols] : undefined,
      },
      chaos: {
        rows: [...state.cardDeploymentZones.chaos.rows],
        cols: state.cardDeploymentZones.chaos.cols ? [...state.cardDeploymentZones.chaos.cols] : undefined,
      },
    } : undefined,
  };
}
