import { Faction, HexCoord, TerrainType } from './types.js';
import { ArmySetup } from './units.js';

// ─── Scenario Types ─────────────────────────────────────────────

export interface ScenarioWinCondition {
  type: 'elimination' | 'capture_hex';
  faction: Faction;
  targetCoord?: HexCoord;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  campaignPoints: number;
  imperialArmy: ArmySetup;
  chaosArmy: ArmySetup;
  boardOverrides?: {
    terrain?: { coord: HexCoord; terrain: TerrainType; orientation?: number }[];
    hedges?: [HexCoord, HexCoord][];
  };
  winConditions: ScenarioWinCondition[];
}

// ─── Scenario Definitions ───────────────────────────────────────

const battleOfTheBorderlands: Scenario = {
  id: 'battle_of_the_borderlands',
  name: 'Battle of the Borderlands',
  description: 'The Chaos horde advances on the Imperial border tower. The Empire must hold the tower at all costs, or the borderlands will fall.',
  campaignPoints: 1,
  imperialArmy: {
    units: [
      { type: 'men_at_arms', position: { col: 1, row: 1 } },
      { type: 'men_at_arms', position: { col: 4, row: 3 } },
      { type: 'men_at_arms', position: { col: 8, row: 3 } },
      { type: 'archer', position: { col: 3, row: 3 } },
      { type: 'archer', position: { col: 7, row: 3 } },
      { type: 'crossbowman', position: { col: 6, row: 1 } },
      { type: 'imperial_knights', position: { col: 9, row: 5 } },
      { type: 'imperial_knights', position: { col: 10, row: 5 } },
      { type: 'imperial_knights', position: { col: 8, row: 5 } },
      { type: 'lord_knights', position: { col: 5, row: 4 } },
      { type: 'mighty_cannon', position: { col: 6, row: 5 } },
    ],
  },
  chaosArmy: {
    units: [
      { type: 'goblin', position: { col: 7, row: 9 } },
      { type: 'goblin', position: { col: 7, row: 10 } },
      { type: 'beastman', position: { col: 5, row: 9 } },
      { type: 'beastman', position: { col: 5, row: 10 } },
      { type: 'chaos_bowman', position: { col: 3, row: 11 } },
      { type: 'chaos_bowman', position: { col: 4, row: 11 } },
      { type: 'orc', position: { col: 6, row: 10 } },
      { type: 'orc', position: { col: 7, row: 11 } },
      { type: 'wolf_rider', position: { col: 3, row: 9 } },
      { type: 'wolf_rider', position: { col: 4, row: 9 } },
      { type: 'chaos_warrior', position: { col: 3, row: 10 } },
      { type: 'chaos_warrior', position: { col: 4, row: 10 } },
      { type: 'champions_of_chaos', position: { col: 1, row: 10 } },
      { type: 'ogre_champion', position: { col: 1, row: 9 } },
    ],
  },
  boardOverrides: {
    terrain: [
      { coord: { col: 1, row: 4 }, terrain: 'marsh' },
      { coord: { col: 2, row: 5 }, terrain: 'marsh' },
      { coord: { col: 6, row: 5 }, terrain: 'ditch', orientation: 1 },
      { coord: { col: 8, row: 5 }, terrain: 'plain' },
      { coord: { col: 0, row: 3 }, terrain: 'road' },
      { coord: { col: 4, row: 3 }, terrain: 'road' },
      { coord: { col: 8, row: 3 }, terrain: 'road' },
      { coord: { col: 12, row: 3 }, terrain: 'road' },
    ],
    hedges: [
      [{ col: 7, row: 7 }, { col: 6, row: 7 }],
      [{ col: 7, row: 7 }, { col: 6, row: 8 }],
      [{ col: 10, row: 7 }, { col: 9, row: 7 }],
      [{ col: 10, row: 7 }, { col: 9, row: 8 }],
    ],
  },
  winConditions: [
    { type: 'capture_hex', faction: 'chaos', targetCoord: { col: 5, row: 2 } },
    { type: 'elimination', faction: 'imperial' },
  ],
};

// ─── Scenario Registry ──────────────────────────────────────────

export const SCENARIOS: Scenario[] = [
  battleOfTheBorderlands,
];

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

// ─── Campaign Metadata ──────────────────────────────────────────

export interface CampaignScenarioInfo {
  id: string;
  name: string;
  campaignPoints: number;
  available: boolean;
}

export const CAMPAIGN_SCENARIOS: CampaignScenarioInfo[] = [
  { id: 'battle_of_the_borderlands', name: 'Battle of the Borderlands', campaignPoints: 1, available: true },
  { id: 'battle_of_the_river_tengin', name: 'Battle of the River Tengin', campaignPoints: 1, available: false },
  { id: 'battle_on_the_road_to_grunberg', name: 'Battle on the Road to Grunberg', campaignPoints: 1, available: false },
  { id: 'battle_of_the_plains', name: 'Battle of the Plains', campaignPoints: 2, available: false },
  { id: 'battle_of_altdorf', name: 'Battle of Altdorf', campaignPoints: 2, available: false },
];
