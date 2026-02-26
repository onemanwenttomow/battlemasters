import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import type { CombatEvent, MeleeCombatEvent, CannonFireEvent } from '@battle-masters/game-logic';

const DIE_IMAGES: Record<string, string> = {
  skull: '/assets/dice/skull.png',
  shield: '/assets/dice/shield.png',
  blank: '/assets/dice/blank.png',
};

const TILE_SYMBOLS: Record<string, string> = {
  flying: '\u27A4',
  bouncing: '\u26AB',
  explosion: '\u2738',
};

const TILE_COLORS: Record<string, string> = {
  flying: '#4488ff',
  bouncing: '#ffaa44',
  explosion: '#ff3333',
};

function MeleeCombatEntry({ event }: { event: MeleeCombatEvent }) {
  return (
    <>
      <div style={{ color: '#aaa', fontSize: '0.65rem' }}>
        <span style={{ color: '#ff8844' }}>{event.attackerName}</span>
        {' vs '}
        <span style={{ color: '#4488ff' }}>{event.defenderName}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ color: '#ff8844', fontSize: '0.6rem' }}>ATK:</span>
        {event.result.attackerRolls.map((r, i) => (
          <img key={`a${i}`} src={DIE_IMAGES[r]} alt={r} style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
        ))}
        <span style={{ color: '#4488ff', fontSize: '0.6rem', marginLeft: 4 }}>DEF:</span>
        {event.result.defenderRolls.map((r, i) => (
          <img key={`d${i}`} src={DIE_IMAGES[r]} alt={r} style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
        ))}
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
    </>
  );
}

function CannonFireEntry({ event }: { event: CannonFireEvent }) {
  return (
    <>
      <div style={{ color: '#aaa', fontSize: '0.65rem' }}>
        <span style={{ color: '#ff8844' }}>{event.cannonName}</span>
        {event.targetName ? (
          <>{' \u2192 '}<span style={{ color: '#4488ff' }}>{event.targetName}</span></>
        ) : (
          <>{' \u2192 '}<span style={{ color: '#666' }}>empty hex</span></>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {event.tileResults.map((tr, i) => (
          <span key={i} style={{ color: TILE_COLORS[tr.tileType] }}>
            {TILE_SYMBOLS[tr.tileType]}
          </span>
        ))}
      </div>
      <div>
        {event.misfire ? (
          <span style={{ color: '#ff3333' }}>MISFIRE!</span>
        ) : event.targetDestroyed ? (
          <span style={{ color: '#ff4444' }}>Target destroyed!</span>
        ) : (
          <span style={{ color: '#aaa' }}>Shot stopped</span>
        )}
        {event.tileResults.some(tr => tr.unitHit && !tr.destroyed) && (
          <span style={{ color: '#ffaa44', marginLeft: 4 }}>
            {event.tileResults.filter(tr => tr.unitHit && tr.damage > 0).map(tr => `${tr.unitHit} hit`).join(', ')}
          </span>
        )}
      </div>
    </>
  );
}

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
          {[...state.combatLog].reverse().slice(0, 10).map((event: CombatEvent, i: number) => (
            <div key={i} style={{
              borderBottom: '1px solid #222',
              padding: '4px 0',
              color: '#ccc',
            }}>
              <div style={{ color: '#888', fontSize: '0.65rem' }}>Turn {event.turnNumber}</div>
              {event.type === 'melee' ? (
                <MeleeCombatEntry event={event} />
              ) : (
                <CannonFireEntry event={event} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
