import { create } from 'zustand';

type Screen = 'menu' | 'game' | 'victory';

interface UIStore {
  screen: Screen;
  showCombatLog: boolean;
  showDiceRoll: boolean;
  showCoords: boolean;
  lastCombatResultIndex: number | null;

  setScreen: (screen: Screen) => void;
  toggleCombatLog: () => void;
  toggleCoords: () => void;
  showDice: (combatIndex: number) => void;
  hideDice: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  showCombatLog: false,
  showDiceRoll: false,
  showCoords: false,
  lastCombatResultIndex: null,

  setScreen: (screen) => set({ screen }),
  toggleCombatLog: () => set((s) => ({ showCombatLog: !s.showCombatLog })),
  toggleCoords: () => set((s) => ({ showCoords: !s.showCoords })),
  showDice: (combatIndex) => set({ showDiceRoll: true, lastCombatResultIndex: combatIndex }),
  hideDice: () => set({ showDiceRoll: false }),
}));
