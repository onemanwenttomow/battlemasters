import { GameState, GameAction, Unit, HexCoord, coordToKey } from './types.js';
import { getUnitDefinition } from './units.js';
import { hexDistance, getReachableHexes, getNeighbors } from './hex.js';
import { getTile } from './board.js';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Validate whether a game action is legal in the current state */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  switch (action.type) {
    case 'START_GAME':
      return validateStartGame(state);
    case 'DRAW_CARD':
      return validateDrawCard(state);
    case 'SELECT_UNIT':
      return validateSelectUnit(state, action.unitId);
    case 'MOVE_UNIT':
      return validateMoveUnit(state, action.unitId, action.to);
    case 'ATTACK':
      return validateAttack(state, action.attackerId, action.defenderId);
    case 'END_ACTIVATION':
      return validateEndActivation(state);
    case 'PASS':
      return validatePass(state);
    default:
      return { valid: false, reason: 'Unknown action type' };
  }
}

function validateStartGame(state: GameState): ValidationResult {
  if (state.currentPhase !== 'setup') {
    return { valid: false, reason: 'Game already started' };
  }
  return { valid: true };
}

function validateDrawCard(state: GameState): ValidationResult {
  if (state.currentPhase !== 'draw_card') {
    return { valid: false, reason: 'Not in draw card phase' };
  }
  return { valid: true };
}

function validateSelectUnit(state: GameState, unitId: string): ValidationResult {
  if (state.currentPhase !== 'activation') {
    return { valid: false, reason: 'Not in activation phase' };
  }

  const unit = state.units.get(unitId);
  if (!unit) {
    return { valid: false, reason: 'Unit not found' };
  }

  if (!state.currentCard) {
    return { valid: false, reason: 'No card drawn' };
  }

  if (unit.faction !== state.currentCard.faction) {
    return { valid: false, reason: 'Unit does not belong to active faction' };
  }

  if (unit.hasActivated) {
    return { valid: false, reason: 'Unit already activated this card' };
  }

  // Check if the unit type matches the card
  if (!state.currentCard.unitTypes.includes(unit.definitionType)) {
    return { valid: false, reason: 'Card does not activate this unit type' };
  }

  // Check activation count limit
  const activatedCount = state.activatedUnitIds.length;
  if (activatedCount >= state.currentCard.count) {
    return { valid: false, reason: 'Maximum activations reached for this card' };
  }

  return { valid: true };
}

function validateMoveUnit(state: GameState, unitId: string, to: HexCoord): ValidationResult {
  if (state.currentPhase !== 'activation') {
    return { valid: false, reason: 'Not in activation phase' };
  }

  const unit = state.units.get(unitId);
  if (!unit) {
    return { valid: false, reason: 'Unit not found' };
  }

  if (state.selectedUnitId !== unitId) {
    return { valid: false, reason: 'Unit not selected' };
  }

  if (unit.hasAttacked) {
    return { valid: false, reason: 'Cannot move after attacking' };
  }

  if (unit.hasMoved) {
    return { valid: false, reason: 'Unit already moved' };
  }

  const def = getUnitDefinition(unit.definitionType);

  if (def.movement === 0) {
    return { valid: false, reason: 'Unit cannot move (stationary)' };
  }

  // Check if unit type can't enter tower
  const targetTile = getTile(state.board, to);
  if (!targetTile) {
    return { valid: false, reason: 'Target hex does not exist' };
  }

  if (targetTile.terrain === 'tower' && def.special?.includes('no_tower')) {
    return { valid: false, reason: 'This unit cannot enter the tower' };
  }

  // Check if target is occupied
  const occupiedHexes = getOccupiedHexes(state, unitId);
  if (occupiedHexes.has(coordToKey(to))) {
    return { valid: false, reason: 'Target hex is occupied' };
  }

  // Check if target is reachable
  const reachable = getReachableHexes(unit.position, def.movement, state.board, occupiedHexes);
  const reachableKeys = new Set(reachable.map(coordToKey));
  if (!reachableKeys.has(coordToKey(to))) {
    return { valid: false, reason: 'Target hex is not reachable' };
  }

  return { valid: true };
}

function validateAttack(state: GameState, attackerId: string, defenderId: string): ValidationResult {
  if (state.currentPhase !== 'activation') {
    return { valid: false, reason: 'Not in activation phase' };
  }

  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);

  if (!attacker) return { valid: false, reason: 'Attacker not found' };
  if (!defender) return { valid: false, reason: 'Defender not found' };

  if (state.selectedUnitId !== attackerId) {
    return { valid: false, reason: 'Attacker not selected' };
  }

  if (attacker.hasAttacked) {
    return { valid: false, reason: 'Unit already attacked' };
  }

  if (attacker.faction === defender.faction) {
    return { valid: false, reason: 'Cannot attack friendly units' };
  }

  const def = getUnitDefinition(attacker.definitionType);
  const distance = hexDistance(attacker.position, defender.position);

  // move_or_attack restriction (ranged units and cannon)
  if (def.special?.includes('move_or_attack') && attacker.hasMoved) {
    return { valid: false, reason: 'This unit cannot attack after moving' };
  }

  const isRanged = def.special?.includes('ranged');

  if (isRanged && distance > 1) {
    // Ranged attack at distance — check range
    if (distance > def.range) {
      return { valid: false, reason: 'Target out of range' };
    }

    // Ranged units engaged in hand-to-hand (adjacent enemy) can't fire at distant targets
    // Exception: units inside the tower
    const attackerTile = getTile(state.board, attacker.position);
    const inTower = attackerTile?.terrain === 'tower';

    if (!inTower && isEngagedInMelee(state, attacker)) {
      return { valid: false, reason: 'Cannot fire ranged attack while engaged in hand-to-hand combat' };
    }
  } else {
    // Melee attack (or ranged unit attacking adjacent = hand-to-hand)
    if (distance > 1) {
      return { valid: false, reason: 'Target out of range' };
    }
  }

  return { valid: true };
}

function validateEndActivation(state: GameState): ValidationResult {
  if (state.currentPhase !== 'activation') {
    return { valid: false, reason: 'Not in activation phase' };
  }
  return { valid: true };
}

function validatePass(state: GameState): ValidationResult {
  if (state.currentPhase !== 'activation' && state.currentPhase !== 'draw_card') {
    return { valid: false, reason: 'Cannot pass in current phase' };
  }
  return { valid: true };
}

// ─── Helper ────────────────────────────────────────────────────

/** Check if a unit has an adjacent enemy (engaged in hand-to-hand combat) */
export function isEngagedInMelee(state: GameState, unit: Unit): boolean {
  for (const [, other] of state.units) {
    if (other.faction === unit.faction) continue;
    if (hexDistance(unit.position, other.position) === 1) {
      return true;
    }
  }
  return false;
}

/** Get set of hex keys occupied by other units */
function getOccupiedHexes(state: GameState, excludeUnitId?: string): Set<string> {
  const occupied = new Set<string>();
  for (const [id, unit] of state.units) {
    if (id !== excludeUnitId) {
      occupied.add(coordToKey(unit.position));
    }
  }
  return occupied;
}

/** Get valid move targets for a unit */
export function getValidMoveTargets(state: GameState, unitId: string): HexCoord[] {
  const unit = state.units.get(unitId);
  if (!unit) return [];

  const def = getUnitDefinition(unit.definitionType);
  if (def.movement === 0) return [];
  if (unit.hasMoved || unit.hasAttacked) return [];

  const occupiedHexes = getOccupiedHexes(state, unitId);
  const reachable = getReachableHexes(unit.position, def.movement, state.board, occupiedHexes);

  // Filter out tower for mounted units
  if (def.special?.includes('no_tower')) {
    return reachable.filter(h => {
      const tile = getTile(state.board, h);
      return tile?.terrain !== 'tower';
    });
  }

  return reachable;
}

/** Get valid attack targets for a unit */
export function getValidAttackTargets(state: GameState, unitId: string): string[] {
  const unit = state.units.get(unitId);
  if (!unit || unit.hasAttacked) return [];

  const def = getUnitDefinition(unit.definitionType);

  // move_or_attack check
  if (def.special?.includes('move_or_attack') && unit.hasMoved) return [];

  const isRanged = def.special?.includes('ranged');

  // Check if ranged unit is engaged in melee (can only attack adjacent unless in tower)
  const attackerTile = getTile(state.board, unit.position);
  const inTower = attackerTile?.terrain === 'tower';
  const engaged = isRanged && !inTower && isEngagedInMelee(state, unit);

  const targets: string[] = [];
  for (const [id, other] of state.units) {
    if (other.faction === unit.faction) continue;
    const distance = hexDistance(unit.position, other.position);

    if (isRanged && distance > 1) {
      // Ranged fire: must be in range and not engaged
      if (distance > def.range) continue;
      if (engaged) continue;
    } else {
      // Melee: must be adjacent
      if (distance > 1) continue;
    }

    targets.push(id);
  }

  return targets;
}
