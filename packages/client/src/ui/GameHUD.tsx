import { useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getUnitDefinition } from '@battle-masters/game-logic';
import type { PlaceableTerrainType } from '@battle-masters/game-logic';
import { getCardImage, getOgreSubCardImage } from './cardImages';
import { theme, getFactionTheme, getFactionLabel } from './theme';
import { MedievalButton } from './components/MedievalButton';
import { Panel } from './components/Panel';

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
  const ditchPreviewFortifiedSides = useUIStore((s) => s.ditchPreviewFortifiedSides);
  const cycleDitchFortifiedSides = useUIStore((s) => s.cycleDitchFortifiedSides);
  const deploymentHandoffFaction = useUIStore((s) => s.deploymentHandoffFaction);
  const setDeploymentHandoffFaction = useUIStore((s) => s.setDeploymentHandoffFaction);

  // Show handoff at the very start of hidden deployment (first turn, once only)
  const initialHandoffShown = useRef(false);
  if (state?.hiddenDeployment && state.currentPhase === 'deployment'
    && state.units.size === 0 && !deploymentHandoffFaction && !initialHandoffShown.current) {
    initialHandoffShown.current = true;
    setTimeout(() => setDeploymentHandoffFaction(state.deploymentTurn!), 0);
  }

  if (!state) return null;

  const factionTheme = getFactionTheme(state.activeFaction);
  const factionName = getFactionLabel(state.activeFaction);

  return (<>
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
      <Panel variant="dark" style={{
        padding: '8px 16px',
        pointerEvents: 'auto',
        borderLeft: `3px solid ${factionTheme.primary}`,
      }}>
        <div style={{
          fontSize: theme.fontSizes.xs,
          fontFamily: theme.fonts.body,
          color: theme.colors.textMuted,
        }}>
          Turn {state.turnNumber}
        </div>
        <div style={{
          fontSize: theme.fontSizes.md,
          fontFamily: theme.fonts.display,
          color: factionTheme.primary,
        }}>
          {factionName}
        </div>
        <div style={{
          fontSize: theme.fontSizes.xs,
          fontFamily: theme.fonts.body,
          color: theme.colors.textMuted,
          textTransform: 'capitalize',
        }}>
          {state.currentPhase.replace('_', ' ')}
        </div>
      </Panel>

      {/* Terrain Placement Toolbar */}
      {state.currentPhase === 'terrain_placement' && state.availableTerrain && (
        <Panel variant="parchment" border={theme.colors.gold} style={{
          padding: '8px 12px',
          textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{
            fontSize: theme.fontSizes.sm,
            fontFamily: theme.fonts.display,
            color: theme.colors.gold,
            marginBottom: 6,
          }}>
            Place Terrain
          </div>
          <div style={{
            fontSize: theme.fontSizes.xs,
            fontFamily: theme.fonts.body,
            color: theme.colors.textMuted,
            marginBottom: 8,
          }}>
            {getFactionLabel(state.activeFaction)} places terrain pieces
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
                    background: isSelected ? theme.colors.goldFaint : disabled ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                    border: `1px solid ${isSelected ? theme.colors.gold : disabled ? theme.colors.border : theme.colors.borderLight}`,
                    color: isSelected ? theme.colors.gold : disabled ? theme.colors.textDim : theme.colors.text,
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: theme.fontSizes.xs,
                    fontFamily: theme.fonts.body,
                    fontWeight: isSelected ? 'bold' : 'normal',
                  }}
                >
                  {label}: {count}
                </button>
              );
            })}
          </div>
          {selectedTerrainPiece === 'ditch' && (
            <div style={{
              fontSize: theme.fontSizes.xs,
              fontFamily: theme.fonts.body,
              color: theme.colors.textMuted,
              marginBottom: 6,
            }}>
              Orientation: {ditchPreviewOrientation}{' '}
              <MedievalButton variant="secondary" size="sm" onClick={cycleDitchOrientation}
                style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                Rotate (R)
              </MedievalButton>
              {' '}Fortified: {ditchPreviewFortifiedSides}{' '}
              <MedievalButton variant="secondary" size="sm" onClick={cycleDitchFortifiedSides}
                style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                Variant (V)
              </MedievalButton>
            </div>
          )}
          <div style={{
            fontSize: '0.65rem',
            fontFamily: theme.fonts.body,
            color: theme.colors.textDim,
            marginBottom: 6,
          }}>
            Click to place. Right-click to remove.
          </div>
          <MedievalButton variant="primary" size="sm" onClick={() => dispatch({ type: 'FINISH_TERRAIN_PLACEMENT' })}>
            Done
          </MedievalButton>
        </Panel>
      )}

      {/* Side Selection UI */}
      {state.currentPhase === 'side_selection' && (
        <Panel variant="parchment" ornate border={theme.colors.gold} style={{
          padding: '16px 24px',
          textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{
            fontSize: theme.fontSizes.md,
            fontFamily: theme.fonts.display,
            color: theme.colors.gold,
            marginBottom: 8,
          }}>
            {getFactionLabel(state.activeFaction)} Chooses Side
          </div>
          <div style={{
            fontSize: theme.fontSizes.xs,
            fontFamily: theme.fonts.body,
            color: theme.colors.textMuted,
            marginBottom: 16,
          }}>
            Pick which side of the board to deploy on
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <MedievalButton variant="secondary" onClick={() => dispatch({ type: 'SELECT_SIDE', side: 'top' })}>
              Top (Rows 0-1)
            </MedievalButton>
            <MedievalButton variant="secondary" onClick={() => dispatch({ type: 'SELECT_SIDE', side: 'bottom' })}>
              Bottom (Rows 10-11)
            </MedievalButton>
          </div>
        </Panel>
      )}

      {/* Deployment Phase UI */}
      {state.currentPhase === 'deployment' && state.unplacedUnits && (
        <Panel variant="dark" border={theme.colors.success} style={{
          padding: '8px 12px',
          textAlign: 'center',
          maxWidth: 200,
          pointerEvents: 'auto',
        }}>
          <div style={{
            fontSize: theme.fontSizes.sm,
            fontFamily: theme.fonts.display,
            color: theme.colors.success,
            marginBottom: 6,
          }}>
            {(state.standardGame || state.hiddenDeployment) && state.deploymentTurn
              ? `Deploy ${getFactionLabel(state.deploymentTurn)} Unit`
              : 'Deploy Units'}
          </div>
          <div style={{
            fontSize: theme.fontSizes.xs,
            fontFamily: theme.fonts.body,
            color: theme.colors.textMuted,
            marginBottom: 8,
          }}>
            Select a unit type, then click a hex in the deployment zone
          </div>
          <div style={{
            fontSize: theme.fontSizes.xs,
            fontFamily: theme.fonts.body,
            color: theme.colors.textMuted,
            marginBottom: 6,
          }}>
            {(() => {
              const count = (state.standardGame || state.hiddenDeployment) && state.deploymentTurn
                ? state.unplacedUnits.filter(u => u.faction === state.deploymentTurn).length
                : state.unplacedUnits.length;
              return `${count} unit${count !== 1 ? 's' : ''} remaining`;
            })()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto' }}>
            {(() => {
              const counts = new Map<string, number>();
              for (const u of state.unplacedUnits!) {
                if ((state.standardGame || state.hiddenDeployment) && state.deploymentTurn && u.faction !== state.deploymentTurn) continue;
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
                      border: `1px solid ${isSelected ? theme.colors.success : theme.colors.borderLight}`,
                      color: isSelected ? theme.colors.success : theme.colors.text,
                      padding: '4px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: theme.fontSizes.xs,
                      fontFamily: theme.fonts.body,
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
            <MedievalButton
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: 'AUTO_DEPLOY' })}
              style={{ marginTop: 8 }}
            >
              Auto Deploy All
            </MedievalButton>
          )}
        </Panel>
      )}

      {/* Current Card */}
      {state.currentCard && (
        <Panel variant="dark" border={factionTheme.primary} style={{
          padding: '8px 12px',
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
          <div style={{
            fontSize: theme.fontSizes.xs,
            fontFamily: theme.fonts.display,
            color: factionTheme.primary,
          }}>
            {state.currentCard.unitTypes.map(t => getUnitDefinition(t).name).join(', ')}
          </div>
          {state.currentCard.special && (
            <div style={{
              fontSize: '0.65rem',
              fontFamily: theme.fonts.body,
              color: theme.colors.textMuted,
            }}>
              {state.currentCard.special.replace('_', ' ')}
            </div>
          )}
          {state.currentPhase === 'ogre_rampage' ? (
            <div style={{
              fontSize: theme.fontSizes.xs,
              fontFamily: theme.fonts.body,
              color: theme.colors.textDim,
              marginTop: 2,
            }}>
              Sub-card {state.ogreSubCardIndex} / {state.ogreSubCardsTotal}
              {state.currentOgreSubCard && (
                <span style={{
                  color: state.currentOgreSubCard.type === 'ogre_move' ? theme.colors.info : theme.colors.danger,
                  marginLeft: 4,
                }}>
                  [{state.currentOgreSubCard.type === 'ogre_move' ? 'MOVE' : 'ATTACK'}]
                </span>
              )}
            </div>
          ) : state.currentPhase === 'cannon_fire' ? (
            <div style={{
              fontSize: theme.fontSizes.xs,
              fontFamily: theme.fonts.body,
              color: theme.colors.textDim,
              marginTop: 2,
            }}>
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
            <div style={{
              fontSize: theme.fontSizes.xs,
              fontFamily: theme.fonts.body,
              color: theme.colors.textDim,
              marginTop: 2,
            }}>
              {state.activatedUnitIds.length} activated
            </div>
          )}
        </Panel>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'auto',
      }}>
        <MedievalButton
          variant={showCoords ? 'secondary' : 'ghost'}
          size="sm"
          onClick={toggleCoords}
        >
          {showCoords ? 'Hide Coords' : 'Show Coords'}
        </MedievalButton>
        {state.currentPhase === 'draw_card' && (
          <MedievalButton variant="faction" size="sm" onClick={() => dispatch({ type: 'DRAW_CARD' })}>
            Draw Card
          </MedievalButton>
        )}
        {state.currentPhase === 'activation' && (
          <>
            {state.selectedUnitId && (
              <MedievalButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'END_ACTIVATION' })}>
                End Unit
              </MedievalButton>
            )}
            <MedievalButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'PASS' })}>
              Pass
            </MedievalButton>
          </>
        )}
        {state.currentPhase === 'ogre_rampage' && (
          <>
            {state.currentOgreSubCard === null && state.ogreSubCardIndex < state.ogreSubCardsTotal && (
              <MedievalButton variant="faction" size="sm" onClick={() => dispatch({ type: 'DRAW_OGRE_CARD' })}>
                Draw Ogre Card ({state.ogreSubCardIndex + 1}/{state.ogreSubCardsTotal})
              </MedievalButton>
            )}
            {state.currentOgreSubCard !== null && (
              <MedievalButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'END_OGRE_ACTIVATION' })}>
                Skip
              </MedievalButton>
            )}
            <MedievalButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'PASS' })}>
              End Rampage
            </MedievalButton>
          </>
        )}
        {state.currentPhase === 'cannon_fire' && (
          <>
            {cannonFiringStep === 'idle' && (
              <>
                <MedievalButton variant="danger" size="sm" onClick={() => setCannonFiringStep('targeting')}>
                  Fire Cannon
                </MedievalButton>
                <MedievalButton variant="ghost" size="sm" onClick={() => dispatch({ type: 'PASS' })}>
                  Pass
                </MedievalButton>
              </>
            )}
            {cannonFiringStep === 'targeting' && (
              <MedievalButton variant="ghost" size="sm" onClick={() => setCannonFiringStep('idle')}>
                Cancel
              </MedievalButton>
            )}
            {cannonFiringStep === 'path_select' && (
              <>
                {previewCannonPath && (
                  <MedievalButton variant="danger" size="sm" onClick={() => {
                    dispatch({ type: 'SELECT_CANNON_PATH', path: previewCannonPath });
                    setCannonFiringStep('drawing');
                    setShowCannonOverlay(true);
                    setPreviewCannonPath(null);
                  }}>
                    Confirm Path
                  </MedievalButton>
                )}
                <MedievalButton variant="ghost" size="sm" onClick={() => {
                  setPreviewCannonPath(null);
                  setCannonFiringStep('idle');
                  dispatch({ type: 'END_CANNON_FIRE' });
                }}>
                  Cancel
                </MedievalButton>
              </>
            )}
            {(cannonFiringStep === 'resolved' || (state.cannonFireState && state.cannonFireState.resolved)) && (
              <MedievalButton variant="ghost" size="sm" onClick={() => {
                setCannonFiringStep('idle');
                dispatch({ type: 'END_CANNON_FIRE' });
              }}>
                End
              </MedievalButton>
            )}
          </>
        )}
      </div>
    </div>

    {/* Hidden deployment handoff overlay */}
    {deploymentHandoffFaction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}>
          <Panel variant="parchment" ornate style={{
            padding: '40px 56px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: theme.fontSizes.lg,
              fontFamily: theme.fonts.body,
              color: theme.colors.textMuted,
              marginBottom: 16,
              fontStyle: 'italic',
            }}>
              Pass the screen to...
            </div>
            <div style={{
              fontSize: theme.fontSizes['3xl'],
              fontFamily: theme.fonts.display,
              color: getFactionTheme(deploymentHandoffFaction).primary,
              marginBottom: 12,
            }}>
              {getFactionLabel(deploymentHandoffFaction)}
            </div>
            <div style={{
              fontSize: theme.fontSizes.md,
              fontFamily: theme.fonts.body,
              color: theme.colors.textMuted,
              marginBottom: 32,
              textAlign: 'center',
              maxWidth: 360,
              lineHeight: 1.6,
            }}>
              Place your units facedown in your deployment zone.
              <br />Your opponent's placements are hidden.
            </div>
            <MedievalButton
              variant="primary"
              onClick={() => {
                setDeploymentHandoffFaction(null);
                useUIStore.getState().setHiddenDeploymentViewingFaction(null);
              }}
            >
              Ready
            </MedievalButton>
          </Panel>
        </div>
      )}
  </>);
}
