import { describe, it, expect } from 'vitest';
import { rollDie, rollDice, countHits, countBlocks, resolveCombat } from '../src/combat';
import { createUnit, resetUnitIdCounter } from '../src/units';
import { createRNG } from '../src/cards';

describe('dice rolling', () => {
  it('rollDie returns valid face', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      const result = rollDie(rng);
      expect(['skull', 'blank', 'shield']).toContain(result);
    }
  });

  it('rollDice returns correct count', () => {
    const rng = createRNG(42);
    expect(rollDice(3, rng)).toHaveLength(3);
    expect(rollDice(5, rng)).toHaveLength(5);
    expect(rollDice(0, rng)).toHaveLength(0);
  });

  it('dice distribution is roughly correct (3 skull, 2 blank, 1 shield)', () => {
    const rng = createRNG(12345);
    let skulls = 0, blanks = 0, shields = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const r = rollDie(rng);
      if (r === 'skull') skulls++;
      else if (r === 'blank') blanks++;
      else shields++;
    }
    // Expected: 50% skull, 33% blank, 17% shield (roughly)
    expect(skulls / n).toBeCloseTo(0.5, 1);
    expect(blanks / n).toBeCloseTo(0.333, 1);
    expect(shields / n).toBeCloseTo(0.167, 1);
  });
});

describe('countHits / countBlocks', () => {
  it('counts skulls as hits', () => {
    expect(countHits(['skull', 'skull', 'blank', 'shield'])).toBe(2);
  });

  it('counts shields as blocks', () => {
    expect(countBlocks(['shield', 'shield', 'skull', 'blank'])).toBe(2);
  });

  it('handles empty arrays', () => {
    expect(countHits([])).toBe(0);
    expect(countBlocks([])).toBe(0);
  });
});

describe('resolveCombat', () => {
  it('produces a valid combat result', () => {
    resetUnitIdCounter();
    const attacker = createUnit('chaos_warrior', { col: 5, row: 5 });
    const defender = createUnit('men_at_arms', { col: 5, row: 4 });
    const rng = createRNG(42);

    const result = resolveCombat(attacker, defender, rng);

    expect(result.attackerId).toBe(attacker.id);
    expect(result.defenderId).toBe(defender.id);
    expect(result.attackerRolls.length).toBe(4); // chaos_warrior combatValue = 4
    expect(result.defenderRolls.length).toBe(3); // men_at_arms combatValue = 3
    expect(result.hits).toBeGreaterThanOrEqual(0);
    expect(result.blocks).toBeGreaterThanOrEqual(0);
    expect(result.damage).toBe(Math.max(0, result.hits - result.blocks));
  });

  it('is deterministic with same seed', () => {
    resetUnitIdCounter();
    const a1 = createUnit('chaos_warrior', { col: 5, row: 5 });
    const d1 = createUnit('men_at_arms', { col: 5, row: 4 });

    resetUnitIdCounter();
    const a2 = createUnit('chaos_warrior', { col: 5, row: 5 });
    const d2 = createUnit('men_at_arms', { col: 5, row: 4 });

    const r1 = resolveCombat(a1, d1, createRNG(99));
    const r2 = resolveCombat(a2, d2, createRNG(99));

    expect(r1.attackerRolls).toEqual(r2.attackerRolls);
    expect(r1.defenderRolls).toEqual(r2.defenderRolls);
    expect(r1.damage).toBe(r2.damage);
  });

  it('applies tower defense bonus', () => {
    resetUnitIdCounter();
    const attacker = createUnit('chaos_warrior', { col: 6, row: 4 });
    const defender = createUnit('men_at_arms', { col: 7, row: 4 });
    const rng = createRNG(42);

    const result = resolveCombat(attacker, defender, rng, {
      attackerTerrain: 'plain',
      defenderTerrain: 'tower',
    });

    // Defender should have 4 dice (3 combatValue + 1 tower bonus)
    expect(result.defenderRolls.length).toBe(4);
    // Attacker should have 3 dice (4 combatValue - 1 tower penalty)
    expect(result.attackerRolls.length).toBe(3);
  });
});
