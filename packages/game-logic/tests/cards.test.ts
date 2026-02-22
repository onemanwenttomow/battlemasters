import { describe, it, expect } from 'vitest';
import { createBattleDeck, shuffleDeck, drawCard, createRNG, reshuffleDeck } from '../src/cards';

describe('createBattleDeck', () => {
  it('creates a deck of cards', () => {
    const deck = createBattleDeck();
    expect(deck.length).toBeGreaterThan(0);
  });

  it('has cards for both factions', () => {
    const deck = createBattleDeck();
    const imperialCards = deck.filter(c => c.faction === 'imperial');
    const chaosCards = deck.filter(c => c.faction === 'chaos');
    expect(imperialCards.length).toBeGreaterThan(0);
    expect(chaosCards.length).toBeGreaterThan(0);
  });

  it('has unique card IDs', () => {
    const deck = createBattleDeck();
    const ids = deck.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has special cards', () => {
    const deck = createBattleDeck();
    const specials = deck.filter(c => c.special);
    expect(specials.length).toBeGreaterThan(0);
    expect(specials.some(c => c.special === 'ALL_MOVE')).toBe(true);
    expect(specials.some(c => c.special === 'CANNON_FIRE')).toBe(true);
    expect(specials.some(c => c.special === 'OGRE_RAMPAGE')).toBe(true);
    expect(specials.some(c => c.special === 'CHARGE')).toBe(true);
    expect(specials.some(c => c.special === 'WOLF_RIDER_DOUBLE_MOVE')).toBe(true);
  });
});

describe('shuffleDeck', () => {
  it('maintains deck size', () => {
    const deck = createBattleDeck();
    const rng = createRNG(42);
    const shuffled = shuffleDeck(deck, rng);
    expect(shuffled.length).toBe(deck.length);
  });

  it('is deterministic with same seed', () => {
    const deck = createBattleDeck();
    const s1 = shuffleDeck(deck, createRNG(42));
    const s2 = shuffleDeck(deck, createRNG(42));
    expect(s1.map(c => c.id)).toEqual(s2.map(c => c.id));
  });

  it('changes order with different seeds', () => {
    const deck = createBattleDeck();
    const s1 = shuffleDeck(deck, createRNG(42));
    const s2 = shuffleDeck(deck, createRNG(99));
    // Very unlikely to be the same
    const same = s1.every((c, i) => c.id === s2[i].id);
    expect(same).toBe(false);
  });
});

describe('drawCard', () => {
  it('draws the top card', () => {
    const deck = createBattleDeck();
    const [card, remaining] = drawCard(deck);
    expect(card).toBe(deck[0]);
    expect(remaining.length).toBe(deck.length - 1);
  });

  it('returns null from empty deck', () => {
    const [card, remaining] = drawCard([]);
    expect(card).toBeNull();
    expect(remaining).toHaveLength(0);
  });
});

describe('createRNG', () => {
  it('produces values between 0 and 1', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic', () => {
    const r1 = createRNG(42);
    const r2 = createRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(r1()).toBe(r2());
    }
  });
});
