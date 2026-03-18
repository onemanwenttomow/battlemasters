import { useCampaignStore } from '../store/campaignStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS } from '@battle-masters/game-logic';

const FACTION_COLORS = {
  imperial: '#4488cc',
  chaos: '#cc4444',
};

const FACTION_LABELS = {
  imperial: 'The Imperial Army',
  chaos: 'The Chaos Army',
};

export function CampaignComplete() {
  const campaign = useCampaignStore((s) => s.campaign);
  const getWinner = useCampaignStore((s) => s.getWinner);
  const resetCampaign = useCampaignStore((s) => s.resetCampaign);
  const startCampaign = useCampaignStore((s) => s.startCampaign);
  const setScreen = useUIStore((s) => s.setScreen);

  if (!campaign) return null;

  const winner = getWinner();

  const handleNewCampaign = () => {
    resetCampaign();
    startCampaign();
    setScreen('campaign_overview');
  };

  const handleMainMenu = () => {
    setScreen('menu');
  };

  const winnerColor = winner === 'imperial' ? FACTION_COLORS.imperial
    : winner === 'chaos' ? FACTION_COLORS.chaos
    : '#c4a35a';

  const winnerLabel = winner === 'imperial' ? FACTION_LABELS.imperial
    : winner === 'chaos' ? FACTION_LABELS.chaos
    : 'A Draw';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)',
    }}>
      <div style={{ fontSize: '1rem', color: '#888', marginBottom: 8 }}>Campaign Complete!</div>
      <h1 style={{
        fontSize: '2.5rem',
        color: winnerColor,
        fontWeight: 'bold',
        marginBottom: 16,
        textShadow: `0 0 30px ${winnerColor}`,
      }}>
        {winner === 'tie' ? 'A Draw!' : `${winnerLabel} Wins`}
      </h1>

      {/* Final score */}
      <div style={{
        display: 'flex',
        gap: 32,
        marginBottom: 32,
        fontSize: '1.2rem',
      }}>
        <span style={{ color: FACTION_COLORS.imperial }}>
          Imperial: {campaign.imperialPoints}
        </span>
        <span style={{ color: '#555' }}>—</span>
        <span style={{ color: FACTION_COLORS.chaos }}>
          Chaos: {campaign.chaosPoints}
        </span>
      </div>

      {/* Per-battle results */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: 420,
        maxWidth: '95vw',
        marginBottom: 32,
      }}>
        {campaign.results.map((result, index) => {
          const scenario = CAMPAIGN_SCENARIOS[index];
          return (
            <div key={scenario.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid #222',
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: FACTION_COLORS[result.winner],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                color: '#fff',
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                {result.winner === 'imperial' ? 'I' : 'C'}
              </div>
              <div style={{ flex: 1, fontSize: '0.85rem', color: '#ccc' }}>
                {scenario.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>
                {result.turnCount} turns
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 16 }}>
        <button
          onClick={handleNewCampaign}
          style={{
            background: winnerColor,
            border: 'none',
            color: '#fff',
            padding: '10px 32px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          New Campaign
        </button>
        <button
          onClick={handleMainMenu}
          style={{
            background: 'transparent',
            border: `1px solid ${winnerColor}`,
            color: winnerColor,
            padding: '10px 32px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Main Menu
        </button>
      </div>
    </div>
  );
}
