import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { DiceScene } from '../engine/DiceScene';
import { theme } from './theme';
import { Panel } from './components/Panel';
import type { DieResult } from '@battle-masters/game-logic';

// Animation phases
type AnimPhase =
  | 'attacker_rolling'
  | 'attacker_settled'
  | 'pause'
  | 'defender_rolling'
  | 'defender_settled'
  | 'result';

const PAUSE_DURATION = 500;
const RESULT_DELAY = 400;

const DIE_COLORS: Record<DieResult, string> = {
  skull: theme.colors.danger,
  shield: theme.colors.info,
  blank: '#888888',
};

const DIE_IMAGES: Record<DieResult, string> = {
  skull: '/assets/dice/skull.png',
  shield: '/assets/dice/shield.png',
  blank: '/assets/dice/blank.png',
};

export function DiceRoll({ onDismiss }: { onDismiss?: () => void }) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const showDiceRoll = useUIStore((s) => s.showDiceRoll);
  const lastCombatResultIndex = useUIStore((s) => s.lastCombatResultIndex);
  const pendingDiceRoll = useUIStore((s) => s.pendingDiceRoll);
  const showDice = useUIStore((s) => s.showDice);
  const hideDice = useUIStore((s) => s.hideDice);

  const [phase, setPhase] = useState<AnimPhase>('attacker_rolling');
  const [shaking, setShaking] = useState(false);
  const [entryDone, setEntryDone] = useState(false);
  const [attackerResults, setAttackerResults] = useState<DieResult[]>([]);
  const [defenderResults, setDefenderResults] = useState<DieResult[]>([]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const diceSceneRef = useRef<DiceScene | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Reset entry animation state when dialog opens
  useEffect(() => {
    if (showDiceRoll) {
      setEntryDone(false);
    }
  }, [showDiceRoll, pendingDiceRoll]);

  // Create/destroy DiceScene when dialog appears/disappears
  useEffect(() => {
    if (!showDiceRoll || !pendingDiceRoll) return;

    const container = canvasContainerRef.current;
    if (!container) return;

    const scene = new DiceScene(container);
    diceSceneRef.current = scene;

    return () => {
      scene.dispose();
      diceSceneRef.current = null;
    };
  }, [showDiceRoll, pendingDiceRoll]);

  // Main animation sequence — physics-driven two-phase flow
  useEffect(() => {
    if (!showDiceRoll || !pendingDiceRoll) return;

    clearTimers();
    setPhase('attacker_rolling');
    setShaking(false);
    setAttackerResults([]);
    setDefenderResults([]);

    addTimeout(() => {
      const scene = diceSceneRef.current;
      if (!scene) return;

      // Phase 1: Roll attacker dice freely
      scene.rollDice(pendingDiceRoll.attackDice, (atkResults) => {
        setAttackerResults(atkResults);
        setPhase('attacker_settled');

        addTimeout(() => {
          setPhase('pause');

          addTimeout(() => {
            setPhase('defender_rolling');
            scene.clearDice();

            // Phase 2: Roll defender dice freely
            scene.rollDice(pendingDiceRoll.defenseDice, (defResults) => {
              setDefenderResults(defResults);
              setPhase('defender_settled');

              // Phase 3: Dispatch ATTACK with physics results
              addTimeout(() => {
                dispatch({
                  type: 'ATTACK',
                  attackerId: pendingDiceRoll.attackerId,
                  defenderId: pendingDiceRoll.defenderId,
                  attackerRolls: atkResults,
                  defenderRolls: defResults,
                });

                // Read the result from combatLog
                const nextState = useGameStore.getState().state;
                if (nextState) {
                  const lastEvent = nextState.combatLog[nextState.combatLog.length - 1];
                  const unitDestroyed = !nextState.units.has(pendingDiceRoll.defenderId);
                  showDice(nextState.combatLog.length - 1, {
                    defenderPosition: pendingDiceRoll.defenderPosition,
                    damage: (lastEvent?.type === 'melee' ? lastEvent.result.damage : 0),
                    unitDestroyed,
                    destroyedUnitId: unitDestroyed ? pendingDiceRoll.defenderId : null,
                    damagedUnitId: pendingDiceRoll.defenderId,
                    isCharge: pendingDiceRoll.isCharge,
                  });
                }

                setPhase('result');
                // Check damage for shake
                const finalState = useGameStore.getState().state;
                if (finalState) {
                  const evt = finalState.combatLog[finalState.combatLog.length - 1];
                  if (evt?.type === 'melee' && evt.result.damage > 0) {
                    setShaking(true);
                    addTimeout(() => setShaking(false), 500);
                  }
                }
              }, RESULT_DELAY);
            });
          }, PAUSE_DURATION);
        }, 200);
      });
    }, 150);

    return clearTimers;
  }, [showDiceRoll, pendingDiceRoll]);

  if (!showDiceRoll) return null;

  // Get combat result from log (available after dispatch in result phase)
  const event = (lastCombatResultIndex !== null && state)
    ? state.combatLog[lastCombatResultIndex]
    : null;

  const isAnimating = phase !== 'result';

  const handleDismiss = () => {
    if (isAnimating) return;
    onDismiss?.();
    hideDice();
  };

  // Phase label text
  const phaseLabel =
    phase === 'attacker_rolling' || phase === 'attacker_settled' ? 'Attack!' :
    phase === 'pause' ? '...' :
    phase === 'defender_rolling' || phase === 'defender_settled' ? 'Defense!' :
    'Result';

  // Show attacker results as 2D icons once settled
  const showAttackerSummary = attackerResults.length > 0 &&
    (phase === 'attacker_settled' || phase === 'pause' || phase === 'defender_rolling' || phase === 'defender_settled' || phase === 'result');

  // Show defender results as 2D icons once settled
  const showDefenderSummary = defenderResults.length > 0 &&
    (phase === 'defender_settled' || phase === 'result');

  // Animation: entry plays once, shake plays on damage, then nothing
  const panelAnimation = !entryDone
    ? 'dicePanelEntry 0.25s ease-out forwards'
    : shaking
      ? 'diceResultShake 0.5s ease-out'
      : 'none';

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 101,
    }}>
      <Panel
        variant="dark"
        style={{
          padding: '20px 32px 16px',
          textAlign: 'center',
          pointerEvents: 'auto',
          cursor: isAnimating ? 'default' : 'pointer',
          minWidth: 320,
          animation: panelAnimation,
          borderRadius: 16,
        }}
        onClick={handleDismiss}
      >
        <div
          onAnimationEnd={(e) => {
            if (e.animationName === 'dicePanelEntry') {
              setEntryDone(true);
            }
          }}
        >

        {/* Phase label */}
        <div style={{
          fontSize: theme.fontSizes.sm,
          fontFamily: theme.fonts.display,
          color: theme.colors.textDim,
          marginBottom: 8,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          minHeight: '1em',
        }}>
          {phaseLabel}
        </div>

        {/* Attacker results summary — space always reserved to prevent layout shift */}
        <div style={{ visibility: showAttackerSummary ? 'visible' : 'hidden' }}>
          <DiceSummary label="Attack" dice={attackerResults.length > 0 ? attackerResults : ['blank']} labelColor={theme.colors.warning} highlight="skull" />
        </div>

        {/* 3D Dice Canvas */}
        <div
          ref={canvasContainerRef}
          style={{
            width: 320,
            height: 200,
            margin: '0 auto',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />

        {/* Defender results summary — space always reserved to prevent layout shift */}
        <div style={{ visibility: showDefenderSummary ? 'visible' : 'hidden' }}>
          <DiceSummary label="Defense" dice={defenderResults.length > 0 ? defenderResults : ['blank']} labelColor={theme.colors.info} highlight="shield" />
        </div>

        {/* Result — space always reserved to prevent layout shift */}
        <div style={{
          minHeight: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 8,
          visibility: (phase === 'result' && event?.type === 'melee') ? 'visible' : 'hidden',
        }}>
          {event?.type === 'melee' && (
            <div style={{ animation: phase === 'result' ? 'resultSlam 0.4s ease-out' : 'none' }}>
              <div style={{
                fontSize: '1.3rem',
                fontFamily: theme.fonts.display,
                color: event.result.damage > 0 ? theme.colors.danger : theme.colors.success,
                textShadow: event.result.damage > 0
                  ? theme.shadows.textGlow('rgba(255,68,68,0.5)')
                  : theme.shadows.textGlow('rgba(68,204,68,0.5)'),
              }}>
                {event.result.damage > 0
                  ? `${event.result.damage} Damage${event.result.unitDestroyed ? ' \u2014 Destroyed!' : ''}`
                  : 'Blocked!'
                }
              </div>
              {event.result.damage > 0 && (
                <div style={{
                  fontSize: theme.fontSizes.xs,
                  fontFamily: theme.fonts.body,
                  color: '#ff8866',
                  marginTop: 2,
                }}>
                  {event.result.attackerRolls.filter(r => r === 'skull').length} hits
                  {' \u2014 '}
                  {event.result.defenderRolls.filter(r => r === 'shield').length} blocked
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dismiss hint — space always reserved */}
        <div style={{
          fontSize: '0.6rem',
          fontFamily: theme.fonts.body,
          color: theme.colors.textFaint,
          marginTop: 8,
          visibility: phase === 'result' ? 'visible' : 'hidden',
          animation: phase === 'result' ? 'labelFadeIn 0.4s ease-out 0.3s both' : 'none',
        }}>
          Click to dismiss
        </div>
        </div>
      </Panel>
    </div>
  );
}

/** Compact 2D summary of dice results shown above/below the 3D canvas */
function DiceSummary({ label, dice, labelColor, highlight }: {
  label: string;
  dice: DieResult[];
  labelColor: string;
  highlight?: DieResult;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 6,
      animation: 'labelFadeIn 0.2s ease-out',
    }}>
      <span style={{
        fontSize: '0.6rem',
        fontFamily: theme.fonts.display,
        color: labelColor,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        opacity: 0.7,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {dice.map((result, i) => {
          const isHighlighted = highlight && result === highlight;
          return (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: `1px solid ${isHighlighted ? DIE_COLORS[result] : DIE_COLORS[result] + '33'}`,
              background: isHighlighted ? DIE_COLORS[result] + '25' : 'rgba(255,255,255,0.02)',
              boxShadow: isHighlighted ? `0 0 8px ${DIE_COLORS[result]}44` : 'none',
              opacity: isHighlighted ? 1 : 0.5,
            }}>
              <img src={DIE_IMAGES[result]} alt={result} style={{ width: 22, height: 22 }} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
