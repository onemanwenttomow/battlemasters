import { useCallback, useEffect, useRef } from 'react';
import { useUIStore } from './store/uiStore';
import { useGameStore } from './store/gameStore';
import { useCampaignStore } from './store/campaignStore';
import { useGameEngine } from './hooks/useGameEngine';
import { MainMenu } from './ui/MainMenu';
import { ScenarioSelect } from './ui/ScenarioSelect';
import { StandardGameSetup } from './ui/StandardGameSetup';
import { CampaignOverview } from './ui/CampaignOverview';
import { CampaignComplete } from './ui/CampaignComplete';
import { GameHUD } from './ui/GameHUD';
import { UnitPanel } from './ui/UnitPanel';
import { CombatLog } from './ui/CombatLog';
import { DiceRoll } from './ui/DiceRoll';
import { CombatDialog } from './ui/CombatDialog';
import { CannonFireOverlay } from './ui/CannonFireOverlay';
import { VictoryScreen } from './ui/VictoryScreen';
import { ScreenTransition } from './ui/components/ScreenTransition';

function GameScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useGameEngine(containerRef);
  const state = useGameStore((s) => s.state);

  // Determine faction class for CSS custom properties
  const factionClass = state
    ? `faction-${state.activeFaction}`
    : '';

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
    <div
      className={factionClass}
      style={{ position: 'relative', width: '100%', height: '100vh' }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <GameHUD />
      <UnitPanel />
      <CombatLog />
      <CombatDialog />
      <DiceRoll onDismiss={handleDiceRollDismiss} />
      <CannonFireOverlay effects={engineRef.current?.effects ?? null} />
      {state?.currentPhase === 'game_over' && <VictoryScreen />}
    </div>
  );
}

export default function App() {
  const screen = useUIStore((s) => s.screen);
  const loadCampaign = useCampaignStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  const renderScreen = () => {
    if (screen === 'menu') return <MainMenu />;
    if (screen === 'scenario_select') return <ScenarioSelect />;
    if (screen === 'standard_game_setup') return <StandardGameSetup />;
    if (screen === 'campaign_overview') return <CampaignOverview />;
    if (screen === 'campaign_complete') return <CampaignComplete />;
    return <GameScreen />;
  };

  return (
    <ScreenTransition screenKey={screen}>
      {renderScreen()}
    </ScreenTransition>
  );
}
