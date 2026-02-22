import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

const DIE_COLORS = {
  skull: '#ff4444',
  shield: '#4488ff',
  blank: '#666666',
};

const DIE_SYMBOLS = {
  skull: '\u2620',
  shield: '\u26E8',
  blank: '\u25CB',
};

export function DiceRoll() {
  const state = useGameStore((s) => s.state);
  const showDiceRoll = useUIStore((s) => s.showDiceRoll);
  const lastCombatResultIndex = useUIStore((s) => s.lastCombatResultIndex);
  const hideDice = useUIStore((s) => s.hideDice);

  useEffect(() => {
    if (showDiceRoll) {
      const timer = setTimeout(hideDice, 3000);
      return () => clearTimeout(timer);
    }
  }, [showDiceRoll, hideDice]);

  if (!showDiceRoll || !state || lastCombatResultIndex === null) return null;

  const event = state.combatLog[lastCombatResultIndex];
  if (!event) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.9)',
      borderRadius: 12,
      padding: '16px 24px',
      border: '2px solid #555',
      textAlign: 'center',
      animation: 'fadeIn 0.2s ease-out',
      pointerEvents: 'auto',
    }} onClick={hideDice}>
      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>Combat Result</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#ff8844', marginBottom: 4 }}>Attacker</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {event.result.attackerRolls.map((r, i) => (
              <Die key={i} result={r} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#4488ff', marginBottom: 4 }}>Defender</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {event.result.defenderRolls.map((r, i) => (
              <Die key={i} result={r} />
            ))}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: event.result.damage > 0 ? '#ff4444' : '#44cc44',
      }}>
        {event.result.damage > 0
          ? `${event.result.damage} Damage${event.result.unitDestroyed ? ' - Destroyed!' : ''}`
          : 'Blocked!'}
      </div>
    </div>
  );
}

function Die({ result }: { result: 'skull' | 'shield' | 'blank' }) {
  return (
    <div style={{
      width: 36,
      height: 36,
      borderRadius: 6,
      background: '#222',
      border: `2px solid ${DIE_COLORS[result]}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: DIE_COLORS[result],
    }}>
      {DIE_SYMBOLS[result]}
    </div>
  );
}
