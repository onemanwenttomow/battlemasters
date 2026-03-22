import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { TurnInfo, CurrentCard, ActionButtons, CoordsToggle, TerrainToolbar, SideSelection, DeploymentToolbar } from './GameHUD';
import { UnitPanel } from './UnitPanel';
import { CombatLog } from './CombatLog';
import { CombatDialog } from './CombatDialog';
import { DiceRoll } from './DiceRoll';
import { CannonFireOverlay } from './CannonFireOverlay';
import type { Effects } from '../engine/Effects';
import styles from './GameSidePanel.module.css';

interface GameSidePanelProps {
  onDiceRollDismiss?: () => void;
  effects: Effects | null;
}

export function GameSidePanel({ onDiceRollDismiss, effects }: GameSidePanelProps) {
  const state = useGameStore((s) => s.state);
  const pendingAttack = useUIStore((s) => s.pendingAttack);
  const showDiceRoll = useUIStore((s) => s.showDiceRoll);
  const showCannonOverlay = useUIStore((s) => s.showCannonOverlay);

  if (!state) return null;

  // Determine what to show in the contextual zone
  const hasContextualContent = pendingAttack || showDiceRoll || showCannonOverlay
    || state.currentPhase === 'terrain_placement'
    || state.currentPhase === 'side_selection'
    || state.currentPhase === 'deployment';

  return (
    <div className={styles.panel}>
      {/* Turn info */}
      <div className={styles.section}>
        <TurnInfo />
      </div>

      {/* Current card */}
      <div className={styles.section}>
        <CurrentCard />
      </div>

      {/* Action buttons */}
      <div className={styles.section}>
        <ActionButtons />
      </div>

      {/* Contextual zone — phase toolbars, combat dialog, dice, cannon */}
      {hasContextualContent && (
        <div className={styles.contextZone}>
          {/* Phase-specific toolbars */}
          <TerrainToolbar />
          <SideSelection />
          <DeploymentToolbar />

          {/* Combat dialog (pre-roll) */}
          <CombatDialog />

          {/* Dice roll (during combat) */}
          <DiceRoll onDismiss={onDiceRollDismiss} />

          {/* Cannon fire overlay */}
          <CannonFireOverlay effects={effects} />
        </div>
      )}

      {/* Bottom section — unit panel + combat log */}
      <div className={styles.bottomSection}>
        <UnitPanel />
        <CombatLog />
        <CoordsToggle />
      </div>
    </div>
  );
}
