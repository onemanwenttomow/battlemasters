# Battle Masters 3

A digital adaptation of the classic Battle Masters board game, built as a TypeScript monorepo.

## Project Structure

```
packages/
  game-logic/   Pure TypeScript game engine (zero deps, Vitest tests)
  client/       Vite + React + Three.js + Zustand frontend
  server/       Colyseus multiplayer server (Phase 2 — not yet implemented)
```

## Commands

```bash
npm run dev          # Start Vite dev server on port 3000
npm run build        # Build game-logic (tsc) then client (vite build)
npm test             # Run all vitest tests in game-logic
npm run test:watch   # Run tests in watch mode
```

## Architecture

### Game Logic (`packages/game-logic/`)

- **Pure functional state machine** — no side effects, no rendering code
- Core function: `applyAction(state, action) → newState`
- Phases: `setup → draw_card → activation → combat → turn_end → game_over`
- Seeded PRNG (mulberry32) for deterministic dice rolls and shuffles
- Key files: `game-state.ts` (state machine), `types.ts` (all interfaces), `hex.ts` (hex math + pathfinding), `combat.ts` (combat resolution), `cards.ts` (battle deck), `validation.ts` (action preconditions)

### Client (`packages/client/`)

- **Three.js engine** in `src/engine/` — rendering, camera, input, effects
- **React UI overlays** in `src/ui/` — HUD, combat dialogs, menus
- **Zustand stores** in `src/store/`:
  - `gameStore` — wraps game-logic state, exposes `dispatch(action)`
  - `uiStore` — screen state, combat UI, cannon overlay
  - `settingsStore` — audio volume settings
- Engine integration via `src/hooks/useGameEngine.ts`
- Client imports game-logic **source directly** via `exports` field (not built dist)

### Board

- 15x12 hex grid, flat-top, odd-q offset coordinates
- Terrain: river (2 fords), forests, hills, tower, roads
- Two factions: Kingdom (Imperial) vs Dark Legion (Chaos)

### Card System

- **Battle deck** defined in `cards.ts` — each card has `faction`, `unitTypes[]`, `count` (movement), and optional `special`
- **Card artwork** mapped in `client/src/ui/cardImages.ts` via `getCardImage(card)`
  - Lookup key: unit types sorted alphabetically, joined with `+`, then `|`, then special type (e.g. `champions_of_chaos+chaos_bowman|`)
  - **Sort order matters**: JS `.sort()` puts `champions_of_chaos` before `chaos_bowman`/`chaos_warrior` (`'m' < 'o'` at index 3)
  - Falls back to `card-back.png` if no key matches
  - Imperial cards: `playing-card-13` through `playing-card-22`
  - Chaos cards: `playing-card-1` through `playing-card-12`, `playing-card-23` (ALL_MOVE)
- **Ogre sub-cards** have separate artwork in `assets/cards/ogre/` — `getOgreSubCardImage()` returns move or attack card image
- **Special card types**: `CHARGE`, `WOLF_RIDER_DOUBLE_MOVE`, `OGRE_RAMPAGE`, `CANNON_FIRE`, `ALL_MOVE`
- Wolf riders have `movement: 1` normally; the `WOLF_RIDER_DOUBLE_MOVE` card grants 2 via `getEffectiveMovement()` in `validation.ts`

## Conventions

- Game logic must remain pure — no DOM, no rendering, no external dependencies
- All game state changes go through `applyAction` — never mutate state directly
- `drawCard` (cards.ts) is the deck operation; `drawCardAction` (actions.ts) is the action creator
- game-logic tsconfig uses `composite: true`; client tsconfig uses `noEmit: true` (Vite handles builds)
- Unit models are GLB files with Draco compression in `packages/client/public/assets/models/units/`
- Tests live in `packages/game-logic/tests/` — run with `npm test` from root

## Deployment

- Deployed via Netlify (see `netlify.toml`)
- Build output: `packages/client/dist/`
