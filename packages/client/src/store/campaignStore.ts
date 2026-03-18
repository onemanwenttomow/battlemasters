import { create } from 'zustand';
import type { GameState, Faction } from '@battle-masters/game-logic';
import {
  CampaignState,
  CampaignBattleResult,
  CampaignUnitState,
  createInitialCampaignState,
  recordBattleResult as pureRecordBattleResult,
  getCampaignWinner,
  isCampaignComplete,
  CAMPAIGN_SCENARIOS,
} from '@battle-masters/game-logic';

const STORAGE_KEY = 'battle-masters-campaign';

function saveCampaign(campaign: CampaignState | null) {
  if (campaign) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CampaignState;
  } catch {
    return null;
  }
}

interface CampaignStore {
  campaign: CampaignState | null;
  startCampaign: () => void;
  recordBattleResult: (gameState: GameState) => void;
  resetCampaign: () => void;
  loadFromStorage: () => void;
  getCurrentScenarioId: () => string | null;
  getWinner: () => Faction | 'tie' | null;
  isComplete: () => boolean;
}

/** Extract surviving units from a finished game state */
function extractSurvivors(state: GameState): CampaignUnitState[] {
  const survivors: CampaignUnitState[] = [];
  for (const unit of state.units.values()) {
    if (unit.hp > 0) {
      survivors.push({
        definitionType: unit.definitionType,
        faction: unit.faction,
        hp: unit.hp,
        maxHp: unit.maxHp,
      });
    }
  }
  return survivors;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaign: null,

  startCampaign: () => {
    const campaign = createInitialCampaignState();
    saveCampaign(campaign);
    set({ campaign });
  },

  recordBattleResult: (gameState: GameState) => {
    const { campaign } = get();
    if (!campaign || !gameState.winner || !gameState.scenarioId) return;

    const result: CampaignBattleResult = {
      scenarioId: gameState.scenarioId,
      winner: gameState.winner,
      survivingUnits: extractSurvivors(gameState),
      turnCount: gameState.turnNumber,
    };

    const updated = pureRecordBattleResult(campaign, result);
    saveCampaign(updated);
    set({ campaign: updated });
  },

  resetCampaign: () => {
    saveCampaign(null);
    set({ campaign: null });
  },

  loadFromStorage: () => {
    const campaign = loadCampaign();
    if (campaign) {
      set({ campaign });
    }
  },

  getCurrentScenarioId: () => {
    const { campaign } = get();
    if (!campaign) return null;
    if (campaign.currentScenarioIndex >= CAMPAIGN_SCENARIOS.length) return null;
    return CAMPAIGN_SCENARIOS[campaign.currentScenarioIndex].id;
  },

  getWinner: () => {
    const { campaign } = get();
    if (!campaign) return null;
    return getCampaignWinner(campaign);
  },

  isComplete: () => {
    const { campaign } = get();
    if (!campaign) return false;
    return isCampaignComplete(campaign);
  },
}));
