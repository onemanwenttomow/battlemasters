import { GameState, GameAction, Faction, coordToKey } from './types.js';
import { createDefaultBoard } from './board.js';
import { createUnit, getDefaultImperialArmy, getDefaultChaosArmy, resetUnitIdCounter } from './units.js';
import { createBattleDeck, shuffleDeck, createRNG } from './cards.js';
import { resolveCombat } from './combat.js';
import { getTile } from './board.js';
import { validateAction } from './validation.js';
import { hexDistance } from './hex.js';

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
  };
}

// ─── State Machine ─────────────────────────────────────────────

/** Apply an action to the game state. Returns new state (immutable-style). */
export function applyAction(state: GameState, action: GameAction): GameState {
  const validation = validateAction(state, action);
  if (!validation.valid) {
    console.warn(`Invalid action: ${validation.reason}`, action);
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

  newState.currentPhase = 'activation';

  return newState;
}

function handleSelectUnit(state: GameState, unitId: string): GameState {
  const newState = cloneState(state);
  newState.selectedUnitId = unitId;
  return newState;
}

function handleMoveUnit(state: GameState, unitId: string, to: import('./types.js').HexCoord): GameState {
  const newState = cloneState(state);
  const unit = newState.units.get(unitId)!;

  unit.position = { ...to };
  unit.hasMoved = true;

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

  const result = resolveCombat(attacker, defender, rng, {
    attackerTerrain,
    defenderTerrain,
    distance,
  });

  // Apply damage
  defender.hp -= result.damage;
  attacker.hasAttacked = true;

  // Log the combat
  newState.combatLog.push({
    turnNumber: state.turnNumber,
    result,
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

function handlePass(state: GameState): GameState {
  const newState = cloneState(state);

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
  };
}
