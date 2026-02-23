import { GameAction, HexCoord } from './types.js';

/** Create a START_GAME action */
export function startGame(): GameAction {
  return { type: 'START_GAME' };
}

/** Create a DRAW_CARD action */
export function drawCardAction(): GameAction {
  return { type: 'DRAW_CARD' };
}

/** Create a SELECT_UNIT action */
export function selectUnit(unitId: string): GameAction {
  return { type: 'SELECT_UNIT', unitId };
}

/** Create a MOVE_UNIT action */
export function moveUnit(unitId: string, to: HexCoord): GameAction {
  return { type: 'MOVE_UNIT', unitId, to };
}

/** Create an ATTACK action */
export function attack(attackerId: string, defenderId: string): GameAction {
  return { type: 'ATTACK', attackerId, defenderId };
}

/** Create an END_ACTIVATION action */
export function endActivation(): GameAction {
  return { type: 'END_ACTIVATION' };
}

/** Create a PASS action */
export function pass(): GameAction {
  return { type: 'PASS' };
}

/** Create a FIRE_CANNON action */
export function fireCannon(targetCoord: HexCoord): GameAction {
  return { type: 'FIRE_CANNON', targetCoord };
}

/** Create a SELECT_CANNON_PATH action */
export function selectCannonPath(path: HexCoord[]): GameAction {
  return { type: 'SELECT_CANNON_PATH', path };
}

/** Create a DRAW_CANNON_TILE action */
export function drawCannonTile(): GameAction {
  return { type: 'DRAW_CANNON_TILE' };
}

/** Create an END_CANNON_FIRE action */
export function endCannonFire(): GameAction {
  return { type: 'END_CANNON_FIRE' };
}
