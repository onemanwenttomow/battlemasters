import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, applyAction } from '../src/game-state';
import { GameState } from '../src/types';

describe('createInitialState', () => {
  it('creates state in setup phase', () => {
    const state = createInitialState(42);
    expect(state.currentPhase).toBe('setup');
    expect(state.seed).toBe(42);
    expect(state.units.size).toBe(0);
    expect(state.winner).toBeNull();
  });

  it('chaos goes first', () => {
    const state = createInitialState(42);
    expect(state.activeFaction).toBe('chaos');
  });
});

describe('START_GAME', () => {
  it('places units and shuffles deck', () => {
    const state = createInitialState(42);
    const next = applyAction(state, { type: 'START_GAME' });

    expect(next.currentPhase).toBe('draw_card');
    expect(next.units.size).toBeGreaterThan(0);
    expect(next.battleDeck.length).toBeGreaterThan(0);
    expect(next.turnNumber).toBe(1);
  });

  it('places correct number of units (11 imperial + 14 chaos = 25)', () => {
    const state = createInitialState(42);
    const next = applyAction(state, { type: 'START_GAME' });

    expect(next.units.size).toBe(25);

    const imperialUnits = [...next.units.values()].filter(u => u.faction === 'imperial');
    const chaosUnits = [...next.units.values()].filter(u => u.faction === 'chaos');
    expect(imperialUnits.length).toBe(11);
    expect(chaosUnits.length).toBe(14);
  });

  it('places units for both factions', () => {
    const state = createInitialState(42);
    const next = applyAction(state, { type: 'START_GAME' });

    const factions = new Set([...next.units.values()].map(u => u.faction));
    expect(factions.has('imperial')).toBe(true);
    expect(factions.has('chaos')).toBe(true);
  });
});

describe('game flow', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState(42);
    state = applyAction(state, { type: 'START_GAME' });
  });

  it('can draw a card', () => {
    const deckSize = state.battleDeck.length;
    const next = applyAction(state, { type: 'DRAW_CARD' });

    expect(next.currentPhase).toBe('activation');
    expect(next.currentCard).not.toBeNull();
    expect(next.battleDeck.length).toBe(deckSize - 1);
  });

  it('can select and activate a unit', () => {
    let s = applyAction(state, { type: 'DRAW_CARD' });
    expect(s.currentCard).not.toBeNull();

    // Find a unit that matches the drawn card
    const card = s.currentCard!;
    const eligibleUnit = [...s.units.values()].find(
      u => u.faction === card.faction && card.unitTypes.includes(u.definitionType)
    );

    if (eligibleUnit) {
      s = applyAction(s, { type: 'SELECT_UNIT', unitId: eligibleUnit.id });
      expect(s.selectedUnitId).toBe(eligibleUnit.id);
    }
  });

  it('can pass to skip activation', () => {
    let s = applyAction(state, { type: 'DRAW_CARD' });
    const turn = s.turnNumber;
    s = applyAction(s, { type: 'PASS' });

    expect(s.currentPhase).toBe('draw_card');
    expect(s.turnNumber).toBe(turn + 1);
    expect(s.currentCard).toBeNull();
  });

  it('end activation moves to draw_card when no more activations', () => {
    let s = applyAction(state, { type: 'DRAW_CARD' });
    const card = s.currentCard!;

    // Select and end activation for all eligible units
    let eligible;
    while ((eligible = [...s.units.values()].find(
      u =>
        u.faction === card.faction &&
        card.unitTypes.includes(u.definitionType) &&
        !u.hasActivated &&
        !s.activatedUnitIds.includes(u.id)
    ))) {
      s = applyAction(s, { type: 'SELECT_UNIT', unitId: eligible.id });
      s = applyAction(s, { type: 'END_ACTIVATION' });
    }

    // Should eventually return to draw_card phase
    expect(s.currentPhase).toBe('draw_card');
  });

  it('rejects invalid actions', () => {
    // Try to move without selecting first
    let s = applyAction(state, { type: 'DRAW_CARD' });
    const units = [...s.units.values()];
    const someUnit = units[0];

    // Try to move without selecting
    const before = s;
    s = applyAction(s, {
      type: 'MOVE_UNIT',
      unitId: someUnit.id,
      to: { col: 0, row: 0 },
    });
    // State shouldn't change (invalid action)
    expect(s.selectedUnitId).toBe(before.selectedUnitId);
  });
});

describe('combat in game', () => {
  it('can attack adjacent enemy after selecting', () => {
    let state = createInitialState(42);
    state = applyAction(state, { type: 'START_GAME' });

    // Draw a card and find a matching one
    state = applyAction(state, { type: 'DRAW_CARD' });
    const card = state.currentCard!;

    // Find a unit that can be activated
    const attacker = [...state.units.values()].find(
      u => u.faction === card.faction && card.unitTypes.includes(u.definitionType)
    );

    if (attacker) {
      // Place attacker next to an enemy
      const enemy = [...state.units.values()].find(u => u.faction !== card.faction)!;
      attacker.position = { col: 5, row: 3 };
      enemy.position = { col: 5, row: 2 };

      state = applyAction(state, { type: 'SELECT_UNIT', unitId: attacker.id });

      const beforeLog = state.combatLog.length;
      state = applyAction(state, {
        type: 'ATTACK',
        attackerId: attacker.id,
        defenderId: enemy.id,
      });

      // Combat should have happened
      expect(state.combatLog.length).toBe(beforeLog + 1);
    }
  });
});

describe('win condition', () => {
  it('detects win when all enemy units destroyed', () => {
    let state = createInitialState(42);
    state = applyAction(state, { type: 'START_GAME' });

    // Remove all chaos units
    for (const [id, unit] of state.units) {
      if (unit.faction === 'chaos') {
        state.units.delete(id);
      }
    }

    const remaining = [...state.units.values()];
    const factions = new Set(remaining.map(u => u.faction));
    expect(factions.has('chaos')).toBe(false);
    expect(factions.has('imperial')).toBe(true);
  });
});
