import { Faction, HexCoord, TerrainType, UnitType } from "./types.js";
import { ArmySetup } from "./units.js";

// ─── Scenario Types ─────────────────────────────────────────────

export interface ScenarioWinCondition {
  type: "elimination" | "capture_hex";
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
  deploymentZone?: { faction: Faction; rows: number[] };
  unplacedUnits?: { type: UnitType; faction: Faction }[];
  cardDeployment?: boolean;
  cardDeploymentZones?: { imperial: { rows: number[]; cols?: number[] }; chaos: { rows: number[]; cols?: number[] } };
}

// ─── Scenario Definitions ───────────────────────────────────────

const battleOfTheBorderlands: Scenario = {
  id: "battle_of_the_borderlands",
  name: "Battle of the Borderlands",
  description:
    "Gorefist the Chaos Destroyer has sent his Chaos army across the border to destroy everything in its path. An Imperial Army is being assembled by the Grand Duke Ferdinand, one of the Empire's most decorated commanders. The Chaos army must be prevented from reaching and capturing one of the border watch towers which will give Gorefist a firm foothold in the Reikwald. The task of stopping Gorefist's Chaos army has fallen to you.",
  campaignPoints: 1,
  imperialArmy: {
    units: [
      { type: "men_at_arms", position: { col: 1, row: 1 } },
      { type: "men_at_arms", position: { col: 4, row: 3 } },
      { type: "men_at_arms", position: { col: 8, row: 3 } },
      { type: "archer", position: { col: 3, row: 3 } },
      { type: "archer", position: { col: 7, row: 3 } },
      { type: "crossbowman", position: { col: 6, row: 1 } },
      { type: "imperial_knights", position: { col: 9, row: 5 } },
      { type: "imperial_knights", position: { col: 10, row: 5 } },
      { type: "imperial_knights", position: { col: 8, row: 5 } },
      { type: "lord_knights", position: { col: 5, row: 4 } },
      { type: "mighty_cannon", position: { col: 6, row: 5 } },
    ],
  },
  chaosArmy: {
    units: [
      { type: "goblin", position: { col: 7, row: 9 } },
      { type: "goblin", position: { col: 7, row: 10 } },
      { type: "beastman", position: { col: 5, row: 9 } },
      { type: "beastman", position: { col: 5, row: 10 } },
      { type: "chaos_bowman", position: { col: 3, row: 11 } },
      { type: "chaos_bowman", position: { col: 4, row: 11 } },
      { type: "orc", position: { col: 6, row: 10 } },
      { type: "orc", position: { col: 7, row: 11 } },
      { type: "wolf_rider", position: { col: 3, row: 9 } },
      { type: "wolf_rider", position: { col: 4, row: 9 } },
      { type: "chaos_warrior", position: { col: 3, row: 10 } },
      { type: "chaos_warrior", position: { col: 4, row: 10 } },
      { type: "champions_of_chaos", position: { col: 1, row: 10 } },
      { type: "ogre_champion", position: { col: 1, row: 9 } },
    ],
  },
  boardOverrides: {
    terrain: [
      { coord: { col: 1, row: 4 }, terrain: "marsh" },
      { coord: { col: 2, row: 5 }, terrain: "marsh" },
      { coord: { col: 6, row: 5 }, terrain: "ditch", orientation: 1 },
      { coord: { col: 8, row: 5 }, terrain: "plain" },
      { coord: { col: 0, row: 3 }, terrain: "road" },
      { coord: { col: 4, row: 3 }, terrain: "road" },
      { coord: { col: 8, row: 3 }, terrain: "road" },
      { coord: { col: 12, row: 3 }, terrain: "road" },
    ],
    hedges: [
      [
        { col: 7, row: 7 },
        { col: 6, row: 7 },
      ],
      [
        { col: 7, row: 7 },
        { col: 6, row: 8 },
      ],
      [
        { col: 10, row: 7 },
        { col: 9, row: 7 },
      ],
      [
        { col: 10, row: 7 },
        { col: 9, row: 8 },
      ],
    ],
  },
  winConditions: [
    { type: "capture_hex", faction: "chaos", targetCoord: { col: 5, row: 2 } },
    { type: "elimination", faction: "imperial" },
  ],
};

const battleOfTheRiverTengin: Scenario = {
  id: "battle_of_the_river_tengin",
  name: "Battle of the River Tengin",
  description:
    "Gorefist's Chaos Horde has broken through the Borderlands and has reached the River Tengin, the last great obstacle. Once across the river, they will be into the heartland of the Reikwald and only a day's march from Grunburg, the provincial capital. The forces of Chaos must not be allowed to cross the Tengin.",
  campaignPoints: 1,
  imperialArmy: {
    units: [
      { type: "men_at_arms", position: { col: 0, row: 2 } },
      { type: "men_at_arms", position: { col: 4, row: 3 } },
      { type: "men_at_arms", position: { col: 8, row: 3 } },
      { type: "archer", position: { col: 7, row: 4 } },
      { type: "archer", position: { col: 4, row: 4 } },
      { type: "crossbowman", position: { col: 4, row: 5 } },
      { type: "imperial_knights", position: { col: 11, row: 9 } },
      { type: "imperial_knights", position: { col: 10, row: 10 } },
      { type: "imperial_knights", position: { col: 10, row: 11 } },
      { type: "lord_knights", position: { col: 10, row: 8 } },
      { type: "mighty_cannon", position: { col: 7, row: 7 } },
    ],
  },
  chaosArmy: {
    units: [], // All chaos units are unplaced (deployed by player)
  },
  unplacedUnits: [
    { type: "goblin", faction: "chaos" },
    { type: "goblin", faction: "chaos" },
    { type: "beastman", faction: "chaos" },
    { type: "beastman", faction: "chaos" },
    { type: "chaos_bowman", faction: "chaos" },
    { type: "chaos_bowman", faction: "chaos" },
    { type: "orc", faction: "chaos" },
    { type: "orc", faction: "chaos" },
    { type: "chaos_warrior", faction: "chaos" },
    { type: "chaos_warrior", faction: "chaos" },
    { type: "wolf_rider", faction: "chaos" },
    { type: "wolf_rider", faction: "chaos" },
    { type: "champions_of_chaos", faction: "chaos" },
    { type: "ogre_champion", faction: "chaos" },
  ],
  deploymentZone: { faction: "chaos", rows: [0, 1] },
  boardOverrides: {
    terrain: [
      // Move tower to (3,6)
      { coord: { col: 5, row: 2 }, terrain: "plain" }, // Remove default tower
      { coord: { col: 3, row: 6 }, terrain: "tower" }, // Place tower at new location
      // Remove marsh at (1,4) and (2,5) if they exist from default — override to plain
      { coord: { col: 1, row: 4 }, terrain: "plain" },
      { coord: { col: 2, row: 5 }, terrain: "plain" },
      // Remove default marsh and ditch
      { coord: { col: 6, row: 5 }, terrain: "plain" },
      { coord: { col: 8, row: 5 }, terrain: "plain" },
    ],
    hedges: [
      [
        { col: 5, row: 8 },
        { col: 6, row: 7 },
      ],
      [
        { col: 5, row: 7 },
        { col: 6, row: 7 },
      ],
      [
        { col: 5, row: 7 },
        { col: 5, row: 6 },
      ],
      [
        { col: 4, row: 6 },
        { col: 5, row: 6 },
      ],
    ],
  },
  winConditions: [
    { type: "elimination", faction: "imperial" },
    { type: "elimination", faction: "chaos" },
  ],
};

const battleOnTheRoadToGrunburg: Scenario = {
  id: "battle_on_the_road_to_grunberg",
  name: "Battle on the Road to Grunberg",
  description:
    "Gorefist has pushed deep into the Reikwald and his Chaos horde is now marching along the road to Grunberg. An Imperial force has been sent to block the road and prevent the Chaos army from reaching the city. Both armies arrive on the battlefield at the same time and must deploy their forces as battle cards are drawn.",
  campaignPoints: 1,
  imperialArmy: {
    units: [],
  },
  chaosArmy: {
    units: [],
  },
  cardDeployment: true,
  cardDeploymentZones: {
    chaos: { rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], cols: [0] },
    imperial: { rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], cols: [12] },
  },
  unplacedUnits: [
    // Imperial
    { type: "men_at_arms", faction: "imperial" },
    { type: "men_at_arms", faction: "imperial" },
    { type: "men_at_arms", faction: "imperial" },
    { type: "archer", faction: "imperial" },
    { type: "archer", faction: "imperial" },
    { type: "crossbowman", faction: "imperial" },
    { type: "imperial_knights", faction: "imperial" },
    { type: "imperial_knights", faction: "imperial" },
    { type: "imperial_knights", faction: "imperial" },
    { type: "lord_knights", faction: "imperial" },
    { type: "mighty_cannon", faction: "imperial" },
    // Chaos
    { type: "goblin", faction: "chaos" },
    { type: "goblin", faction: "chaos" },
    { type: "beastman", faction: "chaos" },
    { type: "beastman", faction: "chaos" },
    { type: "chaos_bowman", faction: "chaos" },
    { type: "chaos_bowman", faction: "chaos" },
    { type: "orc", faction: "chaos" },
    { type: "orc", faction: "chaos" },
    { type: "chaos_warrior", faction: "chaos" },
    { type: "chaos_warrior", faction: "chaos" },
    { type: "wolf_rider", faction: "chaos" },
    { type: "wolf_rider", faction: "chaos" },
    { type: "champions_of_chaos", faction: "chaos" },
    { type: "ogre_champion", faction: "chaos" },
  ],
  boardOverrides: {
    terrain: [
      // Remove default tower
      { coord: { col: 5, row: 2 }, terrain: "plain" },
      // Remove default marsh
      { coord: { col: 8, row: 5 }, terrain: "plain" },
      // Add 3 marsh tiles
      { coord: { col: 6, row: 5 }, terrain: "marsh" },
      { coord: { col: 6, row: 9 }, terrain: "marsh" },
      { coord: { col: 7, row: 11 }, terrain: "marsh" },
    ],
    hedges: [],
  },
  winConditions: [
    { type: "elimination", faction: "imperial" },
    { type: "elimination", faction: "chaos" },
  ],
};

// ─── Scenario Registry ──────────────────────────────────────────

export const SCENARIOS: Scenario[] = [
  battleOfTheBorderlands,
  battleOfTheRiverTengin,
  battleOnTheRoadToGrunburg,
];

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

// ─── Campaign Metadata ──────────────────────────────────────────

export interface CampaignScenarioInfo {
  id: string;
  name: string;
  campaignPoints: number;
  available: boolean;
}

export const CAMPAIGN_SCENARIOS: CampaignScenarioInfo[] = [
  {
    id: "battle_of_the_borderlands",
    name: "Battle of the Borderlands",
    campaignPoints: 1,
    available: true,
  },
  {
    id: "battle_of_the_river_tengin",
    name: "Battle of the River Tengin",
    campaignPoints: 1,
    available: true,
  },
  {
    id: "battle_on_the_road_to_grunberg",
    name: "Battle on the Road to Grunberg",
    campaignPoints: 1,
    available: true,
  },
  {
    id: "battle_of_the_plains",
    name: "Battle of the Plains",
    campaignPoints: 2,
    available: false,
  },
  {
    id: "battle_of_altdorf",
    name: "Battle of Altdorf",
    campaignPoints: 2,
    available: false,
  },
];
