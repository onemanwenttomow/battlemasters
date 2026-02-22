import { UnitDefinition, UnitType, Unit, HexCoord, Faction } from './types.js';

// ─── Unit Definitions ──────────────────────────────────────────

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  // Imperial Army
  men_at_arms: {
    type: 'men_at_arms',
    name: 'Men at Arms',
    faction: 'imperial',
    hp: 3,
    combatValue: 3,
    movement: 1,
    range: 1,
    spriteKey: 'imperial_men_at_arms',
  },
  archer: {
    type: 'archer',
    name: 'Archer',
    faction: 'imperial',
    hp: 3,
    combatValue: 3,
    movement: 1,
    range: 2,
    special: ['ranged', 'move_or_attack'],
    spriteKey: 'imperial_archer',
  },
  crossbowman: {
    type: 'crossbowman',
    name: 'Crossbowman',
    faction: 'imperial',
    hp: 3,
    combatValue: 3,
    movement: 1,
    range: 3,
    special: ['ranged', 'move_or_attack'],
    spriteKey: 'imperial_crossbowman',
  },
  imperial_knights: {
    type: 'imperial_knights',
    name: 'Imperial Knights',
    faction: 'imperial',
    hp: 3,
    combatValue: 4,
    movement: 1,
    range: 1,
    special: ['no_tower'],
    spriteKey: 'imperial_knights',
  },
  lord_knights: {
    type: 'lord_knights',
    name: 'Lord Knights',
    faction: 'imperial',
    hp: 3,
    combatValue: 5,
    movement: 1,
    range: 1,
    special: ['no_tower'],
    spriteKey: 'imperial_lord_knights',
  },
  mighty_cannon: {
    type: 'mighty_cannon',
    name: 'Mighty Cannon',
    faction: 'imperial',
    hp: 3,
    combatValue: 2,
    movement: 1,
    range: 8,
    special: ['cannon_fire', 'no_tower', 'move_or_attack', 'ranged'],
    spriteKey: 'imperial_mighty_cannon',
  },

  // Chaos Army
  goblin: {
    type: 'goblin',
    name: 'Goblin',
    faction: 'chaos',
    hp: 3,
    combatValue: 2,
    movement: 1,
    range: 1,
    spriteKey: 'chaos_goblin',
  },
  beastman: {
    type: 'beastman',
    name: 'Beastman',
    faction: 'chaos',
    hp: 3,
    combatValue: 3,
    movement: 1,
    range: 1,
    spriteKey: 'chaos_beastman',
  },
  chaos_bowman: {
    type: 'chaos_bowman',
    name: 'Chaos Bowman',
    faction: 'chaos',
    hp: 3,
    combatValue: 2,
    movement: 1,
    range: 2,
    special: ['ranged', 'move_or_attack'],
    spriteKey: 'chaos_bowman',
  },
  orc: {
    type: 'orc',
    name: 'Orc',
    faction: 'chaos',
    hp: 3,
    combatValue: 3,
    movement: 1,
    range: 1,
    spriteKey: 'chaos_orc',
  },
  chaos_warrior: {
    type: 'chaos_warrior',
    name: 'Chaos Warrior',
    faction: 'chaos',
    hp: 3,
    combatValue: 4,
    movement: 1,
    range: 1,
    spriteKey: 'chaos_warrior',
  },
  wolf_rider: {
    type: 'wolf_rider',
    name: 'Wolf Rider',
    faction: 'chaos',
    hp: 3,
    combatValue: 3,
    movement: 2,
    range: 1,
    special: ['no_tower'],
    spriteKey: 'chaos_wolf_rider',
  },
  champions_of_chaos: {
    type: 'champions_of_chaos',
    name: 'Champions of Chaos',
    faction: 'chaos',
    hp: 3,
    combatValue: 5,
    movement: 1,
    range: 1,
    special: ['no_tower'],
    spriteKey: 'chaos_champions',
  },
  ogre_champion: {
    type: 'ogre_champion',
    name: 'Ogre Champion',
    faction: 'chaos',
    hp: 6,
    combatValue: 4,
    movement: 1,
    range: 1,
    special: ['ogre_rampage'],
    spriteKey: 'chaos_ogre_champion',
  },
};

/** Get the definition for a unit type */
export function getUnitDefinition(type: UnitType): UnitDefinition {
  return UNIT_DEFINITIONS[type];
}

let nextUnitId = 1;

/** Create a new unit instance */
export function createUnit(type: UnitType, position: HexCoord): Unit {
  const def = UNIT_DEFINITIONS[type];
  return {
    id: `unit_${nextUnitId++}`,
    definitionType: type,
    faction: def.faction,
    hp: def.hp,
    maxHp: def.hp,
    position,
    hasActivated: false,
    hasAttacked: false,
    hasMoved: false,
  };
}

/** Reset unit ID counter (for testing) */
export function resetUnitIdCounter(): void {
  nextUnitId = 1;
}

// ─── Default Army Setup ────────────────────────────────────────

export interface ArmySetup {
  units: { type: UnitType; position: HexCoord }[];
}

/** Default Imperial Army positions (rows 4-5, below river) — 11 units */
export function getDefaultImperialArmy(): ArmySetup {
  return {
    units: [
      // Men at Arms (3) — front line
      { type: 'men_at_arms', position: { col: 5, row: 5 } },
      { type: 'men_at_arms', position: { col: 7, row: 5 } },
      { type: 'men_at_arms', position: { col: 9, row: 5 } },

      // Archers (2) — behind front line
      { type: 'archer', position: { col: 6, row: 4 } },
      { type: 'archer', position: { col: 8, row: 4 } },

      // Crossbowman (1)
      { type: 'crossbowman', position: { col: 7, row: 4 } },

      // Imperial Knights (3) — flanks and center
      { type: 'imperial_knights', position: { col: 3, row: 5 } },
      { type: 'imperial_knights', position: { col: 11, row: 5 } },
      { type: 'imperial_knights', position: { col: 4, row: 4 } },

      // Lord Knights (1)
      { type: 'lord_knights', position: { col: 10, row: 4 } },

      // Mighty Cannon (1) — rear center
      { type: 'mighty_cannon', position: { col: 5, row: 4 } },
    ],
  };
}

/** Default Chaos Army positions (rows 6-7) — 14 units */
export function getDefaultChaosArmy(): ArmySetup {
  return {
    units: [
      // Goblins (2) — front
      { type: 'goblin', position: { col: 4, row: 6 } },
      { type: 'goblin', position: { col: 10, row: 6 } },

      // Beastmen (2) — front
      { type: 'beastman', position: { col: 6, row: 6 } },
      { type: 'beastman', position: { col: 8, row: 6 } },

      // Chaos Bowmen (2) — rear
      { type: 'chaos_bowman', position: { col: 6, row: 7 } },
      { type: 'chaos_bowman', position: { col: 8, row: 7 } },

      // Orcs (2) — front center
      { type: 'orc', position: { col: 5, row: 6 } },
      { type: 'orc', position: { col: 9, row: 6 } },

      // Chaos Warriors (2) — center
      { type: 'chaos_warrior', position: { col: 7, row: 6 } },
      { type: 'chaos_warrior', position: { col: 7, row: 7 } },

      // Wolf Riders (2) — flanks
      { type: 'wolf_rider', position: { col: 3, row: 7 } },
      { type: 'wolf_rider', position: { col: 11, row: 7 } },

      // Champions of Chaos (1)
      { type: 'champions_of_chaos', position: { col: 9, row: 7 } },

      // Ogre Champion (1)
      { type: 'ogre_champion', position: { col: 5, row: 7 } },
    ],
  };
}
