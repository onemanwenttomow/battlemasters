import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

const DIE_SYMBOLS = {
  skull: '\u2620',
  shield: '\u26E8',
  blank: '\u25CB',
};

export function CombatLog() {
  const state = useGameStore((s) => s.state);
  const showCombatLog = useUIStore((s) => s.showCombatLog);
  const toggleCombatLog = useUIStore((s) => s.toggleCombatLog);

  if (!state) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      right: 16,
      maxWidth: 280,
    }}>
      <button
        onClick={toggleCombatLog}
        style={{
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid #555',
          color: '#aaa',
          padding: '4px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.75rem',
          marginBottom: 4,
          width: '100%',
        }}
      >
        Combat Log ({state.combatLog.length}) {showCombatLog ? '\u25BC' : '\u25B2'}
      </button>

      {showCombatLog && (
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 8,
          padding: 8,
          maxHeight: 200,
          overflowY: 'auto',
          fontSize: '0.75rem',
        }}>
          {state.combatLog.length === 0 && (
            <div style={{ color: '#666', textAlign: 'center' }}>No combat yet</div>
          )}
          {[...state.combatLog].reverse().slice(0, 10).map((event, i) => (
            <div key={i} style={{
              borderBottom: '1px solid #222',
              padding: '4px 0',
              color: '#ccc',
            }}>
              <div style={{ color: '#888', fontSize: '0.65rem' }}>Turn {event.turnNumber}</div>
              <div>
                <span style={{ color: '#ff8844' }}>
                  ATK: {event.result.attackerRolls.map(r => DIE_SYMBOLS[r]).join(' ')}
                </span>
                {' '}
                <span style={{ color: '#4488ff' }}>
                  DEF: {event.result.defenderRolls.map(r => DIE_SYMBOLS[r]).join(' ')}
                </span>
              </div>
              <div>
                {event.result.damage > 0 ? (
                  <span style={{ color: '#ff4444' }}>
                    {event.result.damage} damage{event.result.unitDestroyed ? ' - DESTROYED!' : ''}
                  </span>
                ) : (
                  <span style={{ color: '#44cc44' }}>Blocked!</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
