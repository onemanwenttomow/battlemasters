import { BattleCard, Faction, UnitType, SpecialCardType, OgreSubCard, CannonTile } from './types.js';

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

function card(faction: Faction, unitTypes: UnitType[], count: number, special?: SpecialCardType): BattleCard {
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

  // ─── Imperial Cards ───────────────────────────────────────

  // Men at Arms cards (8 cards, activate 2 each)
  for (let i = 0; i < 8; i++) deck.push(card('imperial', ['men_at_arms'], 2));

  // Archer cards (4 cards, activate 1)
  for (let i = 0; i < 4; i++) deck.push(card('imperial', ['archer'], 1));

  // Crossbowman cards (2 cards, activate 1)
  for (let i = 0; i < 2; i++) deck.push(card('imperial', ['crossbowman'], 1));

  // Imperial Knights cards (3 cards, activate 1)
  for (let i = 0; i < 3; i++) deck.push(card('imperial', ['imperial_knights'], 1));

  // Lord Knights charge card (1 card)
  deck.push(card('imperial', ['lord_knights'], 1, 'CHARGE'));

  // Imperial Knights charge card (1 card)
  deck.push(card('imperial', ['imperial_knights'], 1, 'CHARGE'));

  // Mighty Cannon fire (2 cards)
  for (let i = 0; i < 2; i++) deck.push(card('imperial', ['mighty_cannon'], 1, 'CANNON_FIRE'));

  // Imperial whole army move (1 card)
  deck.push(card('imperial', ['men_at_arms', 'archer', 'crossbowman', 'imperial_knights', 'lord_knights', 'mighty_cannon'], 99, 'ALL_MOVE'));

  // ─── Chaos Cards ──────────────────────────────────────────

  // Goblin cards (4 cards, activate 2)
  for (let i = 0; i < 4; i++) deck.push(card('chaos', ['goblin'], 2));

  // Beastman cards (4 cards, activate 2)
  for (let i = 0; i < 4; i++) deck.push(card('chaos', ['beastman'], 2));

  // Chaos Bowman cards (3 cards, activate 1)
  for (let i = 0; i < 3; i++) deck.push(card('chaos', ['chaos_bowman'], 1));

  // Orc cards (4 cards, activate 2)
  for (let i = 0; i < 4; i++) deck.push(card('chaos', ['orc'], 2));

  // Chaos Warrior cards (3 cards, activate 1)
  for (let i = 0; i < 3; i++) deck.push(card('chaos', ['chaos_warrior'], 1));

  // Wolf Rider cards (2 cards, activate 1)
  for (let i = 0; i < 2; i++) deck.push(card('chaos', ['wolf_rider'], 1));

  // Wolf Rider double move (1 card)
  deck.push(card('chaos', ['wolf_rider'], 2, 'WOLF_RIDER_DOUBLE_MOVE'));

  // Champions of Chaos charge card (1 card)
  deck.push(card('chaos', ['champions_of_chaos'], 1, 'CHARGE'));

  // Ogre Champion rampage (2 cards)
  for (let i = 0; i < 2; i++) deck.push(card('chaos', ['ogre_champion'], 1, 'OGRE_RAMPAGE'));

  // Chaos whole army move (1 card)
  deck.push(card('chaos', ['goblin', 'beastman', 'chaos_bowman', 'orc', 'chaos_warrior', 'wolf_rider', 'champions_of_chaos', 'ogre_champion'], 99, 'ALL_MOVE'));

  return deck;
}

/** Shuffle a deck using a seeded RNG (Fisher-Yates) */
export function shuffleDeck(deck: BattleCard[], rng: () => number): BattleCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Draw the top card from the deck. Returns [drawnCard, remainingDeck] */
export function drawCard(deck: BattleCard[]): [BattleCard | null, BattleCard[]] {
  if (deck.length === 0) return [null, []];
  return [deck[0], deck.slice(1)];
}

/** Create the 6-card Ogre sub-deck (3 move + 3 attack), shuffled with seeded RNG */
export function createOgreSubDeck(rng: () => number): OgreSubCard[] {
  const deck: OgreSubCard[] = [
    { type: 'ogre_move' },
    { type: 'ogre_move' },
    { type: 'ogre_move' },
    { type: 'ogre_attack' },
    { type: 'ogre_attack' },
    { type: 'ogre_attack' },
  ];
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Reshuffle the discard pile into the deck */
export function reshuffleDeck(discard: BattleCard[], rng: () => number): BattleCard[] {
  return shuffleDeck(discard, rng);
}

/** Create the 9-tile cannon deck: 4 flying, 3 bouncing, 2 explosion, shuffled */
export function createCannonTileDeck(rng: () => number): CannonTile[] {
  const deck: CannonTile[] = [
    { type: 'flying' }, { type: 'flying' }, { type: 'flying' }, { type: 'flying' },
    { type: 'bouncing' }, { type: 'bouncing' }, { type: 'bouncing' },
    { type: 'explosion' }, { type: 'explosion' },
  ];
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
