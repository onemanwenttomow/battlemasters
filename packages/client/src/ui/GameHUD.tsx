import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getUnitDefinition } from '@battle-masters/game-logic';
import { getCardImage, getOgreSubCardImage } from './cardImages';

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
  const cannonFiringStep = useUIStore((s) => s.cannonFiringStep);
  const setCannonFiringStep = useUIStore((s) => s.setCannonFiringStep);
  const previewCannonPath = useUIStore((s) => s.previewCannonPath);
  const setPreviewCannonPath = useUIStore((s) => s.setPreviewCannonPath);
  const setShowCannonOverlay = useUIStore((s) => s.setShowCannonOverlay);

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
          padding: '8px 12px',
          border: `2px solid ${factionColor}`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <img
            src={state.currentPhase === 'ogre_rampage' && state.currentOgreSubCard
              ? getOgreSubCardImage(state.currentOgreSubCard.type)
              : getCardImage(state.currentCard)}
            alt="Battle Card"
            style={{
              width: 120,
              height: 'auto',
              borderRadius: 4,
              marginBottom: 6,
            }}
          />
          <div style={{ fontSize: '0.75rem', color: factionColor, fontWeight: 'bold' }}>
            {state.currentCard.unitTypes.map(t => getUnitDefinition(t).name).join(', ')}
          </div>
          {state.currentCard.special && (
            <div style={{ fontSize: '0.65rem', color: '#aaa' }}>
              {state.currentCard.special.replace('_', ' ')}
            </div>
          )}
          {state.currentPhase === 'ogre_rampage' ? (
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2 }}>
              Sub-card {state.ogreSubCardIndex} / {state.ogreSubCardsTotal}
              {state.currentOgreSubCard && (
                <span style={{ color: state.currentOgreSubCard.type === 'ogre_move' ? '#4488ff' : '#ff4444', marginLeft: 4 }}>
                  [{state.currentOgreSubCard.type === 'ogre_move' ? 'MOVE' : 'ATTACK'}]
                </span>
              )}
            </div>
          ) : state.currentPhase === 'cannon_fire' ? (
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2 }}>
              {cannonFiringStep === 'idle' && 'Move or Fire'}
              {cannonFiringStep === 'targeting' && 'Select Target'}
              {cannonFiringStep === 'path_select' && (previewCannonPath ? 'Confirm or pick another' : 'Click a hex to preview path')}
              {cannonFiringStep === 'drawing' && `Drawing Tiles${state.cannonFireState ? ` (${state.cannonFireState.placedTiles.length})` : ''}`}
              {cannonFiringStep === 'resolved' && (
                state.cannonFireState?.misfire ? 'MISFIRE!' :
                state.cannonFireState?.targetDestroyed ? 'Target Destroyed!' : 'Shot Complete'
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2 }}>
              {state.activatedUnitIds.length} activated
            </div>
          )}
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
        {state.currentPhase === 'ogre_rampage' && (
          <>
            {state.currentOgreSubCard === null && state.ogreSubCardIndex < state.ogreSubCardsTotal && (
              <button onClick={() => dispatch({ type: 'DRAW_OGRE_CARD' })} style={btnStyle(factionColor)}>
                Draw Ogre Card ({state.ogreSubCardIndex + 1}/{state.ogreSubCardsTotal})
              </button>
            )}
            {state.currentOgreSubCard !== null && (
              <button onClick={() => dispatch({ type: 'END_OGRE_ACTIVATION' })} style={btnStyle('#888')}>
                Skip
              </button>
            )}
            <button onClick={() => dispatch({ type: 'PASS' })} style={btnStyle('#666')}>
              End Rampage
            </button>
          </>
        )}
        {state.currentPhase === 'cannon_fire' && (
          <>
            {cannonFiringStep === 'idle' && (
              <>
                <button onClick={() => setCannonFiringStep('targeting')} style={btnStyle('#ff8844')}>
                  Fire Cannon
                </button>
                <button onClick={() => dispatch({ type: 'PASS' })} style={btnStyle('#666')}>
                  Pass
                </button>
              </>
            )}
            {cannonFiringStep === 'targeting' && (
              <button onClick={() => setCannonFiringStep('idle')} style={btnStyle('#888')}>
                Cancel
              </button>
            )}
            {cannonFiringStep === 'path_select' && (
              <>
                {previewCannonPath && (
                  <button onClick={() => {
                    dispatch({ type: 'SELECT_CANNON_PATH', path: previewCannonPath });
                    setCannonFiringStep('drawing');
                    setShowCannonOverlay(true);
                    setPreviewCannonPath(null);
                  }} style={btnStyle('#ff8844')}>
                    Confirm Path
                  </button>
                )}
                <button onClick={() => {
                  setPreviewCannonPath(null);
                  setCannonFiringStep('idle');
                  dispatch({ type: 'END_CANNON_FIRE' });
                }} style={btnStyle('#888')}>
                  Cancel
                </button>
              </>
            )}
            {(cannonFiringStep === 'resolved' || (state.cannonFireState && state.cannonFireState.resolved)) && (
              <button onClick={() => {
                setCannonFiringStep('idle');
                dispatch({ type: 'END_CANNON_FIRE' });
              }} style={btnStyle('#888')}>
                End
              </button>
            )}
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
