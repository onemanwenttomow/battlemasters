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

export function DiceRoll({ onDismiss }: { onDismiss?: () => void }) {
  const state = useGameStore((s) => s.state);
  const showDiceRoll = useUIStore((s) => s.showDiceRoll);
  const lastCombatResultIndex = useUIStore((s) => s.lastCombatResultIndex);
  const combatEffectInfo = useUIStore((s) => s.combatEffectInfo);
  const hideDice = useUIStore((s) => s.hideDice);

  if (!showDiceRoll || !state || lastCombatResultIndex === null) return null;

  const event = state.combatLog[lastCombatResultIndex];
  if (!event || event.type !== 'melee') return null;

  const isCharge = combatEffectInfo?.isCharge ?? false;

  const handleDismiss = () => {
    onDismiss?.();
    hideDice();
  };

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
      cursor: 'pointer',
      zIndex: 101,
    }} onClick={handleDismiss}>
      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>Combat Result</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#ff8844', marginBottom: 4 }}>Attacker</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {event.result.attackerRolls.map((r, i) => (
              <Die key={i} result={r} isBonus={isCharge && i === event.result.attackerRolls.length - 1} />
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

      <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 8 }}>
        Click to dismiss
      </div>
    </div>
  );
}

function Die({ result, isBonus }: { result: 'skull' | 'shield' | 'blank'; isBonus?: boolean }) {
  return (
    <div style={{
      width: 36,
      height: 36,
      borderRadius: 6,
      background: isBonus ? '#2a2200' : '#222',
      border: `2px solid ${isBonus ? '#ffcc00' : DIE_COLORS[result]}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: isBonus ? '#ffcc00' : DIE_COLORS[result],
      boxShadow: isBonus ? '0 0 6px rgba(255, 204, 0, 0.4)' : undefined,
      position: 'relative' as const,
    }}>
      {DIE_SYMBOLS[result]}
      {isBonus && <div style={{
        position: 'absolute',
        bottom: -14,
        fontSize: '0.5rem',
        color: '#ffcc00',
        whiteSpace: 'nowrap',
      }}>CHARGE</div>}
    </div>
  );
}
