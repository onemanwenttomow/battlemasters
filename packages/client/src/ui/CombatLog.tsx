import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { theme } from './theme';
import { Panel } from './components/Panel';
import { MedievalButton } from './components/MedievalButton';
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
  flying: theme.colors.info,
  bouncing: '#ffaa44',
  explosion: '#ff3333',
};

function MeleeCombatEntry({ event }: { event: MeleeCombatEvent }) {
  return (
    <>
      <div style={{ color: theme.colors.textMuted, fontSize: '0.65rem', fontFamily: theme.fonts.body }}>
        <span style={{ color: theme.colors.warning }}>{event.attackerName}</span>
        {' vs '}
        <span style={{ color: theme.colors.info }}>{event.defenderName}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ color: theme.colors.warning, fontSize: '0.6rem', fontFamily: theme.fonts.body }}>ATK:</span>
        {event.result.attackerRolls.map((r, i) => (
          <img key={`a${i}`} src={DIE_IMAGES[r]} alt={r} style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
        ))}
        <span style={{ color: theme.colors.info, fontSize: '0.6rem', marginLeft: 4, fontFamily: theme.fonts.body }}>DEF:</span>
        {event.result.defenderRolls.map((r, i) => (
          <img key={`d${i}`} src={DIE_IMAGES[r]} alt={r} style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
        ))}
      </div>
      <div style={{ fontFamily: theme.fonts.body }}>
        {event.result.damage > 0 ? (
          <span style={{ color: theme.colors.danger }}>
            {event.result.damage} damage{event.result.unitDestroyed ? ' - DESTROYED!' : ''}
          </span>
        ) : (
          <span style={{ color: theme.colors.success }}>Blocked!</span>
        )}
      </div>
    </>
  );
}

function CannonFireEntry({ event }: { event: CannonFireEvent }) {
  return (
    <>
      <div style={{ color: theme.colors.textMuted, fontSize: '0.65rem', fontFamily: theme.fonts.body }}>
        <span style={{ color: theme.colors.warning }}>{event.cannonName}</span>
        {event.targetName ? (
          <>{' \u2192 '}<span style={{ color: theme.colors.info }}>{event.targetName}</span></>
        ) : (
          <>{' \u2192 '}<span style={{ color: theme.colors.textDim }}>empty hex</span></>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {event.tileResults.map((tr, i) => (
          <span key={i} style={{ color: TILE_COLORS[tr.tileType] }}>
            {TILE_SYMBOLS[tr.tileType]}
          </span>
        ))}
      </div>
      <div style={{ fontFamily: theme.fonts.body }}>
        {event.misfire ? (
          <span style={{ color: '#ff3333' }}>MISFIRE!</span>
        ) : event.targetDestroyed ? (
          <span style={{ color: theme.colors.danger }}>Target destroyed!</span>
        ) : (
          <span style={{ color: theme.colors.textMuted }}>Shot stopped</span>
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
      <MedievalButton
        variant="ghost"
        size="sm"
        onClick={toggleCombatLog}
        style={{ width: '100%', marginBottom: 4 }}
      >
        Combat Log ({state.combatLog.length}) {showCombatLog ? '\u25BC' : '\u25B2'}
      </MedievalButton>

      {showCombatLog && (
        <Panel variant="dark" style={{
          padding: 8,
          maxHeight: 200,
          overflowY: 'auto',
          fontSize: theme.fontSizes.sm,
        }}>
          {state.combatLog.length === 0 && (
            <div style={{
              color: theme.colors.textDim,
              textAlign: 'center',
              fontFamily: theme.fonts.body,
              fontStyle: 'italic',
            }}>
              No combat yet
            </div>
          )}
          {[...state.combatLog].reverse().slice(0, 10).map((event: CombatEvent, i: number) => (
            <div key={i} style={{
              borderBottom: `1px solid ${theme.colors.border}`,
              padding: '4px 0',
              color: theme.colors.text,
            }}>
              <div style={{
                color: theme.colors.textMuted,
                fontSize: '0.65rem',
                fontFamily: theme.fonts.body,
              }}>
                Turn {event.turnNumber}
              </div>
              {event.type === 'melee' ? (
                <MeleeCombatEntry event={event} />
              ) : (
                <CannonFireEntry event={event} />
              )}
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
