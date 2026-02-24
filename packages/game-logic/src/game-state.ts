import { GameState, GameAction, Faction, coordToKey, HexCoord, CannonFireState, CannonTileResult } from './types.js';
import { createDefaultBoard } from './board.js';
import { createUnit, getDefaultImperialArmy, getDefaultChaosArmy, resetUnitIdCounter, getUnitDefinition } from './units.js';
import { createBattleDeck, shuffleDeck, createRNG, createOgreSubDeck, createCannonTileDeck } from './cards.js';
import { resolveCombat } from './combat.js';
import { getTile } from './board.js';
import { validateAction } from './validation.js';
import { hexDistance, getShortestPaths } from './hex.js';

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
  };
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
      return handleStartGame(state);
    case 'DRAW_CARD':
      return handleDrawCard(state);
    case 'SELECT_UNIT':
      return handleSelectUnit(state, action.unitId);
    case 'MOVE_UNIT':
      return handleMoveUnit(state, action.unitId, action.to);
    case 'ATTACK':
      return handleAttack(state, action.attackerId, action.defenderId);
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

function handleStartGame(state: GameState): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed);

  // Place units
  const imperialArmy = getDefaultImperialArmy();
  const chaosArmy = getDefaultChaosArmy();

  for (const setup of [...imperialArmy.units, ...chaosArmy.units]) {
    const unit = createUnit(setup.type, setup.position);
    newState.units.set(unit.id, unit);
  }

  // Create and shuffle the battle deck
  const deck = createBattleDeck();
  newState.battleDeck = shuffleDeck(deck, rng);
  newState.discardPile = [];

  newState.currentPhase = 'draw_card';
  newState.turnNumber = 1;

  return newState;
}

function handleDrawCard(state: GameState): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed + state.turnNumber);

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

  // If moving during cannon_fire phase, end the turn (move OR fire)
  if (newState.currentPhase === 'cannon_fire') {
    return endCannonFireTurn(newState);
  }

  return newState;
}

function handleAttack(state: GameState, attackerId: string, defenderId: string): GameState {
  const newState = cloneState(state);
  const rng = createRNG(state.seed + state.turnNumber + state.combatLog.length);

  const attacker = newState.units.get(attackerId)!;
  const defender = newState.units.get(defenderId)!;

  const attackerTerrain = getTile(state.board, attacker.position)?.terrain ?? 'plain';
  const defenderTerrain = getTile(state.board, defender.position)?.terrain ?? 'plain';
  const distance = hexDistance(attacker.position, defender.position);

  const chargeBonus = state.currentCard?.special === 'CHARGE' ? 1 : 0;

  const result = resolveCombat(attacker, defender, rng, {
    attackerTerrain,
    defenderTerrain,
    distance,
    chargeBonus,
  });

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
      cannonFireState.tileResults.push({
        tileType: 'explosion',
        unitHit: targetName,
        damage: 0,
        destroyed: !!targetUnitId,
      });
      if (targetUnitId) {
        newState.units.delete(targetUnitId);
      }

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

  if (isFirstTile && tile.type === 'explosion') {
    // MISFIRE: explosion on first tile
    cfs.misfire = true;

    // Destroy unit in the first path hex (if any)
    const hitUnit = findUnitAt(tileCoord);
    if (hitUnit) {
      newState.units.delete(hitUnit.id);
    }
    cfs.tileResults.push({
      tileType: 'explosion',
      unitHit: hitUnit?.name ?? null,
      damage: 0,
      destroyed: !!hitUnit,
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
    cfs.tileResults.push({
      tileType: misfireTile.type,
      unitHit: (cannonDamage > 0 || cannonDestroyed) ? cannonName : null,
      damage: cannonDamage,
      destroyed: cannonDestroyed,
    });

    cfs.resolved = true;
  } else if (tile.type === 'explosion') {
    // Explosion: destroy unit in this hex (could be anyone, not necessarily the target)
    const hitUnit = findUnitAt(tileCoord);
    if (hitUnit) {
      newState.units.delete(hitUnit.id);
    }
    cfs.tileResults.push({
      tileType: 'explosion',
      unitHit: hitUnit?.name ?? null,
      damage: 0,
      destroyed: !!hitUnit,
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

    // Check if we've reached the end of the path — target destroyed
    if (cfs.pathStepIndex >= cfs.path.length) {
      cfs.targetDestroyed = true;
      cfs.resolved = true;
      // Destroy the target
      if (cfs.targetUnitId && newState.units.has(cfs.targetUnitId)) {
        newState.units.delete(cfs.targetUnitId);
      }
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
      cfs.targetDestroyed = true;
      cfs.resolved = true;
      if (cfs.targetUnitId && newState.units.has(cfs.targetUnitId)) {
        newState.units.delete(cfs.targetUnitId);
      }
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
  if (state.activatedUnitIds.length >= state.currentCard.count) return false;

  // Check if there are eligible units that haven't activated
  for (const [id, unit] of state.units) {
    if (unit.faction !== state.currentCard.faction) continue;
    if (unit.hasActivated) continue;
    if (state.activatedUnitIds.includes(id)) continue;
    if (!state.currentCard.unitTypes.includes(unit.definitionType)) continue;
    return true;
  }

  return false;
}

function checkWinCondition(state: GameState): Faction | null {
  let hasImperial = false;
  let hasChaos = false;

  for (const [, unit] of state.units) {
    if (unit.faction === 'imperial') hasImperial = true;
    if (unit.faction === 'chaos') hasChaos = true;
    if (hasImperial && hasChaos) return null; // Both still alive
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
    units: newUnits,
    battleDeck: [...state.battleDeck],
    discardPile: [...state.discardPile],
    combatLog: [...state.combatLog],
    activatedUnitIds: [...state.activatedUnitIds],
    currentCard: state.currentCard ? { ...state.currentCard } : null,
    ogreSubDeck: state.ogreSubDeck.map(c => ({ ...c })),
    currentOgreSubCard: state.currentOgreSubCard ? { ...state.currentOgreSubCard } : null,
    cannonFireState: state.cannonFireState ? {
      ...state.cannonFireState,
      tileDeck: state.cannonFireState.tileDeck.map(t => ({ ...t })),
      path: state.cannonFireState.path.map(c => ({ ...c })),
      placedTiles: state.cannonFireState.placedTiles.map(p => ({ coord: { ...p.coord }, tile: { ...p.tile } })),
      tileResults: state.cannonFireState.tileResults.map(r => ({ ...r })),
      targetCoord: { ...state.cannonFireState.targetCoord },
      misfireTile: state.cannonFireState.misfireTile ? { ...state.cannonFireState.misfireTile } : null,
    } : null,
  };
}
