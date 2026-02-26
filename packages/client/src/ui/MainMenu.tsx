import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

export function MainMenu() {
  const initGame = useGameStore((s) => s.initGame);
  const setScreen = useUIStore((s) => s.setScreen);

  const handleStartGame = () => {
    initGame();
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
        fontSize: '3rem',
        color: '#c4a35a',
        fontWeight: 'bold',
        marginBottom: 8,
        textShadow: '0 2px 10px rgba(196,163,90,0.3)',
        letterSpacing: '0.1em',
      }}>
        BATTLE MASTERS
      </h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 48 }}>
        A Digital Tabletop Wargame
      </p>

      <button
        onClick={handleStartGame}
        style={{
          background: 'linear-gradient(135deg, #c4a35a 0%, #8a7030 100%)',
          border: 'none',
          color: '#1a1a0f',
          padding: '14px 48px',
          borderRadius: 8,
          fontSize: '1.1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          boxShadow: '0 4px 20px rgba(196,163,90,0.3)',
          transition: 'transform 0.1s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Start Battle
      </button>

      <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
        <SmallBtn label="Campaign" onClick={() => setScreen('scenario_select')} />
        <SmallBtn label="Quick Game" onClick={handleStartGame} />
        <SmallBtn label="Settings" onClick={() => {}} disabled />
      </div>

      <div style={{
        position: 'absolute',
        bottom: 16,
        color: '#333',
        fontSize: '0.7rem',
      }}>
        Hot-seat local multiplayer
      </div>
    </div>
  );
}

function SmallBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid #333',
        color: disabled ? '#444' : '#888',
        padding: '8px 20px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.8rem',
      }}
    >
      {label}
    </button>
  );
}
