import { describe, it, expect } from 'vitest';
import {
  offsetToCube,
  cubeToOffset,
  hexToWorld,
  worldToHex,
  getNeighbors,
  hexDistance,
  isInBounds,
  getReachableHexes,
  getHexesInRange,
  lineOfSight,
} from '../src/hex';
import { coordToKey } from '../src/types';
import { createDefaultBoard } from '../src/board';

describe('offsetToCube / cubeToOffset', () => {
  it('roundtrips for origin', () => {
    const coord = { col: 0, row: 0 };
    expect(cubeToOffset(offsetToCube(coord))).toEqual(coord);
  });

  it('roundtrips for various coordinates', () => {
    const coords = [
      { col: 0, row: 0 },
      { col: 3, row: 4 },
      { col: 7, row: 11 },
      { col: 12, row: 0 },
      { col: 1, row: 1 },
    ];
    for (const coord of coords) {
      expect(cubeToOffset(offsetToCube(coord))).toEqual(coord);
    }
  });
});

describe('hexToWorld / worldToHex', () => {
  it('origin maps to shifted position (even-r: row 0 shifts right)', () => {
    const world = hexToWorld({ col: 0, row: 0 });
    // Row 0 is even → shifted right by 0.5 hex widths
    expect(world.x).toBeCloseTo(Math.sqrt(3) * 0.5);
    expect(world.z).toBeCloseTo(0);
  });

  it('roundtrips world → hex → world', () => {
    const testCoords = [
      { col: 0, row: 0 },
      { col: 5, row: 3 },
      { col: 7, row: 6 },
      { col: 11, row: 11 },
    ];
    for (const coord of testCoords) {
      const world = hexToWorld(coord);
      const back = worldToHex(world.x, world.z);
      expect(back).toEqual(coord);
    }
  });
});

describe('getNeighbors', () => {
  it('returns 6 neighbors', () => {
    const neighbors = getNeighbors({ col: 5, row: 5 });
    expect(neighbors).toHaveLength(6);
  });

  it('returns correct neighbors for even row', () => {
    const neighbors = getNeighbors({ col: 2, row: 4 });
    expect(neighbors).toHaveLength(6);
    const keys = neighbors.map(coordToKey);
    expect(new Set(keys).size).toBe(6);
  });

  it('returns correct neighbors for odd row', () => {
    const neighbors = getNeighbors({ col: 3, row: 3 });
    expect(neighbors).toHaveLength(6);
    const keys = neighbors.map(coordToKey);
    expect(new Set(keys).size).toBe(6);
  });

  it('neighbors are all distance 1 from center', () => {
    const center = { col: 6, row: 6 };
    const neighbors = getNeighbors(center);
    for (const n of neighbors) {
      expect(hexDistance(center, n)).toBe(1);
    }
  });
});

describe('hexDistance', () => {
  it('distance to self is 0', () => {
    expect(hexDistance({ col: 5, row: 5 }, { col: 5, row: 5 })).toBe(0);
  });

  it('adjacent hexes have distance 1', () => {
    const center = { col: 5, row: 5 };
    const neighbors = getNeighbors(center);
    for (const n of neighbors) {
      expect(hexDistance(center, n)).toBe(1);
    }
  });

  it('distance is symmetric', () => {
    const a = { col: 2, row: 3 };
    const b = { col: 8, row: 7 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });

  it('calculates known distances correctly', () => {
    expect(hexDistance({ col: 0, row: 0 }, { col: 3, row: 0 })).toBe(3);
  });
});

describe('isInBounds', () => {
  it('accepts valid coordinates', () => {
    expect(isInBounds({ col: 0, row: 0 }, 13, 12)).toBe(true);
    expect(isInBounds({ col: 12, row: 11 }, 13, 12)).toBe(true);
    expect(isInBounds({ col: 6, row: 6 }, 13, 12)).toBe(true);
  });

  it('rejects out-of-bounds coordinates', () => {
    expect(isInBounds({ col: -1, row: 0 }, 13, 12)).toBe(false);
    expect(isInBounds({ col: 13, row: 0 }, 13, 12)).toBe(false);
    expect(isInBounds({ col: 0, row: 12 }, 13, 12)).toBe(false);
    expect(isInBounds({ col: 0, row: -1 }, 13, 12)).toBe(false);
  });
});

describe('getReachableHexes', () => {
  it('returns empty for range 0', () => {
    const board = createDefaultBoard();
    const result = getReachableHexes({ col: 6, row: 7 }, 0, board);
    expect(result).toHaveLength(0);
  });

  it('returns neighbors for range 1 on open terrain', () => {
    const board = createDefaultBoard();
    const from = { col: 6, row: 7 };
    const result = getReachableHexes(from, 1, board);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(6);
    for (const r of result) {
      expect(hexDistance(from, r)).toBe(1);
    }
  });

  it('does not include river hexes', () => {
    const board = createDefaultBoard();
    const result = getReachableHexes({ col: 5, row: 1 }, 3, board);
    for (const hex of result) {
      const tile = board.tiles.get(coordToKey(hex));
      expect(tile?.terrain).not.toBe('river');
    }
  });

  it('can reach fords', () => {
    const board = createDefaultBoard();
    // Ford at col 4, row 2 — approach from row 1
    const result = getReachableHexes({ col: 4, row: 1 }, 2, board);
    const keys = result.map(coordToKey);
    expect(keys).toContain(coordToKey({ col: 4, row: 2 }));
  });
});

describe('getHexesInRange', () => {
  it('returns correct count for range 1', () => {
    const result = getHexesInRange({ col: 6, row: 6 }, 1, 13, 12);
    expect(result).toHaveLength(6);
  });

  it('all results are within specified distance', () => {
    const center = { col: 6, row: 6 };
    const result = getHexesInRange(center, 3, 13, 12);
    for (const hex of result) {
      expect(hexDistance(center, hex)).toBeLessThanOrEqual(3);
      expect(hexDistance(center, hex)).toBeGreaterThan(0);
    }
  });

  it('clips to board bounds', () => {
    const result = getHexesInRange({ col: 0, row: 0 }, 2, 13, 12);
    for (const hex of result) {
      expect(isInBounds(hex, 13, 12)).toBe(true);
    }
  });
});

describe('lineOfSight', () => {
  it('adjacent hexes always have LOS', () => {
    const board = createDefaultBoard();
    expect(lineOfSight({ col: 5, row: 3 }, { col: 6, row: 3 }, board)).toBe(true);
  });

  it('LOS is blocked by tower', () => {
    const board = createDefaultBoard();
    // Tower is at 5,2 — shoot through it
    const from = { col: 3, row: 2 };
    const to = { col: 7, row: 2 };
    expect(lineOfSight(from, to, board)).toBe(false);
  });

  it('clear LOS across open terrain', () => {
    const board = createDefaultBoard();
    expect(lineOfSight({ col: 3, row: 7 }, { col: 9, row: 7 }, board)).toBe(true);
  });
});
