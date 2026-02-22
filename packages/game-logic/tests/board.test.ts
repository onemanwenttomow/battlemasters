import { describe, it, expect } from 'vitest';
import { createDefaultBoard, getTile, isImpassable, getDefenseModifier, getAttackModifier, BOARD_WIDTH, BOARD_HEIGHT } from '../src/board';
import { coordToKey } from '../src/types';

describe('createDefaultBoard', () => {
  const board = createDefaultBoard();

  it('has correct dimensions', () => {
    expect(board.width).toBe(13);
    expect(board.height).toBe(12);
  });

  it('has correct tile count (6 even rows × 12 + 6 odd rows × 13 = 150)', () => {
    expect(board.tiles.size).toBe(150);
  });

  it('has river hexes in rows 2-3', () => {
    const riverTiles = [...board.tiles.values()].filter(t => t.terrain === 'river');
    expect(riverTiles.length).toBeGreaterThan(0);
    for (const tile of riverTiles) {
      expect([2, 3]).toContain(tile.coord.row);
    }
  });

  it('has fords where roads cross the river', () => {
    const fords = [...board.tiles.values()].filter(t => t.terrain === 'ford');
    expect(fords.length).toBeGreaterThan(0);
    // All fords should be in river rows
    for (const ford of fords) {
      expect([2, 3]).toContain(ford.coord.row);
    }
  });

  it('has a tower at col 5, row 2', () => {
    expect(getTile(board, { col: 5, row: 2 })?.terrain).toBe('tower');
  });

  it('has marsh tiles', () => {
    const marshTiles = [...board.tiles.values()].filter(t => t.terrain === 'marsh');
    expect(marshTiles.length).toBe(2);
  });

  it('has a ditch at col 6, row 5', () => {
    expect(getTile(board, { col: 6, row: 5 })?.terrain).toBe('ditch');
  });
});

describe('terrain helpers', () => {
  it('river is impassable', () => {
    expect(isImpassable('river')).toBe(true);
  });

  it('marsh is impassable', () => {
    expect(isImpassable('marsh')).toBe(true);
  });

  it('plain is passable', () => {
    expect(isImpassable('plain')).toBe(false);
  });

  it('ford is passable', () => {
    expect(isImpassable('ford')).toBe(false);
  });

  it('tower gives defense bonus', () => {
    expect(getDefenseModifier('tower')).toBe(1);
  });

  it('tower penalizes attackers', () => {
    expect(getAttackModifier('tower')).toBe(-1);
  });

  it('plain has no modifiers', () => {
    expect(getDefenseModifier('plain')).toBe(0);
    expect(getAttackModifier('plain')).toBe(0);
  });
});
