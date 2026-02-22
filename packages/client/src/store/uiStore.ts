import { create } from 'zustand';

type Screen = 'menu' | 'game' | 'victory';

interface PendingAttack {
  attackerId: string;
  defenderId: string;
}

interface CombatEffectInfo {
  defenderPosition: { col: number; row: number };
  unitDestroyed: boolean;
  destroyedUnitId: string | null;
}

interface UIStore {
  screen: Screen;
  showCombatLog: boolean;
  showDiceRoll: boolean;
  showCoords: boolean;
  lastCombatResultIndex: number | null;
  pendingAttack: PendingAttack | null;
  combatEffectInfo: CombatEffectInfo | null;

  setScreen: (screen: Screen) => void;
  toggleCombatLog: () => void;
  toggleCoords: () => void;
  showDice: (combatIndex: number, effectInfo: CombatEffectInfo) => void;
  hideDice: () => void;
  setPendingAttack: (attackerId: string, defenderId: string) => void;
  clearPendingAttack: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  showCombatLog: false,
  showDiceRoll: false,
  showCoords: false,
  lastCombatResultIndex: null,
  pendingAttack: null,
  combatEffectInfo: null,

  setScreen: (screen) => set({ screen }),
  toggleCombatLog: () => set((s) => ({ showCombatLog: !s.showCombatLog })),
  toggleCoords: () => set((s) => ({ showCoords: !s.showCoords })),
  showDice: (combatIndex, effectInfo) => set({ showDiceRoll: true, lastCombatResultIndex: combatIndex, combatEffectInfo: effectInfo }),
  hideDice: () => set({ showDiceRoll: false, combatEffectInfo: null }),
  setPendingAttack: (attackerId, defenderId) => set({ pendingAttack: { attackerId, defenderId } }),
  clearPendingAttack: () => set({ pendingAttack: null }),
}));
