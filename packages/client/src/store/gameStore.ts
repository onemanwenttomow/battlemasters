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
  UnitType,
  CampaignUnitState,
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
  initStandardGame: (terrainPlacer: Faction) => void;
  initCampaignGame: (scenarioId: string, imperialRoster: CampaignUnitState[], chaosRoster: CampaignUnitState[]) => void;
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

  initStandardGame: (terrainPlacer) => {
    const initial = createInitialState();
    const started = applyAction(initial, { type: 'START_STANDARD_GAME', terrainPlacer });
    set({ state: started });
  },

  initCampaignGame: (scenarioId, imperialRoster, chaosRoster) => {
    const initial = createInitialState();
    const started = applyAction(initial, { type: 'START_GAME', scenarioId });

    // Build a count of available units per type+faction from rosters
    const rosterCounts = new Map<string, number>();
    for (const u of [...imperialRoster, ...chaosRoster]) {
      const key = `${u.faction}:${u.definitionType}`;
      rosterCounts.set(key, (rosterCounts.get(key) ?? 0) + 1);
    }

    // Build a lookup for HP values from roster (consume in order)
    const rosterHpQueues = new Map<string, number[]>();
    for (const u of [...imperialRoster, ...chaosRoster]) {
      const key = `${u.faction}:${u.definitionType}`;
      if (!rosterHpQueues.has(key)) rosterHpQueues.set(key, []);
      rosterHpQueues.get(key)!.push(u.hp);
    }

    // Patch placed units: remove dead, update HP
    const patchedUnits = new Map<string, Unit>();
    for (const [id, unit] of started.units) {
      const key = `${unit.faction}:${unit.definitionType}`;
      const count = rosterCounts.get(key) ?? 0;
      if (count > 0) {
        rosterCounts.set(key, count - 1);
        const hpQueue = rosterHpQueues.get(key);
        const hp = hpQueue && hpQueue.length > 0 ? hpQueue.shift()! : unit.hp;
        patchedUnits.set(id, { ...unit, hp, maxHp: unit.maxHp });
      }
      // If count is 0, unit is dead — omit from map
    }

    // Patch unplaced units: filter out dead unit types
    // rosterCounts now holds the remaining count after placed units were consumed
    let patchedUnplaced = started.unplacedUnits;
    if (patchedUnplaced) {
      const unplacedRosterCounts = new Map(rosterCounts);
      patchedUnplaced = patchedUnplaced.filter((u) => {
        const key = `${u.faction}:${u.type}`;
        const count = unplacedRosterCounts.get(key) ?? 0;
        if (count > 0) {
          unplacedRosterCounts.set(key, count - 1);
          return true;
        }
        return false;
      });
    }

    // Also patch allUnplacedUnits (for card-based deployment)
    let patchedAllUnplaced = started.allUnplacedUnits;
    if (patchedAllUnplaced) {
      const allUnplacedRosterCounts = new Map(rosterCounts);
      patchedAllUnplaced = patchedAllUnplaced.filter((u) => {
        const key = `${u.faction}:${u.type}`;
        const count = allUnplacedRosterCounts.get(key) ?? 0;
        if (count > 0) {
          allUnplacedRosterCounts.set(key, count - 1);
          return true;
        }
        return false;
      });
    }

    set({
      state: {
        ...started,
        units: patchedUnits,
        unplacedUnits: patchedUnplaced,
        allUnplacedUnits: patchedAllUnplaced,
      },
    });
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
