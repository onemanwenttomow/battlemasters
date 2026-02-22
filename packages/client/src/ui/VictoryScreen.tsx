import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

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

  if (!state || !state.winner) return null;

  const color = FACTION_COLORS[state.winner];
  const name = FACTION_LABELS[state.winner];

  const handleRematch = () => {
    initGame();
    setScreen('game');
  };

  const handleMenu = () => {
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
      <p style={{ color: '#888', marginBottom: 32 }}>
        After {state.turnNumber} turns and {state.combatLog.length} battles
      </p>
      <div style={{ display: 'flex', gap: 16 }}>
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
