import {
  BattleCard,
  Faction,
  UnitType,
  SpecialCardType,
  OgreSubCard,
  CannonTile,
} from "./types.js";

// ─── Seeded PRNG ───────────────────────────────────────────────

/** Simple mulberry32 seeded PRNG */
export function createRNG(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Card Definitions ──────────────────────────────────────────

let nextCardId = 1;

function card(
  faction: Faction,
  unitTypes: UnitType[],
  count: number,
  special?: SpecialCardType,
): BattleCard {
  return {
    id: `card_${nextCardId++}`,
    faction,
    unitTypes,
    count,
    special,
  };
}

/** Create the full 59-card battle deck matching the Battle Masters basic rules */
export function createBattleDeck(): BattleCard[] {
  nextCardId = 1;
  const deck: BattleCard[] = [];

  // ─── Imperial Cards (26) ───────────────────────────────────

  // Imperial Knights (×4)
  for (let i = 0; i < 4; i++) deck.push(card("imperial", ["imperial_knights"], 1));

  // Lord Knights (×2)
  for (let i = 0; i < 2; i++) deck.push(card("imperial", ["lord_knights"], 1));

  // Imperial Archers (×2)
  for (let i = 0; i < 2; i++) deck.push(card("imperial", ["archer"], 1));

  // Imperial Knights and Lord Knights (×6)
  for (let i = 0; i < 6; i++) deck.push(card("imperial", ["imperial_knights", "lord_knights"], 1));

  // Men-at-Arms and Imperial Archers (×1)
  deck.push(card("imperial", ["men_at_arms", "archer"], 1));

  // Men-at-Arms, Crossbowmen and Imperial Archers (×4)
  for (let i = 0; i < 4; i++) deck.push(card("imperial", ["men_at_arms", "crossbowman", "archer"], 1));

  // The Mighty Cannon (×4)
  for (let i = 0; i < 4; i++) deck.push(card("imperial", ["mighty_cannon"], 1, "CANNON_FIRE"));

  // Whole Army Move — Imperial (×1)
  deck.push(
    card(
      "imperial",
      ["men_at_arms", "archer", "crossbowman", "imperial_knights", "lord_knights"],
      99,
      "ALL_MOVE",
    ),
  );

  // Lord Knights and Imperial Knights Charge (×1)
  deck.push(card("imperial", ["lord_knights", "imperial_knights"], 1, "CHARGE"));

  // Lord Knights Charge (×1)
  deck.push(card("imperial", ["lord_knights"], 1, "CHARGE"));

  // ─── Chaos Cards (33) ──────────────────────────────────────

  // Goblins and Orcs (×3)
  for (let i = 0; i < 3; i++) deck.push(card("chaos", ["goblin", "orc"], 1));

  // Goblins, Beastmen and Wolf Riders (×1)
  deck.push(card("chaos", ["goblin", "beastman", "wolf_rider"], 1));

  // Goblins and Wolf Riders (×2)
  for (let i = 0; i < 2; i++) deck.push(card("chaos", ["goblin", "wolf_rider"], 1));

  // Champions of Chaos and Wolf Riders (×5)
  for (let i = 0; i < 5; i++) deck.push(card("chaos", ["champions_of_chaos", "wolf_rider"], 1));

  // Champions of Chaos Charge (×2)
  for (let i = 0; i < 2; i++) deck.push(card("chaos", ["champions_of_chaos"], 1, "CHARGE"));

  // Chaos Archers and Champions of Chaos (×1)
  deck.push(card("chaos", ["chaos_bowman", "champions_of_chaos"], 1));

  // Beastmen, Orcs and Goblins (×2)
  for (let i = 0; i < 2; i++) deck.push(card("chaos", ["beastman", "orc", "goblin"], 1));

  // Goblins, Champions of Chaos and Beastmen (×1)
  deck.push(card("chaos", ["goblin", "champions_of_chaos", "beastman"], 1));

  // Chaos Warriors, Champions of Chaos and Chaos Archers (×4)
  for (let i = 0; i < 4; i++) deck.push(card("chaos", ["chaos_warrior", "champions_of_chaos", "chaos_bowman"], 1));

  // Chaos Warriors, Beastmen, Orcs, Chaos Archers and Goblins (×1)
  deck.push(card("chaos", ["chaos_warrior", "beastman", "orc", "chaos_bowman", "goblin"], 1));

  // Wolf Riders Double Move (×5)
  for (let i = 0; i < 5; i++) deck.push(card("chaos", ["wolf_rider"], 2, "WOLF_RIDER_DOUBLE_MOVE"));

  // Whole Army Move — Chaos (×1)
  deck.push(
    card(
      "chaos",
      ["goblin", "beastman", "chaos_bowman", "orc", "chaos_warrior", "wolf_rider", "champions_of_chaos"],
      99,
      "ALL_MOVE",
    ),
  );

  // The Ogre Champion (×5)
  for (let i = 0; i < 5; i++) deck.push(card("chaos", ["ogre_champion"], 1, "OGRE_RAMPAGE"));

  return deck;
}

/** Shuffle a deck using a seeded RNG (Fisher-Yates) */
export function shuffleDeck(
  deck: BattleCard[],
  rng: () => number,
): BattleCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Draw the top card from the deck. Returns [drawnCard, remainingDeck] */
export function drawCard(
  deck: BattleCard[],
): [BattleCard | null, BattleCard[]] {
  if (deck.length === 0) return [null, []];
  return [deck[0], deck.slice(1)];
}

/** Create the 6-card Ogre sub-deck (3 move + 3 attack), shuffled with seeded RNG */
export function createOgreSubDeck(rng: () => number): OgreSubCard[] {
  const deck: OgreSubCard[] = [
    { type: "ogre_move" },
    { type: "ogre_move" },
    { type: "ogre_move" },
    { type: "ogre_attack" },
    { type: "ogre_attack" },
    { type: "ogre_attack" },
  ];
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Reshuffle the discard pile into the deck */
export function reshuffleDeck(
  discard: BattleCard[],
  rng: () => number,
): BattleCard[] {
  return shuffleDeck(discard, rng);
}

/** Create the 9-tile cannon deck: 4 flying, 3 bouncing, 2 explosion, shuffled */
export function createCannonTileDeck(rng: () => number): CannonTile[] {
  const deck: CannonTile[] = [
    { type: "flying" },
    { type: "flying" },
    { type: "flying" },
    { type: "flying" },
    { type: "bouncing" },
    { type: "bouncing" },
    { type: "bouncing" },
    { type: "explosion" },
    { type: "explosion" },
  ];
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
