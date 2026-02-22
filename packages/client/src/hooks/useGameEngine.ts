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
import { getValidMoveTargets, getValidAttackTargets, getUnitDefinition } from '@battle-masters/game-logic';
import { hexToWorld } from '@battle-masters/game-logic';

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
      const unitRenderer = new UnitRenderer(scene.scene);
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

            if (state.currentPhase === 'activation' && state.currentCard) {
              // If clicking own unit that matches card → select it
              if (
                unit.faction === state.currentCard.faction &&
                state.currentCard.unitTypes.includes(unit.definitionType) &&
                !unit.hasActivated
              ) {
                dispatch({ type: 'SELECT_UNIT', unitId: event.unitId });
              }
              // If clicking enemy unit while a unit is selected → attack
              else if (
                state.selectedUnitId &&
                unit.faction !== state.currentCard.faction
              ) {
                const targets = getValidAttackTargets(state, state.selectedUnitId);
                if (targets.includes(event.unitId)) {
                  const prevLogLen = state.combatLog.length;
                  dispatch({
                    type: 'ATTACK',
                    attackerId: state.selectedUnitId,
                    defenderId: event.unitId,
                  });
                  // Show effects
                  effects.spawnHitEffect(unit.position);
                  const nextState = useGameStore.getState().state;
                  if (nextState && !nextState.units.has(event.unitId)) {
                    effects.spawnDeathEffect(unit.position);
                  }
                  if (nextState) {
                    useUIStore.getState().showDice(nextState.combatLog.length - 1);
                  }
                }
              }
            }
            break;
          }

          case 'hex_click': {
            if (!event.hexCoord || !state.selectedUnitId) break;
            if (state.currentPhase === 'activation') {
              dispatch({
                type: 'MOVE_UNIT',
                unitId: state.selectedUnitId,
                to: event.hexCoord,
              });
            }
            break;
          }

          case 'empty_click': {
            // Deselect
            break;
          }
        }
      });

      // Animation loop
      let lastTime = performance.now();
      const animate = () => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        const state = useGameStore.getState().state;
        hexBoard.setShowCoords(useUIStore.getState().showCoords);
        if (state) {
          unitRenderer.syncUnits(state.units, state.selectedUnitId);
          unitRenderer.updateBillboards(scene.camera);

          // Update highlights
          highlights.clear();
          if (state.currentPhase === 'activation' && state.currentCard) {
            if (state.selectedUnitId) {
              // Show move/attack targets for selected unit
              const moves = getValidMoveTargets(state, state.selectedUnitId);
              highlights.showMoveHighlights(moves);

              const attackIds = getValidAttackTargets(state, state.selectedUnitId);
              const attackHexes = attackIds
                .map((id) => state.units.get(id)?.position)
                .filter((p): p is import('@battle-masters/game-logic').HexCoord => !!p);
              highlights.showAttackHighlights(attackHexes);
            } else {
              // Highlight all units that can still be activated for this card
              const activatableHexes: import('@battle-masters/game-logic').HexCoord[] = [];
              for (const [id, unit] of state.units) {
                if (unit.faction !== state.currentCard.faction) continue;
                if (!state.currentCard.unitTypes.includes(unit.definitionType)) continue;
                if (unit.hasActivated) continue;
                if (state.activatedUnitIds.includes(id)) continue;
                activatableHexes.push(unit.position);
              }
              highlights.showActivatableHighlights(activatableHexes);
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
        engineRef.current = null;
      }
    };
  }, [containerRef, dispatch]);

  return engineRef;
}
