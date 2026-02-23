import { create } from 'zustand';

type Screen = 'menu' | 'game' | 'victory';

interface PendingAttack {
  attackerId: string;
  defenderId: string;
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
  combatEffectInfo: CombatEffectInfo | null;
  inspectedUnitId: string | null;
  cannonFiringStep: CannonFiringStep;

  setScreen: (screen: Screen) => void;
  setInspectedUnit: (unitId: string | null) => void;
  toggleCombatLog: () => void;
  toggleCoords: () => void;
  showDice: (combatIndex: number, effectInfo: CombatEffectInfo) => void;
  hideDice: () => void;
  setPendingAttack: (attackerId: string, defenderId: string) => void;
  clearPendingAttack: () => void;
  setCannonFiringStep: (step: CannonFiringStep) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  showCombatLog: false,
  showDiceRoll: false,
  showCoords: false,
  lastCombatResultIndex: null,
  pendingAttack: null,
  combatEffectInfo: null,
  inspectedUnitId: null,
  cannonFiringStep: 'idle',

  setScreen: (screen) => set({ screen }),
  setInspectedUnit: (unitId) => set({ inspectedUnitId: unitId }),
  toggleCombatLog: () => set((s) => ({ showCombatLog: !s.showCombatLog })),
  toggleCoords: () => set((s) => ({ showCoords: !s.showCoords })),
  showDice: (combatIndex, effectInfo) => set({ showDiceRoll: true, lastCombatResultIndex: combatIndex, combatEffectInfo: effectInfo }),
  hideDice: () => set({ showDiceRoll: false, combatEffectInfo: null }),
  setPendingAttack: (attackerId, defenderId) => set({ pendingAttack: { attackerId, defenderId } }),
  clearPendingAttack: () => set({ pendingAttack: null }),
  setCannonFiringStep: (step) => set({ cannonFiringStep: step }),
}));
