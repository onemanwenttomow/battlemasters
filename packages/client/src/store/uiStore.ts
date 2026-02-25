import { create } from 'zustand';
import type { HexCoord } from '@battle-masters/game-logic';

type Screen = 'menu' | 'game' | 'victory';

interface PendingAttack {
  attackerId: string;
  defenderId: string;
}

export interface PendingDiceRoll {
  attackerId: string;
  defenderId: string;
  attackDice: number;
  defenseDice: number;
  isCharge: boolean;
  defenderPosition: { col: number; row: number };
}

interface CombatEffectInfo {
  defenderPosition: { col: number; row: number };
  damage: number;
  unitDestroyed: boolean;
  destroyedUnitId: string | null;
  damagedUnitId: string | null;
  isCharge: boolean;
}

type CannonFiringStep = 'idle' | 'targeting' | 'path_select' | 'drawing' | 'resolved';

interface UIStore {
  screen: Screen;
  showCombatLog: boolean;
  showDiceRoll: boolean;
  showCoords: boolean;
  lastCombatResultIndex: number | null;
  pendingAttack: PendingAttack | null;
  pendingDiceRoll: PendingDiceRoll | null;
  combatEffectInfo: CombatEffectInfo | null;
  inspectedUnitId: string | null;
  cannonFiringStep: CannonFiringStep;
  showCannonOverlay: boolean;
  previewCannonPath: HexCoord[] | null;

  setScreen: (screen: Screen) => void;
  setInspectedUnit: (unitId: string | null) => void;
  toggleCombatLog: () => void;
  toggleCoords: () => void;
  showDice: (combatIndex: number, effectInfo: CombatEffectInfo) => void;
  hideDice: () => void;
  setPendingAttack: (attackerId: string, defenderId: string) => void;
  clearPendingAttack: () => void;
  startDiceRoll: (info: PendingDiceRoll) => void;
  clearPendingDiceRoll: () => void;
  setCannonFiringStep: (step: CannonFiringStep) => void;
  setShowCannonOverlay: (show: boolean) => void;
  setPreviewCannonPath: (path: HexCoord[] | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  showCombatLog: false,
  showDiceRoll: false,
  showCoords: false,
  lastCombatResultIndex: null,
  pendingAttack: null,
  pendingDiceRoll: null,
  combatEffectInfo: null,
  inspectedUnitId: null,
  cannonFiringStep: 'idle',
  showCannonOverlay: false,
  previewCannonPath: null,

  setScreen: (screen) => set({ screen }),
  setInspectedUnit: (unitId) => set({ inspectedUnitId: unitId }),
  toggleCombatLog: () => set((s) => ({ showCombatLog: !s.showCombatLog })),
  toggleCoords: () => set((s) => ({ showCoords: !s.showCoords })),
  showDice: (combatIndex, effectInfo) => set({ showDiceRoll: true, lastCombatResultIndex: combatIndex, combatEffectInfo: effectInfo }),
  hideDice: () => set({ showDiceRoll: false, combatEffectInfo: null, pendingDiceRoll: null }),
  setPendingAttack: (attackerId, defenderId) => set({ pendingAttack: { attackerId, defenderId } }),
  clearPendingAttack: () => set({ pendingAttack: null }),
  startDiceRoll: (info) => set({ pendingDiceRoll: info, showDiceRoll: true }),
  clearPendingDiceRoll: () => set({ pendingDiceRoll: null }),
  setCannonFiringStep: (step) => set({ cannonFiringStep: step }),
  setShowCannonOverlay: (show) => set({ showCannonOverlay: show }),
  setPreviewCannonPath: (path) => set({ previewCannonPath: path }),
}));
