import { GameState, GameAction, Unit, HexCoord, coordToKey, edgeKey, PlaceableTerrainType } from './types.js';
import { getUnitDefinition } from './units.js';
import { hexDistance, getReachableHexes, getNeighbors, isFortifiedEdge } from './hex.js';
import { getTile } from './board.js';

/** Get effective movement range for a unit, considering card bonuses */
function getEffectiveMovement(state: GameState, unitType: string, baseMovement: number): number {
  if (state.currentCard?.special === 'WOLF_RIDER_DOUBLE_MOVE' && unitType === 'wolf_rider') {
    return state.currentCard.count;
  }
  return baseMovement;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Validate whether a game action is legal in the current state */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  switch (action.type) {
    case 'START_GAME':
      return validateStartGame(state);
    case 'START_STANDARD_GAME':
      return validateStartStandardGame(state);
    case 'PLACE_TERRAIN':
      return validatePlaceTerrain(state, action.terrainType, action.position);
    case 'PLACE_HEDGE':
      return validatePlaceHedge(state, action.from, action.to);
    case 'REMOVE_TERRAIN':
      return validateRemoveTerrain(state, action.position);
    case 'REMOVE_HEDGE':
      return validateRemoveHedge(state, action.from, action.to);
    case 'FINISH_TERRAIN_PLACEMENT':
      return validateFinishTerrainPlacement(state);
    case 'SELECT_SIDE':
      return validateSelectSide(state);
    case 'PLACE_UNIT':
      return validatePlaceUnit(state, action.unitType, action.position);
    case 'AUTO_DEPLOY':
      return validateAutoDeploy(state);
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
    case 'DRAW_OGRE_CARD':
      return validateDrawOgreCard(state);
    case 'END_OGRE_ACTIVATION':
      return validateEndOgreActivation(state);
    case 'FIRE_CANNON':
      return validateFireCannon(state, action.targetCoord);
    case 'SELECT_CANNON_PATH':
      return validateSelectCannonPath(state, action.path);
    case 'DRAW_CANNON_TILE':
      return validateDrawCannonTile(state);
    case 'END_CANNON_FIRE':
      return validateEndCannonFire(state);
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

function validateStartStandardGame(state: GameState): ValidationResult {
  if (state.currentPhase !== 'setup') {
    return { valid: false, reason: 'Game already started' };
  }
  return { valid: true };
}

function validatePlaceTerrain(state: GameState, terrainType: PlaceableTerrainType, position: HexCoord): ValidationResult {
  if (state.currentPhase !== 'terrain_placement') {
    return { valid: false, reason: 'Not in terrain placement phase' };
  }
  if (!state.availableTerrain || state.availableTerrain[terrainType] <= 0) {
    return { valid: false, reason: `No ${terrainType} pieces remaining` };
  }
  const tile = getTile(state.board, position);
  if (!tile) {
    return { valid: false, reason: 'Position does not exist' };
  }
  if (tile.terrain !== 'plain') {
    return { valid: false, reason: 'Can only place terrain on plain tiles' };
  }
  return { valid: true };
}

function validatePlaceHedge(state: GameState, from: HexCoord, to: HexCoord): ValidationResult {
  if (state.currentPhase !== 'terrain_placement') {
    return { valid: false, reason: 'Not in terrain placement phase' };
  }
  if (!state.availableTerrain || state.availableTerrain.hedge <= 0) {
    return { valid: false, reason: 'No hedge pieces remaining' };
  }
  const fromTile = getTile(state.board, from);
  const toTile = getTile(state.board, to);
  if (!fromTile || !toTile) {
    return { valid: false, reason: 'Hex does not exist' };
  }
  if (hexDistance(from, to) !== 1) {
    return { valid: false, reason: 'Hexes must be adjacent' };
  }
  if (fromTile.terrain === 'river' || toTile.terrain === 'river') {
    return { valid: false, reason: 'Cannot place hedge on river edge' };
  }
  const key = edgeKey(from, to);
  if (state.board.hedges.has(key)) {
    return { valid: false, reason: 'Edge already has a hedge' };
  }
  return { valid: true };
}

function validateRemoveTerrain(state: GameState, position: HexCoord): ValidationResult {
  if (state.currentPhase !== 'terrain_placement') {
    return { valid: false, reason: 'Not in terrain placement phase' };
  }
  const tile = getTile(state.board, position);
  if (!tile) {
    return { valid: false, reason: 'Position does not exist' };
  }
  if (tile.terrain !== 'tower' && tile.terrain !== 'marsh' && tile.terrain !== 'ditch') {
    return { valid: false, reason: 'No placed terrain at this position' };
  }
  return { valid: true };
}

function validateRemoveHedge(state: GameState, from: HexCoord, to: HexCoord): ValidationResult {
  if (state.currentPhase !== 'terrain_placement') {
    return { valid: false, reason: 'Not in terrain placement phase' };
  }
  const key = edgeKey(from, to);
  if (!state.board.hedges.has(key)) {
    return { valid: false, reason: 'No hedge on this edge' };
  }
  return { valid: true };
}

function validateFinishTerrainPlacement(state: GameState): ValidationResult {
  if (state.currentPhase !== 'terrain_placement') {
    return { valid: false, reason: 'Not in terrain placement phase' };
  }
  return { valid: true };
}

function validateSelectSide(state: GameState): ValidationResult {
  if (state.currentPhase !== 'side_selection') {
    return { valid: false, reason: 'Not in side selection phase' };
  }
  return { valid: true };
}

function validateAutoDeploy(state: GameState): ValidationResult {
  if (state.currentPhase !== 'deployment') {
    return { valid: false, reason: 'Not in deployment phase' };
  }
  if (!state.unplacedUnits || state.unplacedUnits.length === 0) {
    return { valid: false, reason: 'No units to deploy' };
  }
  if (!state.standardGame || !state.deploymentSides) {
    return { valid: false, reason: 'Auto deploy only available in standard game' };
  }
  return { valid: true };
}

function validatePlaceUnit(state: GameState, unitType: import('./types.js').UnitType, position: HexCoord): ValidationResult {
  if (state.currentPhase !== 'deployment') {
    return { valid: false, reason: 'Not in deployment phase' };
  }

  if (!state.unplacedUnits || !state.unplacedUnits.some(u => u.type === unitType)) {
    return { valid: false, reason: 'Unit type not available for placement' };
  }

  // Standard game or hidden deployment: check deployment turn matches unit faction
  if ((state.standardGame || state.hiddenDeployment) && state.deploymentTurn) {
    const unitFaction = getUnitDefinition(unitType).faction;
    if (unitFaction !== state.deploymentTurn) {
      return { valid: false, reason: `It is ${state.deploymentTurn}'s turn to deploy` };
    }
  }

  if (!state.deploymentZone) {
    return { valid: false, reason: 'Position is outside the deployment zone' };
  }

  // Check if position is within the deployment zone (rows + cols, or additionalHexes)
  const inRowCol = state.deploymentZone.rows.includes(position.row) &&
    (!state.deploymentZone.cols || state.deploymentZone.cols.includes(position.col));
  const inAdditional = state.deploymentZone.additionalHexes?.some(
    h => h.col === position.col && h.row === position.row
  ) ?? false;

  if (!inRowCol && !inAdditional) {
    return { valid: false, reason: 'Position is outside the deployment zone' };
  }

  const tile = getTile(state.board, position);
  if (!tile) {
    return { valid: false, reason: 'Position does not exist' };
  }

  if (tile.terrain === 'river' || tile.terrain === 'marsh') {
    return { valid: false, reason: 'Cannot place unit on impassable terrain' };
  }

  // Check if unit type can enter tower
  if (tile.terrain === 'tower') {
    const def = getUnitDefinition(unitType);
    if (def.special?.includes('no_tower')) {
      return { valid: false, reason: 'This unit cannot be placed in the tower' };
    }
  }

  const occupiedHexes = getOccupiedHexes(state);
  if (occupiedHexes.has(coordToKey(position))) {
    return { valid: false, reason: 'Position is already occupied' };
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

  // Just-deployed units can't activate the same turn
  if (state.justDeployedUnitIds?.includes(unitId)) {
    return { valid: false, reason: 'Just-deployed units cannot activate this turn' };
  }

  return { valid: true };
}

function validateMoveUnit(state: GameState, unitId: string, to: HexCoord): ValidationResult {
  if (state.currentPhase === 'ogre_rampage') {
    if (!state.currentOgreSubCard || state.currentOgreSubCard.type !== 'ogre_move') {
      return { valid: false, reason: 'Current ogre sub-card is not a move card' };
    }
  } else if (state.currentPhase === 'cannon_fire') {
    // Cannon can move 1 space instead of firing (only before firing)
    if (state.cannonFireState) {
      return { valid: false, reason: 'Cannot move after initiating cannon fire' };
    }
    const unit = state.units.get(unitId);
    if (!unit || unit.definitionType !== 'mighty_cannon') {
      return { valid: false, reason: 'Only the cannon can move during cannon fire phase' };
    }
  } else if (state.currentPhase !== 'activation') {
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
  const movement = getEffectiveMovement(state, unit.definitionType, def.movement);
  const reachable = getReachableHexes(unit.position, movement, state.board, occupiedHexes);
  const reachableKeys = new Set(reachable.map(coordToKey));
  if (!reachableKeys.has(coordToKey(to))) {
    return { valid: false, reason: 'Target hex is not reachable' };
  }

  return { valid: true };
}

function validateAttack(state: GameState, attackerId: string, defenderId: string): ValidationResult {
  if (state.currentPhase === 'ogre_rampage') {
    if (!state.currentOgreSubCard || state.currentOgreSubCard.type !== 'ogre_attack') {
      return { valid: false, reason: 'Current ogre sub-card is not an attack card' };
    }
  } else if (state.currentPhase !== 'activation') {
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

function validateDrawOgreCard(state: GameState): ValidationResult {
  if (state.currentPhase !== 'ogre_rampage') {
    return { valid: false, reason: 'Not in ogre rampage phase' };
  }
  if (state.currentOgreSubCard !== null) {
    return { valid: false, reason: 'Current ogre sub-card not yet resolved' };
  }
  if (state.ogreSubCardIndex >= state.ogreSubCardsTotal) {
    return { valid: false, reason: 'No more ogre sub-cards to draw' };
  }
  return { valid: true };
}

function validateEndOgreActivation(state: GameState): ValidationResult {
  if (state.currentPhase !== 'ogre_rampage') {
    return { valid: false, reason: 'Not in ogre rampage phase' };
  }
  if (state.currentOgreSubCard === null) {
    return { valid: false, reason: 'No ogre sub-card to end' };
  }
  return { valid: true };
}

function validatePass(state: GameState): ValidationResult {
  // Allow pass during card deployment when player can't place more units
  if (state.currentPhase === 'deployment' && state.cardDeployment) {
    return { valid: true };
  }
  if (state.currentPhase !== 'activation' && state.currentPhase !== 'draw_card' && state.currentPhase !== 'ogre_rampage' && state.currentPhase !== 'cannon_fire') {
    return { valid: false, reason: 'Cannot pass in current phase' };
  }
  return { valid: true };
}

// ─── Cannon Fire Validators ────────────────────────────────────

function validateFireCannon(state: GameState, targetCoord: HexCoord): ValidationResult {
  if (state.currentPhase !== 'cannon_fire') {
    return { valid: false, reason: 'Not in cannon fire phase' };
  }
  if (state.cannonFireState) {
    return { valid: false, reason: 'Cannon fire already in progress' };
  }

  const cannon = state.units.get(state.selectedUnitId!);
  if (!cannon) {
    return { valid: false, reason: 'Cannon not found' };
  }

  const distance = hexDistance(cannon.position, targetCoord);
  if (distance < 1 || distance > 8) {
    return { valid: false, reason: 'Target out of range (1-8)' };
  }

  // Target must have an enemy unit
  let hasEnemy = false;
  for (const [, unit] of state.units) {
    if (unit.faction !== cannon.faction && coordToKey(unit.position) === coordToKey(targetCoord)) {
      hasEnemy = true;
      break;
    }
  }
  if (!hasEnemy) {
    return { valid: false, reason: 'No enemy unit at target' };
  }

  return { valid: true };
}

function validateSelectCannonPath(state: GameState, _path: HexCoord[]): ValidationResult {
  if (state.currentPhase !== 'cannon_fire') {
    return { valid: false, reason: 'Not in cannon fire phase' };
  }
  if (!state.cannonFireState) {
    return { valid: false, reason: 'No cannon fire in progress' };
  }
  if (state.cannonFireState.path.length > 0) {
    return { valid: false, reason: 'Path already selected' };
  }
  if (state.cannonFireState.resolved) {
    return { valid: false, reason: 'Cannon fire already resolved' };
  }
  return { valid: true };
}

function validateDrawCannonTile(state: GameState): ValidationResult {
  if (state.currentPhase !== 'cannon_fire') {
    return { valid: false, reason: 'Not in cannon fire phase' };
  }
  if (!state.cannonFireState) {
    return { valid: false, reason: 'No cannon fire in progress' };
  }
  if (state.cannonFireState.path.length === 0 && !state.cannonFireState.adjacentShot) {
    return { valid: false, reason: 'Path not yet selected' };
  }
  if (state.cannonFireState.resolved) {
    return { valid: false, reason: 'Cannon fire already resolved' };
  }
  if (state.cannonFireState.tileIndex >= state.cannonFireState.tileDeck.length) {
    return { valid: false, reason: 'No more tiles to draw' };
  }
  return { valid: true };
}

function validateEndCannonFire(state: GameState): ValidationResult {
  if (state.currentPhase !== 'cannon_fire') {
    return { valid: false, reason: 'Not in cannon fire phase' };
  }
  return { valid: true };
}

// ─── Helper ────────────────────────────────────────────────────

/** Check if a unit has an adjacent enemy (engaged in hand-to-hand combat).
 *  Enemies separated by a fortified ditch edge don't count as engaging. */
export function isEngagedInMelee(state: GameState, unit: Unit): boolean {
  for (const [, other] of state.units) {
    if (other.faction === unit.faction) continue;
    if (hexDistance(unit.position, other.position) === 1) {
      // Fortified ditch edges block melee engagement
      if (isFortifiedEdge(state.board, unit.position, other.position)) continue;
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
  const movement = getEffectiveMovement(state, unit.definitionType, def.movement);
  const reachable = getReachableHexes(unit.position, movement, state.board, occupiedHexes);

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
