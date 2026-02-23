import { useCallback, useRef } from 'react';
import { useUIStore } from './store/uiStore';
import { useGameStore } from './store/gameStore';
import { useGameEngine } from './hooks/useGameEngine';
import { MainMenu } from './ui/MainMenu';
import { GameHUD } from './ui/GameHUD';
import { UnitPanel } from './ui/UnitPanel';
import { CombatLog } from './ui/CombatLog';
import { DiceRoll } from './ui/DiceRoll';
import { CombatDialog } from './ui/CombatDialog';
import { VictoryScreen } from './ui/VictoryScreen';

function GameScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useGameEngine(containerRef);
  const state = useGameStore((s) => s.state);

  const handleDiceRollDismiss = useCallback(() => {
    const effectInfo = useUIStore.getState().combatEffectInfo;
    const effects = engineRef.current?.effects;
    if (effectInfo && effects) {
      if (effectInfo.damage > 0) {
        effects.spawnHitEffect(effectInfo.defenderPosition);
      }
      if (effectInfo.unitDestroyed) {
        effects.spawnDeathEffect(effectInfo.defenderPosition);
      }
    }
  }, [engineRef]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <GameHUD />
      <UnitPanel />
      <CombatLog />
      <CombatDialog />
      <DiceRoll onDismiss={handleDiceRollDismiss} />
      {state?.currentPhase === 'game_over' && <VictoryScreen />}
    </div>
  );
}

export default function App() {
  const screen = useUIStore((s) => s.screen);

  if (screen === 'menu') {
    return <MainMenu />;
  }

  return <GameScreen />;
}
