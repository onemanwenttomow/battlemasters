import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getUnitDefinition } from '@battle-masters/game-logic';

const FACTION_LABELS = {
  imperial: 'Imperial Army',
  chaos: 'Chaos Army',
};

const FACTION_COLORS = {
  imperial: '#4488cc',
  chaos: '#cc4444',
};

export function GameHUD() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const showCoords = useUIStore((s) => s.showCoords);
  const toggleCoords = useUIStore((s) => s.toggleCoords);

  if (!state) return null;

  const factionColor = FACTION_COLORS[state.activeFaction];
  const factionName = FACTION_LABELS[state.activeFaction];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '12px 16px',
      pointerEvents: 'none',
    }}>
      {/* Turn & Phase */}
      <div style={{
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 8,
        padding: '8px 16px',
        pointerEvents: 'auto',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>Turn {state.turnNumber}</div>
        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: factionColor }}>
          {factionName}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#aaa', textTransform: 'capitalize' }}>
          {state.currentPhase.replace('_', ' ')}
        </div>
      </div>

      {/* Current Card */}
      {state.currentCard && (
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 8,
          padding: '8px 16px',
          border: `2px solid ${factionColor}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#888' }}>Battle Card</div>
          <div style={{ fontSize: '0.85rem', color: factionColor, fontWeight: 'bold' }}>
            {state.currentCard.unitTypes.map(t => getUnitDefinition(t).name).join(', ')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#aaa' }}>
            {state.currentCard.special
              ? state.currentCard.special.replace('_', ' ')
              : `Activate ${state.currentCard.count}`}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2 }}>
            {state.activatedUnitIds.length} / {Math.min(state.currentCard.count, 99)} activated
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'auto',
      }}>
        <button
          onClick={toggleCoords}
          style={btnStyle(showCoords ? '#c4a35a' : '#555')}
        >
          {showCoords ? 'Hide Coords' : 'Show Coords'}
        </button>
        {state.currentPhase === 'draw_card' && (
          <button onClick={() => dispatch({ type: 'DRAW_CARD' })} style={btnStyle(factionColor)}>
            Draw Card
          </button>
        )}
        {state.currentPhase === 'activation' && (
          <>
            {state.selectedUnitId && (
              <button onClick={() => dispatch({ type: 'END_ACTIVATION' })} style={btnStyle('#888')}>
                End Unit
              </button>
            )}
            <button onClick={() => dispatch({ type: 'PASS' })} style={btnStyle('#666')}>
              Pass
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: 'rgba(0,0,0,0.7)',
    border: `1px solid ${color}`,
    color: '#e0e0e0',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
  };
}
