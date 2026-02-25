import { DieResult, CombatResult, Unit } from './types.js';
import { getUnitDefinition } from './units.js';
import { getDefenseModifier, getAttackModifier, getAttackerTerrainBonus } from './board.js';
import type { TerrainType } from './types.js';

// ─── Dice ──────────────────────────────────────────────────────

// Battle Masters dice: 3 skulls, 2 blanks, 1 shield (6 faces)
const DIE_FACES: DieResult[] = ['skull', 'skull', 'skull', 'blank', 'blank', 'shield'];

/** Roll a single die using the provided RNG */
export function rollDie(rng: () => number): DieResult {
  const index = Math.floor(rng() * 6);
  return DIE_FACES[index];
}

/** Roll multiple dice */
export function rollDice(count: number, rng: () => number): DieResult[] {
  const results: DieResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie(rng));
  }
  return results;
}

/** Count hits (skulls) in dice results */
export function countHits(results: DieResult[]): number {
  return results.filter(r => r === 'skull').length;
}

/** Count blocks (shields) in dice results */
export function countBlocks(results: DieResult[]): number {
  return results.filter(r => r === 'shield').length;
}

// ─── Combat Resolution ─────────────────────────────────────────

export interface CombatContext {
  attackerTerrain: TerrainType;
  defenderTerrain: TerrainType;
  distance: number;
  chargeBonus?: number;
}

/** Calculate the number of attack/defense dice for a combat */
export function getCombatDiceCounts(
  attacker: Unit,
  defender: Unit,
  context: CombatContext = { attackerTerrain: 'plain', defenderTerrain: 'plain', distance: 1 }
): { attackDice: number; defenseDice: number } {
  const attackerDef = getUnitDefinition(attacker.definitionType);
  const defenderDef = getUnitDefinition(defender.definitionType);

  const isHandToHand = context.distance === 1;

  const attackerMeleeModifier = (isHandToHand && attackerDef.special?.includes('ranged')) ? -1 : 0;
  const defenderMeleeModifier = (isHandToHand && defenderDef.special?.includes('ranged')) ? -1 : 0;

  const attackDice = Math.max(1, attackerDef.combatValue + getAttackModifier(context.defenderTerrain) + getAttackerTerrainBonus(context.attackerTerrain) + attackerMeleeModifier + (context.chargeBonus ?? 0));
  const defenseDice = Math.max(0, defenderDef.combatValue + getDefenseModifier(context.defenderTerrain) + defenderMeleeModifier);

  return { attackDice, defenseDice };
}

/** Resolve combat using explicit roll arrays (from physics dice) */
export function resolveCombatWithRolls(
  attacker: Unit,
  defender: Unit,
  attackerRolls: DieResult[],
  defenderRolls: DieResult[],
): CombatResult {
  const hits = countHits(attackerRolls);
  const blocks = countBlocks(defenderRolls);
  const damage = Math.max(0, hits - blocks);

  const newHp = defender.hp - damage;
  const unitDestroyed = newHp <= 0;

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerRolls,
    defenderRolls,
    hits,
    blocks,
    damage,
    unitDestroyed,
  };
}

/** Resolve combat between two units */
export function resolveCombat(
  attacker: Unit,
  defender: Unit,
  rng: () => number,
  context: CombatContext = { attackerTerrain: 'plain', defenderTerrain: 'plain', distance: 1 }
): CombatResult {
  const { attackDice, defenseDice } = getCombatDiceCounts(attacker, defender, context);

  const attackerRolls = rollDice(attackDice, rng);
  const defenderRolls = rollDice(defenseDice, rng);

  return resolveCombatWithRolls(attacker, defender, attackerRolls, defenderRolls);
}
