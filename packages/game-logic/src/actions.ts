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
