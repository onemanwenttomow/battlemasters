import { useCampaignStore } from '../store/campaignStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS } from '@battle-masters/game-logic';
import { theme, getFactionTheme, getFactionLabel } from './theme';
import { MedievalButton } from './components/MedievalButton';
import { Panel } from './components/Panel';

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

  const winnerColor = winner === 'imperial' ? theme.colors.imperial
    : winner === 'chaos' ? theme.colors.chaos
    : theme.colors.gold;

  const winnerLabel = winner === 'imperial' ? getFactionLabel('imperial')
    : winner === 'chaos' ? getFactionLabel('chaos')
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
      <Panel variant="parchment" ornate style={{
        padding: '40px 48px',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out',
      }}>
        <div style={{
          fontSize: theme.fontSizes.md,
          fontFamily: theme.fonts.body,
          color: theme.colors.textMuted,
          marginBottom: 8,
          fontStyle: 'italic',
        }}>
          Campaign Complete!
        </div>
        <h1 style={{
          fontSize: theme.fontSizes['3xl'],
          fontFamily: theme.fonts.display,
          color: winnerColor,
          fontWeight: 'normal',
          marginBottom: 16,
          textShadow: `0 0 30px ${winnerColor}`,
        }}>
          {winner === 'tie' ? 'A Draw!' : `${winnerLabel} Wins`}
        </h1>

        {/* Final score */}
        <div style={{
          display: 'flex',
          gap: 32,
          justifyContent: 'center',
          marginBottom: 32,
          fontSize: theme.fontSizes.lg,
          fontFamily: theme.fonts.display,
        }}>
          <span style={{ color: theme.colors.imperial }}>
            Imperial: {campaign.imperialPoints}
          </span>
          <span style={{ color: theme.colors.textDim, fontFamily: theme.fonts.body }}>&mdash;</span>
          <span style={{ color: theme.colors.chaos }}>
            Chaos: {campaign.chaosPoints}
          </span>
        </div>

        {/* Per-battle results */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: 380,
          marginBottom: 32,
        }}>
          {campaign.results.map((result, index) => {
            const scenario = CAMPAIGN_SCENARIOS[index];
            const factionTheme = getFactionTheme(result.winner);
            return (
              <div key={scenario.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${theme.colors.border}`,
              }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: factionTheme.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontFamily: theme.fonts.display,
                  color: '#fff',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>
                  {result.winner === 'imperial' ? 'I' : 'C'}
                </div>
                <div style={{
                  flex: 1,
                  fontSize: theme.fontSizes.sm,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}>
                  {scenario.name}
                </div>
                <div style={{
                  fontSize: theme.fontSizes.xs,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textDim,
                }}>
                  {result.turnCount} turns
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <MedievalButton variant="primary" onClick={handleNewCampaign}>
            New Campaign
          </MedievalButton>
          <MedievalButton variant="ghost" onClick={handleMainMenu}>
            Main Menu
          </MedievalButton>
        </div>
      </Panel>
    </div>
  );
}
