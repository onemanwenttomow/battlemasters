import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CAMPAIGN_SCENARIOS } from '@battle-masters/game-logic';

export function ScenarioSelect() {
  const initGame = useGameStore((s) => s.initGame);
  const setScreen = useUIStore((s) => s.setScreen);

  const handleSelect = (scenarioId: string) => {
    initGame(undefined, scenarioId);
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
        fontSize: '2rem',
        color: '#c4a35a',
        fontWeight: 'bold',
        marginBottom: 8,
        textShadow: '0 2px 10px rgba(196,163,90,0.3)',
        letterSpacing: '0.1em',
      }}>
        CAMPAIGN
      </h1>
      <p style={{
        color: '#999',
        fontSize: '0.85rem',
        marginBottom: 36,
        maxWidth: 520,
        lineHeight: 1.6,
        textAlign: 'center',
        padding: '0 16px',
      }}>
        Gorefist the Chaos Destroyer has sent his Chaos army across the border to destroy everything in its path. An Imperial Army is being assembled by the Grand Duke Ferdinand, one of the Empire's most decorated commanders. The Chaos army must be prevented from reaching and capturing one of the border watch towers which will give Gorefist a firm foothold in the Reikwald. The task of stopping Gorefist's Chaos army has fallen to you.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 400, maxWidth: '90vw' }}>
        {CAMPAIGN_SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => scenario.available && handleSelect(scenario.id)}
            disabled={!scenario.available}
            style={{
              background: scenario.available
                ? 'rgba(196,163,90,0.1)'
                : 'rgba(255,255,255,0.02)',
              border: scenario.available
                ? '1px solid rgba(196,163,90,0.4)'
                : '1px solid #222',
              color: scenario.available ? '#c4a35a' : '#444',
              padding: '14px 20px',
              borderRadius: 8,
              cursor: scenario.available ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'transform 0.1s, border-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (scenario.available) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.borderColor = 'rgba(196,163,90,0.7)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = scenario.available
                ? 'rgba(196,163,90,0.4)'
                : '#222';
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: 2 }}>
                {scenario.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: scenario.available ? '#888' : '#333' }}>
                {scenario.available ? `${scenario.campaignPoints} campaign point${scenario.campaignPoints > 1 ? 's' : ''}` : 'Coming Soon'}
              </div>
            </div>
            {scenario.available && (
              <div style={{ color: '#c4a35a', fontSize: '1.2rem' }}>&#9654;</div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => setScreen('menu')}
        style={{
          marginTop: 32,
          background: 'transparent',
          border: '1px solid #333',
          color: '#888',
          padding: '8px 24px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Back
      </button>
    </div>
  );
}
