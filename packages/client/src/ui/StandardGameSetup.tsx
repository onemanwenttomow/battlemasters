import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { theme } from './theme';
import { MedievalButton } from './components/MedievalButton';
import type { Faction } from '@battle-masters/game-logic';

export function StandardGameSetup() {
  const initStandardGame = useGameStore((s) => s.initStandardGame);
  const setScreen = useUIStore((s) => s.setScreen);

  const handleSelect = (faction: Faction) => {
    initStandardGame(faction);
    setScreen('game');
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
        fontSize: theme.fontSizes['3xl'],
        fontFamily: theme.fonts.display,
        color: theme.colors.gold,
        fontWeight: 'normal',
        marginBottom: 8,
        textShadow: theme.shadows.text,
        letterSpacing: '0.1em',
      }}>
        STANDARD GAME
      </h1>
      <p style={{
        color: theme.colors.textMuted,
        fontSize: theme.fontSizes.sm,
        marginBottom: 12,
        fontFamily: theme.fonts.body,
      }}>
        Choose which faction places terrain
      </p>
      <p style={{
        color: theme.colors.textDim,
        fontSize: theme.fontSizes.sm,
        marginBottom: 48,
        maxWidth: 400,
        textAlign: 'center',
        lineHeight: 1.5,
        fontFamily: theme.fonts.body,
        fontStyle: 'italic',
      }}>
        The terrain placer sets up the battlefield. The other player then chooses which side to deploy on.
      </p>

      <div style={{ display: 'flex', gap: 24 }}>
        <MedievalButton
          variant="secondary"
          size="lg"
          onClick={() => handleSelect('imperial')}
          style={{
            color: theme.colors.imperial,
            borderColor: theme.factions.imperial.border,
            boxShadow: `0 4px 20px ${theme.colors.imperialGlow}`,
          }}
        >
          Imperial
        </MedievalButton>
        <MedievalButton
          variant="secondary"
          size="lg"
          onClick={() => handleSelect('chaos')}
          style={{
            color: theme.colors.chaos,
            borderColor: theme.factions.chaos.border,
            boxShadow: `0 4px 20px ${theme.colors.chaosGlow}`,
          }}
        >
          Dark Legion
        </MedievalButton>
      </div>

      <MedievalButton
        variant="ghost"
        size="sm"
        onClick={() => setScreen('menu')}
        style={{ marginTop: 48 }}
      >
        Back
      </MedievalButton>
    </div>
  );
}
