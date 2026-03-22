import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useCampaignStore } from '../store/campaignStore';
import { getScenarioById, isCampaignComplete } from '@battle-masters/game-logic';
import { theme, getFactionTheme, getFactionLabel } from './theme';
import { MedievalButton } from './components/MedievalButton';
import { Panel } from './components/Panel';

export function VictoryScreen() {
  const state = useGameStore((s) => s.state);
  const initGame = useGameStore((s) => s.initGame);
  const setScreen = useUIStore((s) => s.setScreen);
  const isCampaignBattle = useUIStore((s) => s.isCampaignBattle);
  const setIsCampaignBattle = useUIStore((s) => s.setIsCampaignBattle);
  const campaignRecordResult = useCampaignStore((s) => s.recordBattleResult);
  const campaign = useCampaignStore((s) => s.campaign);

  if (!state || !state.winner) return null;

  const factionTheme = getFactionTheme(state.winner);
  const name = getFactionLabel(state.winner);

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
      background: theme.colors.bgOverlay,
      zIndex: 100,
    }}>
      <Panel variant="parchment" ornate style={{
        padding: '40px 56px',
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
          Victory!
        </div>
        <h1 style={{
          fontSize: theme.fontSizes['3xl'],
          fontFamily: theme.fonts.display,
          color: factionTheme.primary,
          fontWeight: 'normal',
          marginBottom: 16,
          textShadow: theme.shadows.textGlow(factionTheme.glow),
        }}>
          {name} Wins
        </h1>
        {victoryMessage && (
          <p style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.lg,
            marginBottom: 8,
            fontStyle: 'italic',
            fontFamily: theme.fonts.body,
          }}>
            {victoryMessage}
          </p>
        )}
        <p style={{
          color: theme.colors.textDim,
          marginBottom: 32,
          fontFamily: theme.fonts.body,
        }}>
          After {state.turnNumber} turns and {state.combatLog.length} battles
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {isCampaignBattle ? (
            <MedievalButton variant="primary" onClick={handleContinueCampaign}>
              Continue Campaign
            </MedievalButton>
          ) : (
            <MedievalButton variant="primary" onClick={handleRematch}>
              Rematch
            </MedievalButton>
          )}
          <MedievalButton variant="ghost" onClick={handleMenu}>
            Main Menu
          </MedievalButton>
        </div>
      </Panel>
    </div>
  );
}
