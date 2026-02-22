import { describe, it, expect, beforeEach } from 'vitest';
import { createUnit, resetUnitIdCounter, getUnitDefinition } from '../src/units';
import { createDefaultBoard } from '../src/board';
import { resolveCombat } from '../src/combat';
import { getValidAttackTargets, isEngagedInMelee, validateAction } from '../src/validation';
import { hexDistance } from '../src/hex';
import { GameState, Unit, coordToKey } from '../src/types';
import { createRNG } from '../src/cards';

function makeState(units: Unit[]): GameState {
  const board = createDefaultBoard();
  const unitMap = new Map<string, Unit>();
  for (const u of units) {
    unitMap.set(u.id, u);
  }
  return {
    board,
    units: unitMap,
    currentPhase: 'activation',
    activeFaction: 'imperial',
    battleDeck: [],
    discardPile: [],
    currentCard: { id: 'test', faction: 'imperial', unitTypes: ['archer', 'crossbowman', 'men_at_arms'], count: 3 },
    combatLog: [],
    turnNumber: 1,
    winner: null,
    selectedUnitId: null,
    activatedUnitIds: [],
    seed: 42,
  };
}

describe('ranged attack rules', () => {
  beforeEach(() => {
    resetUnitIdCounter();
  });

  describe('archer range', () => {
    it('archer can attack at distance 2', () => {
      const archer = createUnit('archer', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 6 });
      const state = makeState([archer, enemy]);
      state.selectedUnitId = archer.id;

      const dist = hexDistance(archer.position, enemy.position);
      expect(dist).toBe(2);

      const targets = getValidAttackTargets(state, archer.id);
      expect(targets).toContain(enemy.id);
    });

    it('archer cannot attack at distance 3', () => {
      const archer = createUnit('archer', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 7 });
      const state = makeState([archer, enemy]);
      state.selectedUnitId = archer.id;

      const dist = hexDistance(archer.position, enemy.position);
      expect(dist).toBe(3);

      const targets = getValidAttackTargets(state, archer.id);
      expect(targets).not.toContain(enemy.id);
    });
  });

  describe('crossbowman range', () => {
    it('crossbowman can attack at distance 3', () => {
      const xbow = createUnit('crossbowman', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 7 });
      const state = makeState([xbow, enemy]);
      state.selectedUnitId = xbow.id;

      const dist = hexDistance(xbow.position, enemy.position);
      expect(dist).toBe(3);

      const targets = getValidAttackTargets(state, xbow.id);
      expect(targets).toContain(enemy.id);
    });

    it('crossbowman cannot attack at distance 4', () => {
      const xbow = createUnit('crossbowman', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 8 });
      const state = makeState([xbow, enemy]);
      state.selectedUnitId = xbow.id;

      const dist = hexDistance(xbow.position, enemy.position);
      expect(dist).toBe(4);

      const targets = getValidAttackTargets(state, xbow.id);
      expect(targets).not.toContain(enemy.id);
    });
  });

  describe('hand-to-hand combat (adjacent)', () => {
    it('archer can attack adjacent enemy (hand-to-hand)', () => {
      const archer = createUnit('archer', { col: 5, row: 5 });
      const enemy = createUnit('orc', { col: 5, row: 6 });

      // Verify they are adjacent
      expect(hexDistance(archer.position, enemy.position)).toBe(1);

      const state = makeState([archer, enemy]);
      state.selectedUnitId = archer.id;

      const targets = getValidAttackTargets(state, archer.id);
      expect(targets).toContain(enemy.id);
    });

    it('ranged unit rolls 1 fewer die in hand-to-hand attack', () => {
      const archer = createUnit('archer', { col: 5, row: 5 });
      const enemy = createUnit('orc', { col: 5, row: 6 });
      const rng = createRNG(42);

      const archerDef = getUnitDefinition('archer');
      expect(archerDef.combatValue).toBe(3);

      // At distance 1 (hand-to-hand), archer should roll combatValue - 1 = 2 dice
      const result = resolveCombat(archer, enemy, rng, {
        attackerTerrain: 'plain',
        defenderTerrain: 'plain',
        distance: 1,
      });
      expect(result.attackerRolls.length).toBe(2); // 3 - 1 = 2
    });

    it('ranged unit defending in hand-to-hand rolls 1 fewer die', () => {
      const enemy = createUnit('orc', { col: 5, row: 5 });
      const archer = createUnit('archer', { col: 5, row: 6 });
      const rng = createRNG(42);

      const result = resolveCombat(enemy, archer, rng, {
        attackerTerrain: 'plain',
        defenderTerrain: 'plain',
        distance: 1,
      });
      // Archer defends with combatValue - 1 = 2 dice
      expect(result.defenderRolls.length).toBe(2); // 3 - 1 = 2
    });

    it('ranged unit at distance > 1 rolls normal dice', () => {
      const archer = createUnit('archer', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 6 });
      const rng = createRNG(42);

      const result = resolveCombat(archer, enemy, rng, {
        attackerTerrain: 'plain',
        defenderTerrain: 'plain',
        distance: 2,
      });
      expect(result.attackerRolls.length).toBe(3); // Normal combatValue
    });
  });

  describe('engaged in melee restriction', () => {
    it('archer with adjacent enemy cannot fire at distant targets', () => {
      const archer = createUnit('archer', { col: 5, row: 5 });
      const adjacentEnemy = createUnit('orc', { col: 5, row: 6 });
      const distantEnemy = createUnit('goblin', { col: 5, row: 7 });

      const state = makeState([archer, adjacentEnemy, distantEnemy]);
      state.selectedUnitId = archer.id;

      const targets = getValidAttackTargets(state, archer.id);
      // Can attack adjacent enemy (hand-to-hand)
      expect(targets).toContain(adjacentEnemy.id);
      // Cannot fire at distant enemy while engaged
      expect(targets).not.toContain(distantEnemy.id);
    });

    it('archer in tower CAN fire at distant targets even while engaged', () => {
      const archer = createUnit('archer', { col: 5, row: 2 }); // Tower at 5,2
      const adjacentEnemy = createUnit('orc', { col: 5, row: 3 });
      const distantEnemy = createUnit('goblin', { col: 5, row: 4 }); // Distance 2, in range

      const state = makeState([archer, adjacentEnemy, distantEnemy]);
      state.selectedUnitId = archer.id;

      const targets = getValidAttackTargets(state, archer.id);
      expect(targets).toContain(adjacentEnemy.id);
      expect(targets).toContain(distantEnemy.id);
    });

    it('isEngagedInMelee returns true when adjacent enemy exists', () => {
      const archer = createUnit('archer', { col: 5, row: 5 });
      const enemy = createUnit('orc', { col: 5, row: 6 });

      const state = makeState([archer, enemy]);
      expect(isEngagedInMelee(state, archer)).toBe(true);
    });

    it('isEngagedInMelee returns false with no adjacent enemies', () => {
      const archer = createUnit('archer', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 7 });

      const state = makeState([archer, enemy]);
      expect(isEngagedInMelee(state, archer)).toBe(false);
    });
  });

  describe('move or attack restriction', () => {
    it('archer cannot attack after moving', () => {
      const archer = createUnit('archer', { col: 5, row: 5 });
      archer.hasMoved = true;
      const enemy = createUnit('orc', { col: 5, row: 7 });

      const state = makeState([archer, enemy]);
      state.selectedUnitId = archer.id;

      const targets = getValidAttackTargets(state, archer.id);
      expect(targets).toHaveLength(0);
    });
  });

  describe('shooting over obstacles', () => {
    it('crossbowman can shoot over tower', () => {
      // Tower at col 5, row 2 — crossbow shoots through it at range 3
      const xbow = createUnit('crossbowman', { col: 5, row: 4 });
      const enemy = createUnit('orc', { col: 5, row: 7 });

      const state = makeState([xbow, enemy]);
      state.selectedUnitId = xbow.id;

      const targets = getValidAttackTargets(state, xbow.id);
      expect(targets).toContain(enemy.id);
    });
  });
});
