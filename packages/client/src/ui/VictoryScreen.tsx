import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useCampaignStore } from '../store/campaignStore';
import { getScenarioById, isCampaignComplete } from '@battle-masters/game-logic';

const FACTION_LABELS = {
  imperial: 'The Imperial Army',
  chaos: 'The Chaos Army',
};

const FACTION_COLORS = {
  imperial: '#4488cc',
  chaos: '#cc4444',
};

export function VictoryScreen() {
  const state = useGameStore((s) => s.state);
  const initGame = useGameStore((s) => s.initGame);
  const setScreen = useUIStore((s) => s.setScreen);
  const isCampaignBattle = useUIStore((s) => s.isCampaignBattle);
  const setIsCampaignBattle = useUIStore((s) => s.setIsCampaignBattle);
  const campaignRecordResult = useCampaignStore((s) => s.recordBattleResult);
  const campaign = useCampaignStore((s) => s.campaign);

  if (!state || !state.winner) return null;

  const color = FACTION_COLORS[state.winner];
  const name = FACTION_LABELS[state.winner];

  // Scenario-specific victory message
  let victoryMessage: string | null = null;
  if (state.scenarioId) {
    const scenario = getScenarioById(state.scenarioId);
    const hasCaptureCondition = scenario?.winConditions.some(wc => wc.type === 'capture_hex');
    if (hasCaptureCondition) {
      victoryMessage = state.winner === 'chaos'
        ? 'The Tower has been captured!'
        : 'The Tower has been defended!';
    }
  }

  const handleRematch = () => {
    initGame(undefined, state.scenarioId);
    setScreen('game');
  };

  const handleContinueCampaign = () => {
    campaignRecordResult(state);
    setIsCampaignBattle(false);
    // Check if the campaign is now complete (after recording)
    const updatedCampaign = useCampaignStore.getState().campaign;
    if (updatedCampaign && isCampaignComplete(updatedCampaign)) {
      setScreen('campaign_complete');
    } else {
      setScreen('campaign_overview');
    }
  };

  const handleMenu = () => {
    if (isCampaignBattle) {
      setIsCampaignBattle(false);
    }
    setScreen('menu');
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      zIndex: 100,
    }}>
      <div style={{ fontSize: '1rem', color: '#888', marginBottom: 8 }}>Victory!</div>
      <h1 style={{
        fontSize: '2.5rem',
        color,
        fontWeight: 'bold',
        marginBottom: 16,
        textShadow: `0 0 30px ${color}`,
      }}>
        {name} Wins
      </h1>
      {victoryMessage && (
        <p style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: 8, fontStyle: 'italic' }}>
          {victoryMessage}
        </p>
      )}
      <p style={{ color: '#888', marginBottom: 32 }}>
        After {state.turnNumber} turns and {state.combatLog.length} battles
      </p>
      <div style={{ display: 'flex', gap: 16 }}>
        {isCampaignBattle ? (
          <button onClick={handleContinueCampaign} style={{
            background: color,
            border: 'none',
            color: '#fff',
            padding: '10px 32px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}>
            Continue Campaign
          </button>
        ) : (
          <button onClick={handleRematch} style={{
            background: color,
            border: 'none',
            color: '#fff',
            padding: '10px 32px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}>
            Rematch
          </button>
        )}
        <button onClick={handleMenu} style={{
          background: 'transparent',
          border: `1px solid ${color}`,
          color,
          padding: '10px 32px',
          borderRadius: 6,
          cursor: 'pointer',
        }}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
