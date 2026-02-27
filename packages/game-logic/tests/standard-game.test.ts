import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyAction,
  createBareBoard,
  coordToKey,
  edgeKey,
  GameState,
  Faction,
} from '../src/index.js';

function startStandardGame(terrainPlacer: Faction = 'imperial'): GameState {
  const state = createInitialState(42);
  return applyAction(state, { type: 'START_STANDARD_GAME', terrainPlacer });
}

describe('createBareBoard', () => {
  it('creates a board without tower, marsh, ditch, or hedges', () => {
    const board = createBareBoard();
    for (const [, tile] of board.tiles) {
      expect(tile.terrain).not.toBe('tower');
      expect(tile.terrain).not.toBe('marsh');
      expect(tile.terrain).not.toBe('ditch');
    }
    expect(board.hedges.size).toBe(0);
  });

  it('preserves river, ford, and road tiles', () => {
    const board = createBareBoard();
    let hasRiver = false;
    let hasFord = false;
    let hasRoad = false;
    for (const [, tile] of board.tiles) {
      if (tile.terrain === 'river') hasRiver = true;
      if (tile.terrain === 'ford') hasFord = true;
      if (tile.terrain === 'road') hasRoad = true;
    }
    expect(hasRiver).toBe(true);
    expect(hasFord).toBe(true);
    expect(hasRoad).toBe(true);
  });
});

describe('START_STANDARD_GAME', () => {
  it('transitions to terrain_placement phase with bare board', () => {
    const state = startStandardGame('imperial');
    expect(state.currentPhase).toBe('terrain_placement');
    expect(state.standardGame).toBe(true);
    expect(state.terrainPlacerFaction).toBe('imperial');
    expect(state.activeFaction).toBe('imperial');
    expect(state.availableTerrain).toEqual({ tower: 1, marsh: 2, ditch: 2, hedge: 4 });
    // Board should have no hedges
    expect(state.board.hedges.size).toBe(0);
  });

  it('rejects if game already started', () => {
    const state = startStandardGame();
    const result = applyAction(state, { type: 'START_STANDARD_GAME', terrainPlacer: 'chaos' });
    // Should be unchanged since validation fails
    expect(result.currentPhase).toBe('terrain_placement');
  });
});

describe('terrain placement', () => {
  it('places tower on plain tile', () => {
    const state = startStandardGame();
    const result = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'tower',
      position: { col: 0, row: 5 },
    });
    const tile = result.board.tiles.get(coordToKey({ col: 0, row: 5 }));
    expect(tile?.terrain).toBe('tower');
    expect(result.availableTerrain!.tower).toBe(0);
  });

  it('places ditch with orientation', () => {
    const state = startStandardGame();
    const result = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'ditch',
      position: { col: 0, row: 5 },
      orientation: 3,
    });
    const tile = result.board.tiles.get(coordToKey({ col: 0, row: 5 }));
    expect(tile?.terrain).toBe('ditch');
    expect(tile?.orientation).toBe(3);
    expect(result.availableTerrain!.ditch).toBe(1);
  });

  it('rejects placement on non-plain tile', () => {
    const state = startStandardGame();
    // Road tile
    const result = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'marsh',
      position: { col: 1, row: 0 }, // road tile
    });
    expect(result.availableTerrain!.marsh).toBe(2); // unchanged
  });

  it('rejects when count is 0', () => {
    let state = startStandardGame();
    state = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'tower',
      position: { col: 0, row: 5 },
    });
    expect(state.availableTerrain!.tower).toBe(0);
    // Try to place another tower
    const result = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'tower',
      position: { col: 4, row: 5 },
    });
    // Should be unchanged
    expect(result.board.tiles.get(coordToKey({ col: 4, row: 5 }))?.terrain).toBe('plain');
  });

  it('removes placed terrain', () => {
    let state = startStandardGame();
    state = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'marsh',
      position: { col: 0, row: 5 },
    });
    expect(state.availableTerrain!.marsh).toBe(1);

    state = applyAction(state, {
      type: 'REMOVE_TERRAIN',
      position: { col: 0, row: 5 },
    });
    expect(state.board.tiles.get(coordToKey({ col: 0, row: 5 }))?.terrain).toBe('plain');
    expect(state.availableTerrain!.marsh).toBe(2);
  });
});

describe('hedge placement', () => {
  it('places a hedge between adjacent hexes', () => {
    const state = startStandardGame();
    const from = { col: 2, row: 5 };
    const to = { col: 2, row: 4 };
    const result = applyAction(state, { type: 'PLACE_HEDGE', from, to });
    expect(result.board.hedges.has(edgeKey(from, to))).toBe(true);
    expect(result.availableTerrain!.hedge).toBe(3);
  });

  it('removes a hedge', () => {
    let state = startStandardGame();
    const from = { col: 2, row: 5 };
    const to = { col: 2, row: 4 };
    state = applyAction(state, { type: 'PLACE_HEDGE', from, to });
    state = applyAction(state, { type: 'REMOVE_HEDGE', from, to });
    expect(state.board.hedges.has(edgeKey(from, to))).toBe(false);
    expect(state.availableTerrain!.hedge).toBe(4);
  });

  it('rejects hedge on non-adjacent hexes', () => {
    const state = startStandardGame();
    const result = applyAction(state, {
      type: 'PLACE_HEDGE',
      from: { col: 0, row: 0 },
      to: { col: 5, row: 5 },
    });
    expect(result.availableTerrain!.hedge).toBe(4); // unchanged
  });
});

describe('FINISH_TERRAIN_PLACEMENT', () => {
  it('transitions to side_selection with opposite faction', () => {
    const state = startStandardGame('imperial');
    const result = applyAction(state, { type: 'FINISH_TERRAIN_PLACEMENT' });
    expect(result.currentPhase).toBe('side_selection');
    expect(result.sideSelectionFaction).toBe('chaos');
    expect(result.activeFaction).toBe('chaos');
  });
});

describe('SELECT_SIDE', () => {
  it('sets up deployment with correct sides', () => {
    let state = startStandardGame('imperial');
    state = applyAction(state, { type: 'FINISH_TERRAIN_PLACEMENT' });
    state = applyAction(state, { type: 'SELECT_SIDE', side: 'top' });

    expect(state.currentPhase).toBe('deployment');
    // Chaos selected side, they picked top
    expect(state.deploymentSides!.chaos).toEqual([0, 1]);
    expect(state.deploymentSides!.imperial).toEqual([10, 11]);
    // Chaos deploys first
    expect(state.deploymentTurn).toBe('chaos');
    expect(state.activeFaction).toBe('chaos');
    expect(state.deploymentZone).toEqual({ faction: 'chaos', rows: [0, 1] });
    // 25 total units: 11 imperial + 14 chaos
    expect(state.unplacedUnits!.length).toBe(25);
  });
});

describe('alternating deployment', () => {
  it('alternates deployment turns between factions', () => {
    let state = startStandardGame('imperial');
    state = applyAction(state, { type: 'FINISH_TERRAIN_PLACEMENT' });
    state = applyAction(state, { type: 'SELECT_SIDE', side: 'bottom' });

    // Chaos deploys first, their zone is bottom (rows 10, 11)
    expect(state.deploymentTurn).toBe('chaos');
    expect(state.deploymentZone!.rows).toEqual([10, 11]);

    // Place a chaos unit
    state = applyAction(state, {
      type: 'PLACE_UNIT',
      unitType: 'goblin',
      position: { col: 0, row: 10 },
    });

    // Should switch to imperial
    expect(state.deploymentTurn).toBe('imperial');
    expect(state.deploymentZone!.rows).toEqual([0, 1]);

    // Place an imperial unit
    state = applyAction(state, {
      type: 'PLACE_UNIT',
      unitType: 'men_at_arms',
      position: { col: 0, row: 0 },
    });

    // Should switch back to chaos
    expect(state.deploymentTurn).toBe('chaos');
  });

  it('rejects placing wrong faction unit on wrong turn', () => {
    let state = startStandardGame('imperial');
    state = applyAction(state, { type: 'FINISH_TERRAIN_PLACEMENT' });
    state = applyAction(state, { type: 'SELECT_SIDE', side: 'bottom' });

    // Try to place imperial unit on chaos turn
    const before = state.unplacedUnits!.length;
    state = applyAction(state, {
      type: 'PLACE_UNIT',
      unitType: 'men_at_arms',
      position: { col: 0, row: 0 },
    });
    expect(state.unplacedUnits!.length).toBe(before); // unchanged
  });
});

describe('full standard game flow', () => {
  it('completes terrain → side selection → deployment → draw_card', () => {
    let state = startStandardGame('chaos');

    // Place some terrain
    state = applyAction(state, {
      type: 'PLACE_TERRAIN',
      terrainType: 'tower',
      position: { col: 5, row: 5 },
    });
    state = applyAction(state, { type: 'FINISH_TERRAIN_PLACEMENT' });

    // Imperial selects side
    expect(state.activeFaction).toBe('imperial');
    state = applyAction(state, { type: 'SELECT_SIDE', side: 'top' });

    // Deploy all 25 units alternating
    const chaosUnits = state.unplacedUnits!.filter(u => u.faction === 'chaos');
    const imperialUnits = state.unplacedUnits!.filter(u => u.faction === 'imperial');
    expect(chaosUnits.length).toBe(14);
    expect(imperialUnits.length).toBe(11);

    // Place all units — chaos on bottom (10,11), imperial on top (0,1)
    let chaosCol = 0;
    let chaosRow = 10;
    let impCol = 0;
    let impRow = 0;

    const getNextChaosPos = () => {
      const pos = { col: chaosCol, row: chaosRow };
      chaosCol++;
      if (chaosCol >= 13) { chaosCol = 0; chaosRow = 11; }
      return pos;
    };
    const getNextImpPos = () => {
      const pos = { col: impCol, row: impRow };
      impCol++;
      if (impCol >= 12) { impCol = 0; impRow = 1; }
      return pos;
    };

    let totalPlaced = 0;
    while (state.currentPhase === 'deployment' && state.unplacedUnits && state.unplacedUnits.length > 0) {
      const faction = state.deploymentTurn!;
      const unitToPlace = state.unplacedUnits.find(u => u.faction === faction);
      if (!unitToPlace) break;

      const pos = faction === 'chaos' ? getNextChaosPos() : getNextImpPos();
      state = applyAction(state, {
        type: 'PLACE_UNIT',
        unitType: unitToPlace.type,
        position: pos,
      });
      totalPlaced++;
      if (totalPlaced > 30) break; // safety
    }

    expect(state.currentPhase).toBe('draw_card');
    expect(state.units.size).toBe(25);
    expect(state.unplacedUnits).toBeUndefined();
    expect(state.deploymentTurn).toBeUndefined();
  });
});
