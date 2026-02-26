import { create } from 'zustand';
import {
  GameState,
  GameAction,
  GamePhase,
  Faction,
  BattleCard,
  Unit,
  CombatEvent,
  HexCoord,
} from '@battle-masters/game-logic';
import {
  createInitialState,
  applyAction,
} from '@battle-masters/game-logic';
import {
  getValidMoveTargets,
  getValidAttackTargets,
} from '@battle-masters/game-logic';

interface GameStore {
  state: GameState | null;
  mode: 'local' | 'online';

  // Derived getters
  currentPhase: () => GamePhase | null;
  activeFaction: () => Faction | null;
  currentCard: () => BattleCard | null;
  selectedUnit: () => Unit | null;
  validMoveTargets: () => HexCoord[];
  validAttackTargetIds: () => string[];

  // Actions
  initGame: (seed?: number, scenarioId?: string) => void;
  dispatch: (action: GameAction) => void;
  syncState: (serverState: GameState) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  mode: 'local',

  currentPhase: () => get().state?.currentPhase ?? null,
  activeFaction: () => get().state?.activeFaction ?? null,
  currentCard: () => get().state?.currentCard ?? null,

  selectedUnit: () => {
    const s = get().state;
    if (!s || !s.selectedUnitId) return null;
    return s.units.get(s.selectedUnitId) ?? null;
  },

  validMoveTargets: () => {
    const s = get().state;
    if (!s || !s.selectedUnitId) return [];
    return getValidMoveTargets(s, s.selectedUnitId);
  },

  validAttackTargetIds: () => {
    const s = get().state;
    if (!s || !s.selectedUnitId) return [];
    return getValidAttackTargets(s, s.selectedUnitId);
  },

  initGame: (seed, scenarioId) => {
    const initial = createInitialState(seed);
    const started = applyAction(initial, { type: 'START_GAME', scenarioId });
    set({ state: started });
  },

  dispatch: (action) => {
    const { state, mode } = get();
    if (!state) return;

    if (mode === 'local') {
      const next = applyAction(state, action);
      set({ state: next });
    } else {
      // Phase 2: Send action to Colyseus server
      console.log('Online mode: would send action to server', action);
    }
  },

  syncState: (serverState) => {
    set({ state: serverState });
  },
}));
