import { useEffect, useRef } from 'react';
import { SceneManager } from '../engine/SceneManager';
import { HexBoard } from '../engine/HexBoard';
import { UnitRenderer } from '../engine/UnitRenderer';
import { CameraController } from '../engine/CameraController';
import { InputHandler } from '../engine/InputHandler';
import { Highlights } from '../engine/Highlights';
import { Effects } from '../engine/Effects';
import { AssetLoader } from '../engine/AssetLoader';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { getValidMoveTargets, getValidAttackTargets, hexDistance, getShortestPaths, coordToKey, edgeKey, getNeighbors, hexToWorld } from '@battle-masters/game-logic';

export function useGameEngine(containerRef: React.RefObject<HTMLDivElement | null>) {
  const engineRef = useRef<{
    scene: SceneManager;
    hexBoard: HexBoard;
    unitRenderer: UnitRenderer;
    camera: CameraController;
    input: InputHandler;
    highlights: Highlights;
    effects: Effects;
    assetLoader: AssetLoader;
    animFrame: number;
    onKeyDown: (e: KeyboardEvent) => void;
  } | null>(null);

  const dispatch = useGameStore((s) => s.dispatch);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const init = async () => {
      // Load assets first
      const assetLoader = new AssetLoader();
      await assetLoader.loadManifest('/assets/manifest.json');
      await assetLoader.loadAll();

      if (cancelled) {
        assetLoader.dispose();
        return;
      }

      // Initialize engine
      const scene = new SceneManager(container);
      const hexBoard = new HexBoard(scene.scene, assetLoader);
      const unitRenderer = new UnitRenderer(scene.scene, assetLoader);
      const camera = new CameraController(scene.camera, scene.renderer.domElement);
      const highlights = new Highlights(scene.scene);
      const effects = new Effects(scene.scene);
      const input = new InputHandler(
        scene.camera,
        scene.renderer.domElement,
        () => hexBoard.getHexMeshes(),
        () => unitRenderer.getUnitMeshes()
      );

      // Build initial board
      const state = useGameStore.getState().state;
      if (state) {
        hexBoard.buildFromState(state.board);
      }

      // Place units and highlights on top of 3D tiles
      unitRenderer.setBaseHeight(hexBoard.tileTopY);
      highlights.setHeight(hexBoard.tileTopY);

      // Input handling
      input.onInput((event) => {
        const state = useGameStore.getState().state;
        if (!state) return;

        switch (event.type) {
          case 'unit_click': {
            if (!event.unitId) break;
            const unit = state.units.get(event.unitId);
            if (!unit) break;

            useUIStore.getState().setInspectedUnit(event.unitId);

            if (state.currentPhase === 'activation' && state.currentCard) {
              // If clicking own unit that matches card → select it
              if (
                unit.faction === state.currentCard.faction &&
                state.currentCard.unitTypes.includes(unit.definitionType) &&
                !unit.hasActivated
              ) {
                dispatch({ type: 'SELECT_UNIT', unitId: event.unitId });
              }
              // If clicking enemy unit while a unit is selected → show combat dialog
              else if (
                state.selectedUnitId &&
                unit.faction !== state.currentCard.faction
              ) {
                const targets = getValidAttackTargets(state, state.selectedUnitId);
                if (targets.includes(event.unitId)) {
                  useUIStore.getState().setPendingAttack(state.selectedUnitId, event.unitId);
                }
              }
            }

            // Ogre rampage: clicking enemy while ogre_attack sub-card is active
            if (
              state.currentPhase === 'ogre_rampage' &&
              state.currentOgreSubCard?.type === 'ogre_attack' &&
              state.selectedUnitId &&
              unit.faction !== state.activeFaction
            ) {
              const targets = getValidAttackTargets(state, state.selectedUnitId);
              if (targets.includes(event.unitId)) {
                useUIStore.getState().setPendingAttack(state.selectedUnitId, event.unitId);
              }
            }

            // Cannon fire: clicking enemy unit while in targeting mode
            if (
              state.currentPhase === 'cannon_fire' &&
              useUIStore.getState().cannonFiringStep === 'targeting' &&
              state.selectedUnitId &&
              unit.faction !== state.activeFaction
            ) {
              const cannon = state.units.get(state.selectedUnitId);
              if (cannon) {
                const dist = hexDistance(cannon.position, unit.position);
                if (dist >= 1 && dist <= 8) {
                  // Spawn fire effect at cannon position
                  effects.spawnCannonFireEffect(cannon.position);
                  dispatch({ type: 'FIRE_CANNON', targetCoord: unit.position });
                  // Check if path selection is needed
                  const nextState = useGameStore.getState().state;
                  if (nextState?.cannonFireState && nextState.cannonFireState.path.length === 0 && !nextState.cannonFireState.adjacentShot) {
                    useUIStore.getState().setCannonFiringStep('path_select');
                  } else {
                    useUIStore.getState().setCannonFiringStep(nextState?.cannonFireState?.resolved ? 'resolved' : 'drawing');
                    useUIStore.getState().setShowCannonOverlay(true);
                  }
                }
              }
            }
            break;
          }

          case 'hex_click': {
            useUIStore.getState().setInspectedUnit(null);

            // Terrain placement phase
            if (state.currentPhase === 'terrain_placement' && event.hexCoord) {
              const uiState = useUIStore.getState();
              const piece = uiState.selectedTerrainPiece;
              if (piece && piece !== 'hedge') {
                dispatch({
                  type: 'PLACE_TERRAIN',
                  terrainType: piece,
                  position: event.hexCoord,
                  orientation: piece === 'ditch' ? uiState.ditchPreviewOrientation : undefined,
                  fortifiedSides: piece === 'ditch' ? uiState.ditchPreviewFortifiedSides : undefined,
                });
                if (piece === 'ditch') {
                  useUIStore.getState().setLastPlacedDitchCoord(event.hexCoord);
                } else {
                  useUIStore.getState().setLastPlacedDitchCoord(null);
                }
              } else if (piece === 'hedge' && event.worldPoint) {
                // Determine closest edge
                const hexCenter = hexToWorld(event.hexCoord);
                const dx = event.worldPoint.x - hexCenter.x;
                const dz = event.worldPoint.z - hexCenter.z;
                const angle = Math.atan2(-dz, dx);
                // Map to direction 0-5 (0=E, each 60° counterclockwise)
                const dir = ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
                const neighbors = getNeighbors(event.hexCoord);
                const neighbor = neighbors[dir];
                dispatch({ type: 'PLACE_HEDGE', from: event.hexCoord, to: neighbor });
              }
              break;
            }

            // Deployment phase: place unit on hex click
            if (state.currentPhase === 'deployment' && event.hexCoord) {
              const selectedType = useUIStore.getState().selectedDeploymentUnitType;
              if (selectedType) {
                dispatch({ type: 'PLACE_UNIT', unitType: selectedType, position: event.hexCoord });
                // Check if more of the same type remain; if not, clear selection
                const nextState = useGameStore.getState().state;
                if (nextState?.unplacedUnits && !nextState.unplacedUnits.some(u => u.type === selectedType)) {
                  useUIStore.getState().setSelectedDeploymentUnitType(null);
                }
              }
              break;
            }

            if (!event.hexCoord || !state.selectedUnitId) break;
            if (state.currentPhase === 'activation') {
              dispatch({
                type: 'MOVE_UNIT',
                unitId: state.selectedUnitId,
                to: event.hexCoord,
              });
            }
            // Ogre rampage: move on ogre_move sub-card
            if (
              state.currentPhase === 'ogre_rampage' &&
              state.currentOgreSubCard?.type === 'ogre_move'
            ) {
              dispatch({
                type: 'MOVE_UNIT',
                unitId: state.selectedUnitId,
                to: event.hexCoord,
              });
            }
            // Cannon fire: move cannon or select path
            if (state.currentPhase === 'cannon_fire') {
              const uiState = useUIStore.getState();
              if (uiState.cannonFiringStep === 'idle') {
                // Moving the cannon
                dispatch({
                  type: 'MOVE_UNIT',
                  unitId: state.selectedUnitId,
                  to: event.hexCoord,
                });
              } else if (uiState.cannonFiringStep === 'path_select' && state.cannonFireState) {
                // Preview a path that passes through this hex
                const cannon = state.units.get(state.selectedUnitId);
                if (cannon) {
                  const allPaths = getShortestPaths(cannon.position, state.cannonFireState.targetCoord);
                  const clickedKey = coordToKey(event.hexCoord);
                  const matchingPath = allPaths.find(p => p.some(h => coordToKey(h) === clickedKey));
                  if (matchingPath) {
                    useUIStore.getState().setPreviewCannonPath(matchingPath);
                  }
                }
              }
            }
            break;
          }

          case 'hex_right_click': {
            // Right-click to remove terrain/hedge during terrain placement
            if (state.currentPhase === 'terrain_placement' && event.hexCoord) {
              const tile = state.board.tiles.get(coordToKey(event.hexCoord));
              if (tile && (tile.terrain === 'tower' || tile.terrain === 'marsh' || tile.terrain === 'ditch')) {
                dispatch({ type: 'REMOVE_TERRAIN', position: event.hexCoord });
                // Clear last ditch tracking if we removed it
                const lastDitch = useUIStore.getState().lastPlacedDitchCoord;
                if (lastDitch && lastDitch.col === event.hexCoord.col && lastDitch.row === event.hexCoord.row) {
                  useUIStore.getState().setLastPlacedDitchCoord(null);
                }
              } else if (event.worldPoint) {
                // Try to remove a nearby hedge
                const hexCenter = hexToWorld(event.hexCoord);
                const dx = event.worldPoint.x - hexCenter.x;
                const dz = event.worldPoint.z - hexCenter.z;
                const angle = Math.atan2(-dz, dx);
                const dir = ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
                const neighbors = getNeighbors(event.hexCoord);
                const neighbor = neighbors[dir];
                const key = edgeKey(event.hexCoord, neighbor);
                if (state.board.hedges.has(key)) {
                  dispatch({ type: 'REMOVE_HEDGE', from: event.hexCoord, to: neighbor });
                }
              }
            }
            break;
          }

          case 'empty_click': {
            useUIStore.getState().setInspectedUnit(null);
            break;
          }
        }
      });

      // Keyboard handler for ditch rotation and variant cycling
      const onKeyDown = (e: KeyboardEvent) => {
        const state = useGameStore.getState().state;
        if (state?.currentPhase !== 'terrain_placement') return;
        const uiState = useUIStore.getState();

        if (e.key === 'r' || e.key === 'R') {
          const newOrientation = (uiState.ditchPreviewOrientation + 1) % 6;
          uiState.setDitchPreviewOrientation(newOrientation);

          // Also rotate the last placed ditch if it still exists
          const lastDitch = uiState.lastPlacedDitchCoord;
          if (lastDitch) {
            const tile = state.board.tiles.get(coordToKey(lastDitch));
            if (tile?.terrain === 'ditch') {
              dispatch({ type: 'REMOVE_TERRAIN', position: lastDitch });
              dispatch({ type: 'PLACE_TERRAIN', terrainType: 'ditch', position: lastDitch, orientation: newOrientation, fortifiedSides: uiState.ditchPreviewFortifiedSides });
            }
          }
        }

        if (e.key === 'v' || e.key === 'V') {
          uiState.cycleDitchFortifiedSides();
          const newFortifiedSides = useUIStore.getState().ditchPreviewFortifiedSides;

          // Also update the last placed ditch if it still exists
          const lastDitch = uiState.lastPlacedDitchCoord;
          if (lastDitch) {
            const tile = state.board.tiles.get(coordToKey(lastDitch));
            if (tile?.terrain === 'ditch') {
              dispatch({ type: 'REMOVE_TERRAIN', position: lastDitch });
              dispatch({ type: 'PLACE_TERRAIN', terrainType: 'ditch', position: lastDitch, orientation: uiState.ditchPreviewOrientation, fortifiedSides: newFortifiedSides });
            }
          }
        }
      };
      window.addEventListener('keydown', onKeyDown);

      // Animation loop
      let lastTime = performance.now();
      let lastBoardRef: import('@battle-masters/game-logic').BoardState | null = null;
      const animate = () => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        const state = useGameStore.getState().state;
        const uiState = useUIStore.getState();
        hexBoard.setShowCoords(uiState.showCoords);
        if (state) {
          // Update board when board reference changes
          if (state.board !== lastBoardRef) {
            if (lastBoardRef === null) {
              // First time — full build
              hexBoard.buildFromState(state.board);
            } else {
              // Incremental update — only changed tiles/hedges
              hexBoard.updateFromState(state.board);
            }
            lastBoardRef = state.board;
          }
          // Preserve destroyed unit meshes while dice roll is showing
          let preserveIds: Set<string> | undefined;
          if (uiState.showDiceRoll && uiState.combatEffectInfo?.destroyedUnitId) {
            preserveIds = new Set([uiState.combatEffectInfo.destroyedUnitId]);
          }
          const deferDamageForId = uiState.showDiceRoll
            ? uiState.combatEffectInfo?.damagedUnitId ?? null
            : null;
          // Invert facing when sides are swapped (chaos in north / imperial in south)
          const invertFacing = state.scenarioId === 'battle_of_the_river_tengin'
            || (state.standardGame === true && state.deploymentSides?.chaos?.includes(0));
          unitRenderer.syncUnits(state.units, state.selectedUnitId, preserveIds, deferDamageForId, state.board, invertFacing);
          unitRenderer.updateBillboards(scene.camera);

          // Update highlights
          highlights.clear();
          if (state.currentPhase === 'activation' && state.currentCard) {
            // Always highlight tiles of units that can still act
            const activatableHexes: import('@battle-masters/game-logic').HexCoord[] = [];
            for (const [id, unit] of state.units) {
              if (unit.faction !== state.currentCard.faction) continue;
              if (!state.currentCard.unitTypes.includes(unit.definitionType)) continue;
              if (unit.hasActivated) continue;
              if (state.activatedUnitIds.includes(id)) continue;
              // Skip units that have no actions left
              if (unit.hasMoved || unit.hasAttacked) continue;
              activatableHexes.push(unit.position);
            }
            highlights.showActivatableHighlights(activatableHexes);

            if (state.selectedUnitId) {
              // Highlight the selected unit's tile only if it can still act
              const selectedUnit = state.units.get(state.selectedUnitId);
              if (selectedUnit && !selectedUnit.hasMoved && !selectedUnit.hasAttacked) {
                highlights.showSelectedHighlight(selectedUnit.position);
              }
              // Show move/attack targets
              const moves = getValidMoveTargets(state, state.selectedUnitId);
              highlights.showMoveHighlights(moves);

              const attackIds = getValidAttackTargets(state, state.selectedUnitId);
              const attackHexes = attackIds
                .map((id) => state.units.get(id)?.position)
                .filter((p): p is import('@battle-masters/game-logic').HexCoord => !!p);
              highlights.showAttackHighlights(attackHexes);
            }
          }

          // Cannon fire highlights
          if (state.currentPhase === 'cannon_fire' && state.selectedUnitId) {
            const cannon = state.units.get(state.selectedUnitId);
            if (cannon) {
              highlights.showSelectedHighlight(cannon.position);

              const firingStep = uiState.cannonFiringStep;
              if (firingStep === 'idle') {
                // Show move targets
                const moves = getValidMoveTargets(state, state.selectedUnitId);
                highlights.showMoveHighlights(moves);
              } else if (firingStep === 'targeting') {
                // Show all enemy units in range
                const rangeHexes: import('@battle-masters/game-logic').HexCoord[] = [];
                for (const [, unit] of state.units) {
                  if (unit.faction === cannon.faction) continue;
                  const dist = hexDistance(cannon.position, unit.position);
                  if (dist >= 1 && dist <= 8) {
                    rangeHexes.push(unit.position);
                  }
                }
                highlights.showCannonRangeHighlights(rangeHexes);
              } else if (firingStep === 'path_select' && state.cannonFireState) {
                // Show all possible path hexes
                const allPaths = getShortestPaths(cannon.position, state.cannonFireState.targetCoord);
                const previewPath = uiState.previewCannonPath;
                const previewKeys = previewPath ? new Set(previewPath.map(h => coordToKey(h))) : null;

                // Show non-preview paths dimly
                const dimHexSet = new Set<string>();
                const dimHexes: import('@battle-masters/game-logic').HexCoord[] = [];
                for (const path of allPaths) {
                  for (const hex of path) {
                    const key = coordToKey(hex);
                    if (!dimHexSet.has(key) && (!previewKeys || !previewKeys.has(key))) {
                      dimHexSet.add(key);
                      dimHexes.push(hex);
                    }
                  }
                }
                highlights.showCannonPathHighlights(dimHexes);

                // Show preview path brightly
                if (previewPath) {
                  highlights.showCannonPathPreviewHighlights(previewPath);
                }

                highlights.showAttackHighlights([state.cannonFireState.targetCoord]);
              } else if ((firingStep === 'drawing' || firingStep === 'resolved') && state.cannonFireState) {
                // Show the selected path (unvisited hexes only)
                const visitedKeys = new Set(state.cannonFireState.placedTiles.map(pt => coordToKey(pt.coord)));
                const unvisitedPath = state.cannonFireState.path.filter(h => !visitedKeys.has(coordToKey(h)));
                highlights.showCannonPathHighlights(unvisitedPath);
                highlights.showAttackHighlights([state.cannonFireState.targetCoord]);

                // Show placed tile markers with type-specific colors
                for (const pt of state.cannonFireState.placedTiles) {
                  highlights.showCannonTileHighlight(pt.coord, pt.tile.type);
                }
              }
            }
          }

          // Deployment phase highlights
          if (state.currentPhase === 'deployment' && state.deploymentZone) {
            const deployHexes: import('@battle-masters/game-logic').HexCoord[] = [];
            const occupied = new Set<string>();
            for (const [, unit] of state.units) {
              occupied.add(coordToKey(unit.position));
            }
            for (const [key, tile] of state.board.tiles) {
              if (state.deploymentZone.rows.includes(tile.coord.row) &&
                  tile.terrain !== 'river' && tile.terrain !== 'marsh' &&
                  !occupied.has(key)) {
                deployHexes.push(tile.coord);
              }
            }
            highlights.showDeploymentZoneHighlights(deployHexes);
          }

          // Terrain placement highlights — show valid plain hexes
          if (state.currentPhase === 'terrain_placement') {
            const validHexes: import('@battle-masters/game-logic').HexCoord[] = [];
            for (const [, tile] of state.board.tiles) {
              if (tile.terrain === 'plain') {
                validHexes.push(tile.coord);
              }
            }
            highlights.showValidPlacementHighlights(validHexes);
          }

          // Side selection highlights — show top and bottom rows
          if (state.currentPhase === 'side_selection') {
            const topHexes: import('@battle-masters/game-logic').HexCoord[] = [];
            const bottomHexes: import('@battle-masters/game-logic').HexCoord[] = [];
            for (const [, tile] of state.board.tiles) {
              if (tile.coord.row <= 1) topHexes.push(tile.coord);
              if (tile.coord.row >= 10) bottomHexes.push(tile.coord);
            }
            highlights.showSideSelectionHighlights(topHexes, bottomHexes);
          }

          // Ogre rampage highlights
          if (state.currentPhase === 'ogre_rampage' && state.selectedUnitId) {
            const ogre = state.units.get(state.selectedUnitId);
            if (ogre) {
              highlights.showSelectedHighlight(ogre.position);

              if (state.currentOgreSubCard?.type === 'ogre_move' && !ogre.hasMoved) {
                const moves = getValidMoveTargets(state, state.selectedUnitId);
                highlights.showMoveHighlights(moves);
              }
              if (state.currentOgreSubCard?.type === 'ogre_attack' && !ogre.hasAttacked) {
                const attackIds = getValidAttackTargets(state, state.selectedUnitId);
                const attackHexes = attackIds
                  .map((id) => state.units.get(id)?.position)
                  .filter((p): p is import('@battle-masters/game-logic').HexCoord => !!p);
                highlights.showAttackHighlights(attackHexes);
              }
            }
          }

          unitRenderer.update(dt);
          highlights.update(dt);
          effects.update(dt);
        }

        scene.render();
        engineRef.current!.animFrame = requestAnimationFrame(animate);
      };

      engineRef.current = {
        scene,
        hexBoard,
        unitRenderer,
        camera,
        input,
        highlights,
        effects,
        assetLoader,
        animFrame: requestAnimationFrame(animate),
        onKeyDown,
      };
    };

    init();

    return () => {
      cancelled = true;
      if (engineRef.current) {
        cancelAnimationFrame(engineRef.current.animFrame);
        engineRef.current.input.dispose();
        engineRef.current.highlights.dispose();
        engineRef.current.effects.dispose();
        engineRef.current.unitRenderer.dispose();
        engineRef.current.hexBoard.dispose();
        engineRef.current.camera.dispose();
        engineRef.current.scene.dispose();
        engineRef.current.assetLoader.dispose();
        window.removeEventListener('keydown', engineRef.current.onKeyDown);
        engineRef.current = null;
      }
    };
  }, [containerRef, dispatch]);

  return engineRef;
}
