import { useCampaignStore } from '../store/campaignStore';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS, getScenarioById } from '@battle-masters/game-logic';
import { theme, getFactionTheme } from './theme';
import { MedievalButton } from './components/MedievalButton';
import { Panel } from './components/Panel';

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
        fontSize: theme.fontSizes['2xl'],
        fontFamily: theme.fonts.display,
        color: theme.colors.gold,
        fontWeight: 'normal',
        marginBottom: 8,
        textShadow: theme.shadows.text,
        letterSpacing: '0.1em',
      }}>
        CAMPAIGN
      </h1>

      {/* Points tally */}
      <div style={{
        display: 'flex',
        gap: 32,
        marginBottom: 24,
        fontSize: theme.fontSizes.md,
        fontFamily: theme.fonts.display,
      }}>
        <span style={{ color: theme.colors.imperial }}>
          Imperial: {campaign.imperialPoints} pts
        </span>
        <span style={{ color: theme.colors.textDim, fontFamily: theme.fonts.body }}>vs</span>
        <span style={{ color: theme.colors.chaos }}>
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
            <Panel
              key={scenario.id}
              variant={isCurrent ? 'parchment' : 'dark'}
              border={isCurrent ? theme.colors.gold : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
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
                fontSize: theme.fontSizes.xs,
                fontFamily: theme.fonts.display,
                fontWeight: 'bold',
                background: result
                  ? getFactionTheme(result.winner).primary
                  : isCurrent
                    ? theme.colors.goldFaint
                    : '#1a1a1a',
                color: result || isCurrent ? '#fff' : theme.colors.textFaint,
                border: result ? 'none' : `1px solid ${theme.colors.border}`,
                flexShrink: 0,
              }}>
                {result ? (result.winner === 'imperial' ? 'I' : 'C') : index + 1}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: theme.fontSizes.sm,
                  fontFamily: isCurrent ? theme.fonts.display : theme.fonts.body,
                  fontWeight: isCurrent ? 'bold' : 'normal',
                  color: isUpcoming ? theme.colors.textDim : theme.colors.text,
                }}>
                  {scenario.name}
                </div>
                <div style={{
                  fontSize: theme.fontSizes.xs,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textDim,
                }}>
                  {scenario.campaignPoints} pt{scenario.campaignPoints > 1 ? 's' : ''}
                  {result && ` — ${result.winner === 'imperial' ? 'Imperial' : 'Chaos'} victory (${result.turnCount} turns)`}
                </div>
              </div>

              {isCurrent && (
                <div style={{
                  fontSize: theme.fontSizes.xs,
                  fontFamily: theme.fonts.display,
                  color: theme.colors.gold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Next
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      {/* Current scenario description */}
      {currentScenario && (
        <Panel variant="parchment" style={{
          width: 480,
          maxWidth: '95vw',
          padding: '16px 20px',
          marginBottom: 24,
        }}>
          <p style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.sm,
            fontFamily: theme.fonts.body,
            lineHeight: 1.7,
            margin: 0,
            fontStyle: 'italic',
          }}>
            {currentScenario.description}
          </p>
        </Panel>
      )}

      {/* Action buttons */}
      <MedievalButton variant="primary" onClick={handleBeginBattle}>
        Begin Battle
      </MedievalButton>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <MedievalButton variant="ghost" size="sm" onClick={handleReset}>
          Reset Campaign
        </MedievalButton>
        <MedievalButton variant="ghost" size="sm" onClick={handleBack}>
          Back
        </MedievalButton>
      </div>
    </div>
  );
}
