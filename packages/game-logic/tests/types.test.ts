import { describe, it, expect } from 'vitest';
import { coordToKey, keyToCoord } from '../src/types';

describe('types', () => {
  it('coordToKey converts coord to string', () => {
    expect(coordToKey({ col: 3, row: 7 })).toBe('3,7');
  });

  it('keyToCoord converts string to coord', () => {
    expect(keyToCoord('3,7')).toEqual({ col: 3, row: 7 });
  });

  it('roundtrips correctly', () => {
    const coord = { col: 14, row: 11 };
    expect(keyToCoord(coordToKey(coord))).toEqual(coord);
  });
});
