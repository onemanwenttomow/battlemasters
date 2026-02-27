import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getUnitDefinition } from '@battle-masters/game-logic';
import type { PlaceableTerrainType } from '@battle-masters/game-logic';
import { getCardImage, getOgreSubCardImage } from './cardImages';

const FACTION_LABELS: Record<string, string> = {
  imperial: 'Imperial Army',
  chaos: 'Chaos Army',
};

const FACTION_COLORS: Record<string, string> = {
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
  const selectedDeploymentUnitType = useUIStore((s) => s.selectedDeploymentUnitType);
  const setSelectedDeploymentUnitType = useUIStore((s) => s.setSelectedDeploymentUnitType);
  const selectedTerrainPiece = useUIStore((s) => s.selectedTerrainPiece);
  const setSelectedTerrainPiece = useUIStore((s) => s.setSelectedTerrainPiece);
  const ditchPreviewOrientation = useUIStore((s) => s.ditchPreviewOrientation);
  const cycleDitchOrientation = useUIStore((s) => s.cycleDitchOrientation);

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

      {/* Terrain Placement Toolbar */}
      {state.currentPhase === 'terrain_placement' && state.availableTerrain && (
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 8,
          padding: '8px 12px',
          border: '2px solid #c4a35a',
          textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: '0.85rem', color: '#c4a35a', fontWeight: 'bold', marginBottom: 6 }}>
            Place Terrain
          </div>
          <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: 8 }}>
            {FACTION_LABELS[state.activeFaction]} places terrain pieces
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {([
              { type: 'tower' as const, label: 'Tower', count: state.availableTerrain.tower },
              { type: 'marsh' as const, label: 'Swamp', count: state.availableTerrain.marsh },
              { type: 'ditch' as const, label: 'Ditch', count: state.availableTerrain.ditch },
              { type: 'hedge' as const, label: 'Hedge', count: state.availableTerrain.hedge },
            ]).map(({ type, label, count }) => {
              const isSelected = selectedTerrainPiece === type;
              const disabled = count <= 0;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedTerrainPiece(isSelected ? null : type)}
                  disabled={disabled}
                  style={{
                    background: isSelected ? 'rgba(196,163,90,0.3)' : disabled ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                    border: `1px solid ${isSelected ? '#c4a35a' : disabled ? '#333' : '#666'}`,
                    color: isSelected ? '#c4a35a' : disabled ? '#555' : '#ccc',
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 'bold' : 'normal',
                  }}
                >
                  {label}: {count}
                </button>
              );
            })}
          </div>
          {selectedTerrainPiece === 'ditch' && (
            <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: 6 }}>
              Orientation: {ditchPreviewOrientation}{' '}
              <button
                onClick={cycleDitchOrientation}
                style={{
                  background: 'rgba(196,163,90,0.2)',
                  border: '1px solid #c4a35a',
                  color: '#c4a35a',
                  padding: '2px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                }}
              >
                Rotate (R)
              </button>
            </div>
          )}
          <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: 6 }}>
            Click to place. Right-click to remove.
          </div>
          <button
            onClick={() => dispatch({ type: 'FINISH_TERRAIN_PLACEMENT' })}
            style={btnStyle('#c4a35a')}
          >
            Done
          </button>
        </div>
      )}

      {/* Side Selection UI */}
      {state.currentPhase === 'side_selection' && (
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 10,
          padding: '16px 24px',
          border: '2px solid #c4a35a',
          textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: '1rem', color: '#c4a35a', fontWeight: 'bold', marginBottom: 8 }}>
            {FACTION_LABELS[state.activeFaction]} Chooses Side
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: 16 }}>
            Pick which side of the board to deploy on
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => dispatch({ type: 'SELECT_SIDE', side: 'top' })}
              style={{
                ...btnStyle('#c4a35a'),
                padding: '10px 24px',
                fontSize: '0.9rem',
              }}
            >
              Top (Rows 0-1)
            </button>
            <button
              onClick={() => dispatch({ type: 'SELECT_SIDE', side: 'bottom' })}
              style={{
                ...btnStyle('#c4a35a'),
                padding: '10px 24px',
                fontSize: '0.9rem',
              }}
            >
              Bottom (Rows 10-11)
            </button>
          </div>
        </div>
      )}

      {/* Deployment Phase UI */}
      {state.currentPhase === 'deployment' && state.unplacedUnits && (
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 8,
          padding: '8px 12px',
          border: '2px solid #44cc88',
          textAlign: 'center',
          maxWidth: 200,
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: '0.85rem', color: '#44cc88', fontWeight: 'bold', marginBottom: 6 }}>
            {state.standardGame && state.deploymentTurn
              ? `Deploy ${FACTION_LABELS[state.deploymentTurn]} Unit`
              : 'Deploy Units'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: 8 }}>
            Select a unit type, then click a hex in the deployment zone
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 6 }}>
            {state.unplacedUnits.length} unit{state.unplacedUnits.length !== 1 ? 's' : ''} remaining
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto' }}>
            {(() => {
              // Group unplaced units by type with counts (filtered by deployment turn in standard game)
              const counts = new Map<string, number>();
              for (const u of state.unplacedUnits!) {
                if (state.standardGame && state.deploymentTurn && u.faction !== state.deploymentTurn) continue;
                counts.set(u.type, (counts.get(u.type) || 0) + 1);
              }
              return Array.from(counts.entries()).map(([unitType, count]) => {
                const def = getUnitDefinition(unitType as import('@battle-masters/game-logic').UnitType);
                const isSelected = selectedDeploymentUnitType === unitType;
                return (
                  <button
                    key={unitType}
                    onClick={() => setSelectedDeploymentUnitType(isSelected ? null : unitType as import('@battle-masters/game-logic').UnitType)}
                    style={{
                      background: isSelected ? 'rgba(68,204,136,0.3)' : 'rgba(0,0,0,0.5)',
                      border: `1px solid ${isSelected ? '#44cc88' : '#555'}`,
                      color: isSelected ? '#44cc88' : '#ccc',
                      padding: '4px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 'bold' : 'normal',
                    }}
                  >
                    {def.name} {count > 1 ? `(${count})` : ''}
                  </button>
                );
              });
            })()}
          </div>
          {state.standardGame && state.deploymentSides && (
            <button
              onClick={() => dispatch({ type: 'AUTO_DEPLOY' })}
              style={{
                marginTop: 8,
                background: 'rgba(196,163,90,0.2)',
                border: '1px solid #c4a35a',
                color: '#c4a35a',
                padding: '5px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 'bold',
              }}
            >
              Auto Deploy All
            </button>
          )}
        </div>
      )}

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
