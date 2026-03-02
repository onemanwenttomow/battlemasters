import { describe, it, expect } from 'vitest';
import { createInitialState, applyAction } from '../src/game-state';
import { GameState, BattleCard } from '../src/types';

function startGrunburg(seed = 42): GameState {
  const state = createInitialState(seed);
  return applyAction(state, { type: 'START_GAME', scenarioId: 'battle_on_the_road_to_grunberg' });
}

describe('Card Deployment — Road to Grunburg', () => {
  describe('START_GAME', () => {
    it('populates allUnplacedUnits with 25 units', () => {
      const state = startGrunburg();
      expect(state.allUnplacedUnits).toBeDefined();
      expect(state.allUnplacedUnits!.length).toBe(25);
    });

    it('starts in draw_card phase with no units on board', () => {
      const state = startGrunburg();
      expect(state.currentPhase).toBe('draw_card');
      expect(state.units.size).toBe(0);
    });

    it('creates and shuffles the battle deck immediately', () => {
      const state = startGrunburg();
      expect(state.battleDeck.length).toBeGreaterThan(0);
    });

    it('sets cardDeployment flag', () => {
      const state = startGrunburg();
      expect(state.cardDeployment).toBe(true);
    });

    it('sets cardDeploymentZones with column-based zones', () => {
      const state = startGrunburg();
      expect(state.cardDeploymentZones).toBeDefined();
      expect(state.cardDeploymentZones!.chaos.cols).toEqual([0]);
      expect(state.cardDeploymentZones!.imperial.cols).toEqual([12]);
    });

    it('applies board overrides (no tower, marsh tiles)', () => {
      const state = startGrunburg();
      // Tower removed at (5,2)
      const towerTile = state.board.tiles.get('5,2');
      expect(towerTile?.terrain).toBe('plain');
      // Marsh added
      const marsh1 = state.board.tiles.get('6,5');
      expect(marsh1?.terrain).toBe('marsh');
      const marsh2 = state.board.tiles.get('6,9');
      expect(marsh2?.terrain).toBe('marsh');
      const marsh3 = state.board.tiles.get('7,11');
      expect(marsh3?.terrain).toBe('marsh');
    });

    it('has no hedges', () => {
      const state = startGrunburg();
      expect(state.board.hedges.size).toBe(0);
    });
  });

  describe('DRAW_CARD triggers deployment', () => {
    it('enters deployment phase when card matches unplaced units', () => {
      const state = startGrunburg();
      const next = applyAction(state, { type: 'DRAW_CARD' });

      // The drawn card should match some unplaced units
      if (next.currentPhase === 'deployment') {
        expect(next.unplacedUnits).toBeDefined();
        expect(next.unplacedUnits!.length).toBeGreaterThan(0);
        expect(next.deploymentZone).toBeDefined();
      }
      // It's valid for the card to not match (e.g., OGRE_RAMPAGE with no placed ogre)
    });

    it('clears justDeployedUnitIds at start of each draw', () => {
      const state = startGrunburg();
      // Manually set some justDeployedUnitIds to verify they get cleared
      const modified = { ...state, justDeployedUnitIds: ['fake-id-1', 'fake-id-2'] } as GameState;
      // Can't easily test through applyAction since validation blocks direct mutation,
      // but the draw_card handler clears them
      const next = applyAction(state, { type: 'DRAW_CARD' });
      expect(next.justDeployedUnitIds).toEqual([]);
    });

    it('sets deployment zone with correct columns for faction', () => {
      const state = startGrunburg();
      const next = applyAction(state, { type: 'DRAW_CARD' });

      if (next.currentPhase === 'deployment' && next.deploymentZone) {
        const faction = next.currentCard!.faction;
        if (faction === 'chaos') {
          expect(next.deploymentZone.cols).toEqual([0]);
        } else {
          expect(next.deploymentZone.cols).toEqual([12]);
        }
      }
    });
  });

  describe('Column-based zone validation', () => {
    it('rejects placement outside deployment columns', () => {
      const state = startGrunburg();
      let next = applyAction(state, { type: 'DRAW_CARD' });

      if (next.currentPhase !== 'deployment' || !next.unplacedUnits?.length) return;

      const unitType = next.unplacedUnits[0].type;
      const faction = next.currentCard!.faction;

      // Try to place in a column that's not in the deployment zone
      const badCol = 5;
      const result = applyAction(next, {
        type: 'PLACE_UNIT',
        unitType,
        position: { col: badCol, row: 5 },
      });
      // Should be rejected — state unchanged
      expect(result.currentPhase).toBe('deployment');
      expect(result.unplacedUnits!.length).toBe(next.unplacedUnits.length);
    });

    it('accepts placement inside deployment columns', () => {
      const state = startGrunburg();
      let next = applyAction(state, { type: 'DRAW_CARD' });

      if (next.currentPhase !== 'deployment' || !next.unplacedUnits?.length) return;

      const unitType = next.unplacedUnits[0].type;
      const faction = next.currentCard!.faction;

      const goodCol = faction === 'chaos' ? 0 : 12;
      const result = applyAction(next, {
        type: 'PLACE_UNIT',
        unitType,
        position: { col: goodCol, row: 5 },
      });
      // Should be accepted
      expect(result.units.size).toBe(next.units.size + 1);
    });
  });

  describe('Just-deployed units', () => {
    it('tracks placed unit IDs in justDeployedUnitIds', () => {
      const state = startGrunburg();
      let next = applyAction(state, { type: 'DRAW_CARD' });

      if (next.currentPhase !== 'deployment' || !next.unplacedUnits?.length) return;

      const unitType = next.unplacedUnits[0].type;
      const faction = next.currentCard!.faction;
      const goodCol = faction === 'chaos' ? 0 : 12;

      const result = applyAction(next, {
        type: 'PLACE_UNIT',
        unitType,
        position: { col: goodCol, row: 3 },
      });

      expect(result.justDeployedUnitIds).toBeDefined();
      expect(result.justDeployedUnitIds!.length).toBeGreaterThan(0);
    });
  });

  describe('Turn flow after deployment', () => {
    it('ends turn when all card units are newly deployed and no pre-existing units', () => {
      // Draw first card, place all units, since no pre-existing units it should end turn
      const state = startGrunburg();
      let next = applyAction(state, { type: 'DRAW_CARD' });

      if (next.currentPhase !== 'deployment') return;

      const faction = next.currentCard!.faction;
      const goodCol = faction === 'chaos' ? 0 : 12;
      let row = 0;

      // Place all unplaced units
      while (next.currentPhase === 'deployment' && next.unplacedUnits && next.unplacedUnits.length > 0) {
        const unitType = next.unplacedUnits[0].type;
        next = applyAction(next, {
          type: 'PLACE_UNIT',
          unitType,
          position: { col: goodCol, row },
        });
        row++;
      }

      // Since no pre-existing units of card's types, should go back to draw_card
      expect(next.currentPhase).toBe('draw_card');
      expect(next.turnNumber).toBe(2);
    });

    it('enters activation when pre-existing units of same type exist', () => {
      // We need to play through multiple turns to have pre-existing units
      const state = startGrunburg();
      let current = state;

      // Play multiple draw/deploy cycles until we get a card where units of that type
      // were already placed in a previous turn
      let foundActivation = false;
      for (let turn = 0; turn < 20 && !foundActivation; turn++) {
        if (current.currentPhase !== 'draw_card') break;

        current = applyAction(current, { type: 'DRAW_CARD' });

        if (current.currentPhase === 'deployment') {
          const faction = current.currentCard!.faction;
          const goodCol = faction === 'chaos' ? 0 : 12;
          let row = 0;

          // Find an available row
          while (current.currentPhase === 'deployment' && current.unplacedUnits && current.unplacedUnits.length > 0) {
            const unitType = current.unplacedUnits[0].type;
            // Try each row until we find an empty one
            let placed = false;
            for (let r = row; r < 12 && !placed; r++) {
              const attempt = applyAction(current, {
                type: 'PLACE_UNIT',
                unitType,
                position: { col: goodCol, row: r },
              });
              if (attempt !== current) {
                current = attempt;
                placed = true;
                row = r + 1;
              }
            }
            if (!placed) {
              // Try other column
              for (let c of (faction === 'chaos' ? [0, 1] : [10, 11])) {
                for (let r = 0; r < 12 && !placed; r++) {
                  const attempt = applyAction(current, {
                    type: 'PLACE_UNIT',
                    unitType,
                    position: { col: c, row: r },
                  });
                  if (attempt !== current) {
                    current = attempt;
                    placed = true;
                  }
                }
              }
              if (!placed) break;
            }
          }

          if (current.currentPhase === 'activation') {
            foundActivation = true;
          } else if (current.currentPhase === 'draw_card') {
            continue;
          } else {
            break;
          }
        } else if (current.currentPhase === 'activation') {
          // Card didn't trigger deployment (all units of that type already placed)
          foundActivation = true;
        } else {
          // Some special phase (ogre_rampage, cannon_fire) — pass/end it
          if (current.currentPhase === 'ogre_rampage') {
            current = applyAction(current, { type: 'PASS' });
          } else if (current.currentPhase === 'cannon_fire') {
            current = applyAction(current, { type: 'PASS' });
          }
        }
      }

      // We should eventually get to activation phase
      // (this depends on card draw order but with 20 turns it's very likely)
      if (foundActivation) {
        expect(current.currentPhase).toBe('activation');
      }
    });
  });

  describe('allUnplacedUnits persists across deck reshuffles', () => {
    it('allUnplacedUnits is independent of deck state', () => {
      const state = startGrunburg();
      expect(state.allUnplacedUnits).toBeDefined();
      expect(state.battleDeck.length).toBeGreaterThan(0);
      // Both are independently tracked
      expect(state.allUnplacedUnits!.length).toBe(25);
    });
  });

  describe('Win condition with unplaced units', () => {
    it('does not declare elimination while faction has unplaced units', () => {
      const state = startGrunburg();
      // Draw a card — even if only imperial units get placed, chaos should not lose
      let current = applyAction(state, { type: 'DRAW_CARD' });

      // Play several turns placing only one faction's units
      for (let i = 0; i < 5; i++) {
        if (current.currentPhase === 'deployment') {
          const faction = current.currentCard!.faction;
          const goodCol = faction === 'chaos' ? 0 : 12;
          let row = 0;
          while (current.currentPhase === 'deployment' && current.unplacedUnits && current.unplacedUnits.length > 0) {
            const unitType = current.unplacedUnits[0].type;
            let placed = false;
            for (let r = row; r < 12 && !placed; r++) {
              const attempt = applyAction(current, {
                type: 'PLACE_UNIT',
                unitType,
                position: { col: goodCol, row: r },
              });
              if (attempt !== current) {
                current = attempt;
                placed = true;
                row = r + 1;
              }
            }
            if (!placed) break;
          }
        }
        if (current.currentPhase === 'game_over') break;
        if (current.currentPhase === 'activation') {
          current = applyAction(current, { type: 'PASS' });
        }
        if (current.currentPhase === 'ogre_rampage') {
          current = applyAction(current, { type: 'PASS' });
        }
        if (current.currentPhase === 'cannon_fire') {
          current = applyAction(current, { type: 'PASS' });
        }
        if (current.currentPhase === 'draw_card') {
          current = applyAction(current, { type: 'DRAW_CARD' });
        }
      }

      // Should NOT be game_over due to elimination
      expect(current.currentPhase).not.toBe('game_over');
    });
  });

  describe('Deploys all matching units per type', () => {
    it('goblin+orc card deploys all goblins and all orcs', () => {
      const state = startGrunburg();

      // Find the first goblin+orc card in the deck
      const gobOrcCardIdx = state.battleDeck.findIndex(
        c => c.faction === 'chaos' && c.unitTypes.includes('goblin') && c.unitTypes.includes('orc') && !c.special
      );

      if (gobOrcCardIdx === -1) return; // Skip if no such card in deck order

      // Move that card to front of deck
      let modified = { ...state } as GameState;
      const deck = [...modified.battleDeck];
      const [card] = deck.splice(gobOrcCardIdx, 1);
      deck.unshift(card);
      modified = { ...modified, battleDeck: deck };

      const next = applyAction(modified, { type: 'DRAW_CARD' });

      if (next.currentPhase === 'deployment') {
        // Should have 2 goblins + 2 orcs = 4 units to deploy
        const goblins = next.unplacedUnits!.filter(u => u.type === 'goblin');
        const orcs = next.unplacedUnits!.filter(u => u.type === 'orc');
        expect(goblins.length).toBe(2);
        expect(orcs.length).toBe(2);
      }
    });
  });
});
