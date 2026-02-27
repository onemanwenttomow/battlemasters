import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
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
        fontSize: '2.5rem',
        color: '#c4a35a',
        fontWeight: 'bold',
        marginBottom: 8,
        textShadow: '0 2px 10px rgba(196,163,90,0.3)',
        letterSpacing: '0.1em',
      }}>
        STANDARD GAME
      </h1>
      <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: 12 }}>
        Choose which faction places terrain
      </p>
      <p style={{ color: '#666', fontSize: '0.75rem', marginBottom: 48, maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
        The terrain placer sets up the battlefield. The other player then chooses which side to deploy on.
      </p>

      <div style={{ display: 'flex', gap: 24 }}>
        <FactionButton
          label="Imperial"
          color="#4488cc"
          onClick={() => handleSelect('imperial')}
        />
        <FactionButton
          label="Dark Legion"
          color="#cc4444"
          onClick={() => handleSelect('chaos')}
        />
      </div>

      <button
        onClick={() => setScreen('menu')}
        style={{
          marginTop: 48,
          background: 'transparent',
          border: '1px solid #444',
          color: '#888',
          padding: '8px 24px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.8rem',
        }}
      >
        Back
      </button>
    </div>
  );
}

function FactionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 100%)`,
        border: `2px solid ${color}`,
        color: '#e0e0e0',
        padding: '20px 36px',
        borderRadius: 10,
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        letterSpacing: '0.05em',
        transition: 'transform 0.1s, box-shadow 0.1s',
        boxShadow: `0 4px 20px ${color}22`,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = `0 4px 30px ${color}44`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = `0 4px 20px ${color}22`;
      }}
    >
      {label}
    </button>
  );
}
