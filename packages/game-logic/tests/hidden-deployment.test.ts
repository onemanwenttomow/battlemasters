import { describe, it, expect } from 'vitest';
import { createInitialState, applyAction } from '../src/game-state';
import { GameState } from '../src/types';

function startPlains(seed = 42): GameState {
  const state = createInitialState(seed);
  return applyAction(state, { type: 'START_GAME', scenarioId: 'battle_of_the_plains' });
}

describe('Hidden Deployment — Battle of the Plains', () => {
  describe('START_GAME', () => {
    it('enters deployment phase with hiddenDeployment flag', () => {
      const state = startPlains();
      expect(state.currentPhase).toBe('deployment');
      expect(state.hiddenDeployment).toBe(true);
    });

    it('chaos places first', () => {
      const state = startPlains();
      expect(state.deploymentTurn).toBe('chaos');
      expect(state.activeFaction).toBe('chaos');
    });

    it('has all 25 units as unplaced', () => {
      const state = startPlains();
      expect(state.unplacedUnits).toBeDefined();
      expect(state.unplacedUnits!.length).toBe(25);
    });

    it('sets deployment zone to chaos zone', () => {
      const state = startPlains();
      expect(state.deploymentZone).toBeDefined();
      expect(state.deploymentZone!.faction).toBe('chaos');
      expect(state.deploymentZone!.cols).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
    });

    it('stores both deployment zones', () => {
      const state = startPlains();
      expect(state.hiddenDeploymentZones).toBeDefined();
      expect(state.hiddenDeploymentZones!.imperial.cols).toEqual([0, 1, 2, 3, 4]);
      expect(state.hiddenDeploymentZones!.imperial.additionalHexes).toHaveLength(5);
      expect(state.hiddenDeploymentZones!.chaos.cols).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
    });
  });

  describe('PLACE_UNIT', () => {
    it('places a chaos unit as hidden', () => {
      let state = startPlains();
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'goblin', position: { col: 8, row: 0 } });
      const unit = [...state.units.values()][0];
      expect(unit.hidden).toBe(true);
      expect(unit.definitionType).toBe('goblin');
    });

    it('alternates to imperial after chaos places', () => {
      let state = startPlains();
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'goblin', position: { col: 8, row: 0 } });
      expect(state.deploymentTurn).toBe('imperial');
      expect(state.activeFaction).toBe('imperial');
      expect(state.deploymentZone!.faction).toBe('imperial');
    });

    it('alternates back to chaos after imperial places', () => {
      let state = startPlains();
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'goblin', position: { col: 8, row: 0 } });
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'men_at_arms', position: { col: 2, row: 0 } });
      expect(state.deploymentTurn).toBe('chaos');
      expect(state.activeFaction).toBe('chaos');
    });

    it('rejects placing in wrong zone', () => {
      let state = startPlains();
      // Chaos trying to place in imperial zone
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'goblin', position: { col: 2, row: 0 } });
      // Should still be chaos turn (action rejected)
      expect(state.deploymentTurn).toBe('chaos');
      expect(state.units.size).toBe(0);
    });

    it('rejects placing wrong faction unit', () => {
      let state = startPlains();
      // Chaos turn but trying to place imperial unit
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'men_at_arms', position: { col: 8, row: 0 } });
      expect(state.units.size).toBe(0);
    });

    it('allows imperial to place in additionalHexes', () => {
      let state = startPlains();
      // Place chaos unit first
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'goblin', position: { col: 8, row: 0 } });
      // Now imperial places at (5,1) which is an additionalHex
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'men_at_arms', position: { col: 5, row: 1 } });
      expect(state.units.size).toBe(2);
    });

    it('rejects imperial placing at non-additional col 5 hex', () => {
      let state = startPlains();
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'goblin', position: { col: 8, row: 0 } });
      // (5,0) is NOT in imperial zone — col 5 is not in cols, and (5,0) not in additionalHexes
      state = applyAction(state, { type: 'PLACE_UNIT', unitType: 'men_at_arms', position: { col: 5, row: 0 } });
      expect(state.units.size).toBe(1); // Only the goblin
    });
  });

  describe('Reveal phase', () => {
    function deployAllUnits(): GameState {
      let state = startPlains();

      // Place all chaos units (14) and imperial units (11) alternating
      // Avoid rows 2-3 (river hexes)
      const chaosPositions = [
        { col: 8, row: 0 }, { col: 9, row: 0 }, { col: 10, row: 0 }, { col: 11, row: 0 },
        { col: 8, row: 1 }, { col: 9, row: 1 }, { col: 10, row: 1 }, { col: 11, row: 1 },
        { col: 8, row: 4 }, { col: 9, row: 4 }, { col: 10, row: 4 }, { col: 11, row: 4 },
        { col: 8, row: 5 }, { col: 9, row: 5 },
      ];
      const imperialPositions = [
        { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
        { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
        { col: 0, row: 4 }, { col: 1, row: 4 }, { col: 2, row: 4 },
        { col: 0, row: 5 }, { col: 1, row: 5 },
      ];

      const chaosUnits = state.unplacedUnits!.filter(u => u.faction === 'chaos');
      const imperialUnits = state.unplacedUnits!.filter(u => u.faction === 'imperial');

      let ci = 0, ii = 0;
      while (ci < chaosUnits.length || ii < imperialUnits.length) {
        if (ci < chaosUnits.length) {
          state = applyAction(state, { type: 'PLACE_UNIT', unitType: chaosUnits[ci].type, position: chaosPositions[ci] });
          ci++;
        }
        if (ii < imperialUnits.length) {
          state = applyAction(state, { type: 'PLACE_UNIT', unitType: imperialUnits[ii].type, position: imperialPositions[ii] });
          ii++;
        }
      }

      return state;
    }

    it('reveals all units when all are placed', () => {
      const state = deployAllUnits();
      for (const unit of state.units.values()) {
        expect(unit.hidden).toBeFalsy();
      }
    });

    it('transitions to draw_card phase', () => {
      const state = deployAllUnits();
      expect(state.currentPhase).toBe('draw_card');
      expect(state.turnNumber).toBe(1);
    });

    it('clears hidden deployment state', () => {
      const state = deployAllUnits();
      expect(state.hiddenDeployment).toBe(false);
      expect(state.hiddenDeploymentZones).toBeUndefined();
      expect(state.deploymentZone).toBeUndefined();
      expect(state.deploymentTurn).toBeUndefined();
    });

    it('has battle deck ready', () => {
      const state = deployAllUnits();
      expect(state.battleDeck.length).toBeGreaterThan(0);
    });

    it('has all 25 units on the board', () => {
      const state = deployAllUnits();
      expect(state.units.size).toBe(25);
    });
  });
});
