import { describe, it, expect } from 'vitest';
import { createDefaultBoard, getDitchAttackModifier, getDitchDefenseModifier } from '../src/board';
import { getReachableHexes, isHedgeEdge } from '../src/hex';
import { coordToKey, edgeKey, HexCoord, BoardState, HexTile, GameState } from '../src/types';
import { isEngagedInMelee } from '../src/validation';
import { createUnit, resetUnitIdCounter } from '../src/units';

/** Create a minimal board with a hedge on a specific edge */
function createBoardWithHedge(a: HexCoord, b: HexCoord): BoardState {
  const tiles = new Map<string, HexTile>();
  // Create a 5x5 area of plain tiles
  for (let row = 0; row <= 8; row++) {
    for (let col = 0; col <= 8; col++) {
      const coord = { col, row };
      tiles.set(coordToKey(coord), {
        coord,
        terrain: 'plain',
        elevation: 0,
      });
    }
  }
  const hedges = new Set<string>();
  hedges.add(edgeKey(a, b));
  return { width: 9, height: 9, tiles, hedges };
}

describe('hedges on default board', () => {
  const board = createDefaultBoard();

  it('has 2 hedges', () => {
    expect(board.hedges.size).toBe(2);
  });

  it('has a hedge between (4,5) and (4,4)', () => {
    expect(board.hedges.has(edgeKey({ col: 4, row: 5 }, { col: 4, row: 4 }))).toBe(true);
  });

  it('has a hedge between (10,4) and (10,5)', () => {
    expect(board.hedges.has(edgeKey({ col: 10, row: 4 }, { col: 10, row: 5 }))).toBe(true);
  });
});

describe('edgeKey canonical ordering', () => {
  it('produces the same key regardless of argument order', () => {
    const a = { col: 4, row: 5 };
    const b = { col: 4, row: 4 };
    expect(edgeKey(a, b)).toBe(edgeKey(b, a));
  });
});

describe('isHedgeEdge', () => {
  const a = { col: 4, row: 4 };
  const b = { col: 4, row: 5 };
  const board = createBoardWithHedge(a, b);

  it('detects hedge from a to b', () => {
    expect(isHedgeEdge(board, a, b)).toBe(true);
  });

  it('detects hedge from b to a', () => {
    expect(isHedgeEdge(board, b, a)).toBe(true);
  });

  it('returns false for edge without hedge', () => {
    expect(isHedgeEdge(board, { col: 3, row: 3 }, { col: 4, row: 3 })).toBe(false);
  });
});

describe('hedge blocks movement', () => {
  const a = { col: 4, row: 4 };
  const b = { col: 4, row: 5 };
  const board = createBoardWithHedge(a, b);

  it('cannot move across hedge edge (a to b)', () => {
    const reachable = getReachableHexes(a, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    expect(keys).not.toContain(coordToKey(b));
  });

  it('cannot move across hedge edge (b to a)', () => {
    const reachable = getReachableHexes(b, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    expect(keys).not.toContain(coordToKey(a));
  });

  it('can move to other adjacent hexes (not blocked by hedge)', () => {
    const reachable = getReachableHexes(a, 1, board);
    // Should have 5 neighbors reachable (6 total neighbors minus 1 blocked by hedge)
    expect(reachable.length).toBe(5);
  });
});

describe('hedge does NOT block melee engagement', () => {
  it('units can engage in melee across a hedge', () => {
    resetUnitIdCounter();
    const a = { col: 4, row: 4 };
    const b = { col: 4, row: 5 };
    const board = createBoardWithHedge(a, b);

    const attacker = createUnit('men_at_arms', a);
    const defender = createUnit('goblin', b);

    const units = new Map();
    units.set(attacker.id, attacker);
    units.set(defender.id, defender);

    const state = {
      board,
      units,
    } as GameState;

    expect(isEngagedInMelee(state, attacker)).toBe(true);
  });
});

describe('hedge does NOT affect combat modifiers', () => {
  it('no attack or defense modifier from hedges', () => {
    // Hedges have no combat effect — they only block movement.
    // The getDitchAttackModifier and getDitchDefenseModifier functions
    // should return 0 for non-ditch terrain, confirming hedges don't interfere.
    const a = { col: 4, row: 4 };
    const b = { col: 4, row: 5 };
    const board = createBoardWithHedge(a, b);

    expect(getDitchAttackModifier(board, a, b, 'men_at_arms')).toBe(0);
    expect(getDitchDefenseModifier(board, a, b)).toBe(0);
  });
});
