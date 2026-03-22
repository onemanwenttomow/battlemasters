import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { theme } from './theme';
import { MedievalButton } from './components/MedievalButton';
import { Panel } from './components/Panel';

export function MainMenu() {
  const initGame = useGameStore((s) => s.initGame);
  const setScreen = useUIStore((s) => s.setScreen);

  const handleQuickGame = () => {
    initGame();
    setScreen('game');
  };

  const handleStandardGame = () => {
    setScreen('standard_game_setup');
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
        fontSize: theme.fontSizes['4xl'],
        fontFamily: theme.fonts.display,
        color: theme.colors.gold,
        fontWeight: 'normal',
        marginBottom: 8,
        textShadow: theme.shadows.text,
        letterSpacing: '0.12em',
      }}>
        BATTLE MASTERS
      </h1>
      <p style={{
        color: theme.colors.textDim,
        fontSize: theme.fontSizes.sm,
        marginBottom: 48,
        fontFamily: theme.fonts.body,
        fontStyle: 'italic',
        letterSpacing: '0.05em',
      }}>
        A Digital Tabletop Wargame
      </p>

      <MedievalButton
        variant="primary"
        size="lg"
        onClick={handleStandardGame}
      >
        Start Battle
      </MedievalButton>

      <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
        <MedievalButton variant="ghost" size="sm" onClick={() => setScreen('campaign_overview')}>
          Campaign
        </MedievalButton>
        <MedievalButton variant="ghost" size="sm" onClick={() => setScreen('scenario_select')}>
          Scenarios
        </MedievalButton>
        <MedievalButton variant="ghost" size="sm" onClick={handleQuickGame}>
          Quick Game
        </MedievalButton>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 16,
        color: theme.colors.textFaint,
        fontSize: theme.fontSizes.xs,
        fontFamily: theme.fonts.body,
      }}>
        Hot-seat local multiplayer
      </div>
    </div>
  );
}
