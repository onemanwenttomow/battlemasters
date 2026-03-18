import { Faction, UnitType } from "./types.js";
import { UNIT_DEFINITIONS } from "./units.js";
import { CAMPAIGN_SCENARIOS } from "./scenarios.js";

// ─── Campaign Types ─────────────────────────────────────────────

export interface CampaignUnitState {
  definitionType: UnitType;
  faction: Faction;
  hp: number;
  maxHp: number;
}

export interface CampaignBattleResult {
  scenarioId: string;
  winner: Faction;
  survivingUnits: CampaignUnitState[];
  turnCount: number;
}

export interface CampaignState {
  currentScenarioIndex: number;
  results: CampaignBattleResult[];
  imperialPoints: number;
  chaosPoints: number;
  imperialRoster: CampaignUnitState[];
  chaosRoster: CampaignUnitState[];
}

// ─── Full roster definitions ────────────────────────────────────

const IMPERIAL_UNIT_TYPES: UnitType[] = [
  'men_at_arms', 'men_at_arms', 'men_at_arms',
  'archer', 'archer',
  'crossbowman',
  'imperial_knights', 'imperial_knights', 'imperial_knights',
  'lord_knights',
  'mighty_cannon',
];

const CHAOS_UNIT_TYPES: UnitType[] = [
  'goblin', 'goblin',
  'beastman', 'beastman',
  'chaos_bowman', 'chaos_bowman',
  'orc', 'orc',
  'chaos_warrior', 'chaos_warrior',
  'wolf_rider', 'wolf_rider',
  'champions_of_chaos',
  'ogre_champion',
];

// ─── Pure Functions ─────────────────────────────────────────────

function buildRoster(unitTypes: UnitType[], faction: Faction): CampaignUnitState[] {
  return unitTypes.map((type) => {
    const def = UNIT_DEFINITIONS[type];
    return { definitionType: type, faction, hp: def.hp, maxHp: def.hp };
  });
}

export function createInitialCampaignState(): CampaignState {
  return {
    currentScenarioIndex: 0,
    results: [],
    imperialPoints: 0,
    chaosPoints: 0,
    imperialRoster: buildRoster(IMPERIAL_UNIT_TYPES, 'imperial'),
    chaosRoster: buildRoster(CHAOS_UNIT_TYPES, 'chaos'),
  };
}

export function healUnitsBetweenBattles(units: CampaignUnitState[]): CampaignUnitState[] {
  return units.map((u) => {
    const healAmount = u.definitionType === 'ogre_champion' ? 6 : 3;
    return { ...u, hp: Math.min(u.maxHp, u.hp + healAmount) };
  });
}

export function recordBattleResult(
  campaign: CampaignState,
  result: CampaignBattleResult,
): CampaignState {
  const scenario = CAMPAIGN_SCENARIOS[campaign.currentScenarioIndex];
  const points = scenario?.campaignPoints ?? 1;

  // Separate survivors by faction
  const imperialSurvivors = result.survivingUnits.filter((u) => u.faction === 'imperial');
  const chaosSurvivors = result.survivingUnits.filter((u) => u.faction === 'chaos');

  // Remove dead units from rosters: match by (definitionType, faction) with consumption
  const newImperialRoster = matchSurvivorsToRoster(campaign.imperialRoster, imperialSurvivors);
  const newChaosRoster = matchSurvivorsToRoster(campaign.chaosRoster, chaosSurvivors);

  // Heal between battles
  const healedImperial = healUnitsBetweenBattles(newImperialRoster);
  const healedChaos = healUnitsBetweenBattles(newChaosRoster);

  return {
    currentScenarioIndex: campaign.currentScenarioIndex + 1,
    results: [...campaign.results, result],
    imperialPoints: campaign.imperialPoints + (result.winner === 'imperial' ? points : 0),
    chaosPoints: campaign.chaosPoints + (result.winner === 'chaos' ? points : 0),
    imperialRoster: healedImperial,
    chaosRoster: healedChaos,
  };
}

/** Match surviving units back to the roster, preserving roster order and removing dead units */
function matchSurvivorsToRoster(
  roster: CampaignUnitState[],
  survivors: CampaignUnitState[],
): CampaignUnitState[] {
  // Track which survivors have been consumed
  const available = survivors.map((s) => ({ ...s, consumed: false }));
  const result: CampaignUnitState[] = [];

  for (const rosterUnit of roster) {
    const match = available.find(
      (s) => !s.consumed && s.definitionType === rosterUnit.definitionType && s.faction === rosterUnit.faction,
    );
    if (match) {
      match.consumed = true;
      result.push({ definitionType: match.definitionType, faction: match.faction, hp: match.hp, maxHp: match.maxHp });
    }
    // If no match, the unit died — omit from roster
  }

  return result;
}

export function getCampaignWinner(campaign: CampaignState): Faction | 'tie' | null {
  if (campaign.currentScenarioIndex < CAMPAIGN_SCENARIOS.length) {
    return null; // Campaign not finished
  }
  if (campaign.imperialPoints > campaign.chaosPoints) return 'imperial';
  if (campaign.chaosPoints > campaign.imperialPoints) return 'chaos';
  return 'tie';
}

export function isCampaignComplete(campaign: CampaignState): boolean {
  return campaign.currentScenarioIndex >= CAMPAIGN_SCENARIOS.length;
}
