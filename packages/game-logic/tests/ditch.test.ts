import { describe, it, expect } from 'vitest';
import { createDefaultBoard, getTile, getDitchAttackModifier, getDitchDefenseModifier } from '../src/board';
import { getNeighborDirection, isFortifiedEdge, getReachableHexes } from '../src/hex';
import { getCombatDiceCounts } from '../src/combat';
import { createUnit, resetUnitIdCounter } from '../src/units';
import { coordToKey, HexCoord, BoardState, HexTile } from '../src/types';

// Helper: create a minimal board with a single ditch tile
function createBoardWithDitch(ditchCoord: HexCoord, orientation: number): BoardState {
  const tiles = new Map<string, HexTile>();
  // Create a 5x5 area of plain tiles around the ditch
  for (let row = ditchCoord.row - 2; row <= ditchCoord.row + 2; row++) {
    for (let col = ditchCoord.col - 2; col <= ditchCoord.col + 2; col++) {
      const coord = { col, row };
      const isDitch = col === ditchCoord.col && row === ditchCoord.row;
      tiles.set(coordToKey(coord), {
        coord,
        terrain: isDitch ? 'ditch' : 'plain',
        elevation: 0,
        ...(isDitch ? { orientation } : {}),
      });
    }
  }
  return { width: 15, height: 12, tiles };
}

describe('ditch on default board', () => {
  const board = createDefaultBoard();

  it('has a ditch tile at (8,5)', () => {
    const tile = getTile(board, { col: 8, row: 5 });
    expect(tile?.terrain).toBe('ditch');
  });

  it('ditch at (8,5) has orientation 1 (NE+NW open)', () => {
    const tile = getTile(board, { col: 8, row: 5 });
    expect(tile?.orientation).toBe(1);
  });
});

describe('getNeighborDirection', () => {
  it('returns correct direction for E neighbor (even row)', () => {
    // Even row (row 4): E neighbor is col+1, row+0
    expect(getNeighborDirection({ col: 5, row: 4 }, { col: 6, row: 4 })).toBe(0);
  });

  it('returns correct direction for W neighbor', () => {
    expect(getNeighborDirection({ col: 5, row: 4 }, { col: 4, row: 4 })).toBe(3);
  });

  it('returns -1 for non-adjacent hex', () => {
    expect(getNeighborDirection({ col: 5, row: 4 }, { col: 7, row: 4 })).toBe(-1);
  });
});

describe('isFortifiedEdge — orientation 0 (E+NE open)', () => {
  // Ditch at (5,4) even row. Open dirs: E(0) and NE(1). Fortified: NW(2), W(3), SW(4), SE(5)
  const board = createBoardWithDitch({ col: 5, row: 4 }, 0);

  it('E edge is open', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 4 })).toBe(false);
  });

  it('NE edge is open', () => {
    // Even row: NE neighbor is col+1, row-1
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 3 })).toBe(false);
  });

  it('NW edge is fortified', () => {
    // Even row: NW neighbor is col+0, row-1
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 5, row: 3 })).toBe(true);
  });

  it('W edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 4, row: 4 })).toBe(true);
  });

  it('SW edge is fortified', () => {
    // Even row: SW neighbor is col+0, row+1
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 5, row: 5 })).toBe(true);
  });

  it('SE edge is fortified', () => {
    // Even row: SE neighbor is col+1, row+1
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 5 })).toBe(true);
  });

  it('approaching ditch from fortified side is also fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 3 }, { col: 5, row: 4 })).toBe(true);
  });

  it('approaching ditch from open side is not fortified', () => {
    expect(isFortifiedEdge(board, { col: 6, row: 4 }, { col: 5, row: 4 })).toBe(false);
  });
});

describe('isFortifiedEdge — orientation 1 (NE+NW open)', () => {
  const board = createBoardWithDitch({ col: 5, row: 4 }, 1);

  it('NE edge is open', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 3 })).toBe(false);
  });

  it('NW edge is open', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 5, row: 3 })).toBe(false);
  });

  it('E edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 4 })).toBe(true);
  });

  it('W edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 4, row: 4 })).toBe(true);
  });

  it('SW edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 5, row: 5 })).toBe(true);
  });

  it('SE edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 5 })).toBe(true);
  });
});

describe('isFortifiedEdge — orientation 3 (W+SW open)', () => {
  const board = createBoardWithDitch({ col: 5, row: 4 }, 3);

  it('W edge is open', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 4, row: 4 })).toBe(false);
  });

  it('SW edge is open', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 5, row: 5 })).toBe(false);
  });

  it('E edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 4 })).toBe(true);
  });

  it('NE edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 3 })).toBe(true);
  });

  it('NW edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 5, row: 3 })).toBe(true);
  });

  it('SE edge is fortified', () => {
    expect(isFortifiedEdge(board, { col: 5, row: 4 }, { col: 6, row: 5 })).toBe(true);
  });
});

describe('ditch movement blocking', () => {
  const ditchCoord = { col: 5, row: 4 };
  const board = createBoardWithDitch(ditchCoord, 0); // E+NE open

  it('can enter ditch from open side (E)', () => {
    const reachable = getReachableHexes({ col: 6, row: 4 }, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    expect(keys).toContain(coordToKey(ditchCoord));
  });

  it('can enter ditch from open side (NE)', () => {
    const reachable = getReachableHexes({ col: 6, row: 3 }, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    expect(keys).toContain(coordToKey(ditchCoord));
  });

  it('cannot enter ditch from fortified side (W)', () => {
    const reachable = getReachableHexes({ col: 4, row: 4 }, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    expect(keys).not.toContain(coordToKey(ditchCoord));
  });

  it('cannot enter ditch from fortified side (NW)', () => {
    const reachable = getReachableHexes({ col: 5, row: 3 }, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    expect(keys).not.toContain(coordToKey(ditchCoord));
  });

  it('cannot exit ditch through fortified side', () => {
    const reachable = getReachableHexes(ditchCoord, 1, board);
    const keys = reachable.map(c => coordToKey(c));
    // Should be able to reach E and NE (open), but not others (fortified)
    expect(keys).toContain(coordToKey({ col: 6, row: 4 })); // E - open
    expect(keys).toContain(coordToKey({ col: 6, row: 3 })); // NE - open
    expect(keys).not.toContain(coordToKey({ col: 4, row: 4 })); // W - fortified
    expect(keys).not.toContain(coordToKey({ col: 5, row: 3 })); // NW - fortified
  });
});

describe('ditch combat modifiers', () => {
  const ditchCoord = { col: 5, row: 4 };
  const board = createBoardWithDitch(ditchCoord, 0); // E+NE open

  it('attacker gets -1 die across fortified edge', () => {
    // Attack from NW (fortified) into ditch
    expect(getDitchAttackModifier(
      board, { col: 5, row: 3 }, ditchCoord, 'chaos_warrior',
    )).toBe(-1);
  });

  it('defender in ditch gets +1 die', () => {
    expect(getDitchDefenseModifier(
      board, { col: 5, row: 3 }, ditchCoord,
    )).toBe(1);
  });

  it('no attack modifier across open edge', () => {
    // Attack from E (open)
    expect(getDitchAttackModifier(
      board, { col: 6, row: 4 }, ditchCoord, 'chaos_warrior',
    )).toBe(0);
  });

  it('defender in ditch always gets +1 defense even from open edge', () => {
    expect(getDitchDefenseModifier(
      board, { col: 6, row: 4 }, ditchCoord,
    )).toBe(1);
  });

  it('ranged unit (archer) gets no attack penalty across fortified edge', () => {
    expect(getDitchAttackModifier(
      board, { col: 5, row: 3 }, ditchCoord, 'archer',
    )).toBe(0);
  });

  it('ranged unit (crossbowman) gets no attack penalty across fortified edge', () => {
    expect(getDitchAttackModifier(
      board, { col: 5, row: 3 }, ditchCoord, 'crossbowman',
    )).toBe(0);
  });

  it('ranged unit (chaos_bowman) gets no attack penalty across fortified edge', () => {
    expect(getDitchAttackModifier(
      board, { col: 5, row: 3 }, ditchCoord, 'chaos_bowman',
    )).toBe(0);
  });

  it('getCombatDiceCounts applies ditch modifiers', () => {
    resetUnitIdCounter();
    const attacker = createUnit('chaos_warrior', { col: 5, row: 3 }); // CV 4
    const defender = createUnit('men_at_arms', ditchCoord); // CV 3

    const { attackDice, defenseDice } = getCombatDiceCounts(attacker, defender, {
      attackerTerrain: 'plain',
      defenderTerrain: 'ditch',
      distance: 1,
      ditchAttackModifier: -1,
      ditchDefenseModifier: 1,
    });

    expect(attackDice).toBe(3);  // 4 - 1 ditch penalty
    expect(defenseDice).toBe(4); // 3 + 1 ditch defense
  });

  it('getCombatDiceCounts no ditch penalty for ranged type', () => {
    resetUnitIdCounter();
    const attacker = createUnit('archer', { col: 5, row: 3 }); // CV 3, ranged
    const defender = createUnit('goblin', ditchCoord); // CV 2

    // Ranged attacker: ditchAttackModifier should be 0 (computed upstream)
    const { attackDice, defenseDice } = getCombatDiceCounts(attacker, defender, {
      attackerTerrain: 'plain',
      defenderTerrain: 'ditch',
      distance: 1,
      ditchAttackModifier: 0, // ranged exemption applied by getDitchAttackModifier
      ditchDefenseModifier: 1,
    });

    // archer at range 1 gets -1 for ranged melee penalty, but no ditch penalty
    expect(attackDice).toBe(2);  // 3 - 1 ranged melee penalty
    expect(defenseDice).toBe(3); // 2 + 1 ditch defense
  });
});

describe('ditch not on restricted terrain', () => {
  it('ditch at (8,5) is not on a river or road', () => {
    const board = createDefaultBoard();
    const tile = getTile(board, { col: 8, row: 5 });
    expect(tile?.terrain).toBe('ditch');
    // Confirm surrounding tiles are not river
    expect(getTile(board, { col: 7, row: 5 })?.terrain).not.toBe('river');
  });
});
