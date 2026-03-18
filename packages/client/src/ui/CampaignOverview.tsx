import { useCampaignStore } from '../store/campaignStore';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS, getScenarioById } from '@battle-masters/game-logic';

const FACTION_COLORS = {
  imperial: '#4488cc',
  chaos: '#cc4444',
};

export function CampaignOverview() {
  const campaign = useCampaignStore((s) => s.campaign);
  const startCampaign = useCampaignStore((s) => s.startCampaign);
  const resetCampaign = useCampaignStore((s) => s.resetCampaign);
  const getCurrentScenarioId = useCampaignStore((s) => s.getCurrentScenarioId);
  const isComplete = useCampaignStore((s) => s.isComplete);
  const initCampaignGame = useGameStore((s) => s.initCampaignGame);
  const setScreen = useUIStore((s) => s.setScreen);
  const setIsCampaignBattle = useUIStore((s) => s.setIsCampaignBattle);

  // Auto-start campaign if none exists
  if (!campaign) {
    startCampaign();
    return null;
  }

  // If campaign is complete, redirect to complete screen
  if (isComplete()) {
    setScreen('campaign_complete');
    return null;
  }

  const currentScenarioId = getCurrentScenarioId();
  const currentScenario = currentScenarioId ? getScenarioById(currentScenarioId) : null;

  const handleBeginBattle = () => {
    if (!currentScenarioId) return;
    initCampaignGame(currentScenarioId, campaign.imperialRoster, campaign.chaosRoster);
    setIsCampaignBattle(true);
    setScreen('game');
  };

  const handleReset = () => {
    resetCampaign();
    startCampaign();
  };

  const handleBack = () => {
    setScreen('menu');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)',
    }}>
      <h1 style={{
        fontSize: '2rem',
        color: '#c4a35a',
        fontWeight: 'bold',
        marginBottom: 8,
        textShadow: '0 2px 10px rgba(196,163,90,0.3)',
        letterSpacing: '0.1em',
      }}>
        CAMPAIGN
      </h1>

      {/* Points tally */}
      <div style={{
        display: 'flex',
        gap: 32,
        marginBottom: 24,
        fontSize: '1rem',
      }}>
        <span style={{ color: FACTION_COLORS.imperial }}>
          Imperial: {campaign.imperialPoints} pts
        </span>
        <span style={{ color: '#555' }}>vs</span>
        <span style={{ color: FACTION_COLORS.chaos }}>
          Chaos: {campaign.chaosPoints} pts
        </span>
      </div>

      {/* Battle list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 480,
        maxWidth: '95vw',
        marginBottom: 24,
      }}>
        {CAMPAIGN_SCENARIOS.map((scenario, index) => {
          const result = campaign.results[index];
          const isCurrent = index === campaign.currentScenarioIndex;
          const isUpcoming = index > campaign.currentScenarioIndex;

          return (
            <div
              key={scenario.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderRadius: 8,
                background: isCurrent
                  ? 'rgba(196,163,90,0.15)'
                  : 'rgba(255,255,255,0.03)',
                border: isCurrent
                  ? '2px solid rgba(196,163,90,0.5)'
                  : '1px solid #222',
              }}
            >
              {/* Status indicator */}
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                background: result
                  ? FACTION_COLORS[result.winner]
                  : isCurrent
                    ? 'rgba(196,163,90,0.3)'
                    : '#1a1a1a',
                color: result || isCurrent ? '#fff' : '#444',
                border: result ? 'none' : '1px solid #333',
                flexShrink: 0,
              }}>
                {result ? (result.winner === 'imperial' ? 'I' : 'C') : index + 1}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: isCurrent ? 'bold' : 'normal',
                  color: isUpcoming ? '#555' : '#ccc',
                }}>
                  {scenario.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#666' }}>
                  {scenario.campaignPoints} pt{scenario.campaignPoints > 1 ? 's' : ''}
                  {result && ` — ${result.winner === 'imperial' ? 'Imperial' : 'Chaos'} victory (${result.turnCount} turns)`}
                </div>
              </div>

              {isCurrent && (
                <div style={{
                  fontSize: '0.7rem',
                  color: '#c4a35a',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Next
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current scenario description */}
      {currentScenario && (
        <div style={{
          width: 480,
          maxWidth: '95vw',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid #333',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
        }}>
          <p style={{
            color: '#bbb',
            fontSize: '0.8rem',
            lineHeight: 1.7,
            margin: 0,
          }}>
            {currentScenario.description}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleBeginBattle}
          style={{
            background: 'linear-gradient(135deg, #c4a35a 0%, #8a7030 100%)',
            border: 'none',
            color: '#1a1a0f',
            padding: '12px 36px',
            borderRadius: 8,
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            boxShadow: '0 4px 20px rgba(196,163,90,0.3)',
          }}
        >
          Begin Battle
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          onClick={handleReset}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#666',
            padding: '6px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Reset Campaign
        </button>
        <button
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#888',
            padding: '6px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
