import type { BattleCard } from '@battle-masters/game-logic';

const CARD_BACK = '/assets/cards/card-back.png';

/**
 * Returns the image path for a battle card based on its unitTypes, faction, and special ability.
 * Falls back to card-back.png if no match is found.
 */
export function getCardImage(card: BattleCard): string {
  const types = [...card.unitTypes].sort();
  const key = types.join('+');
  const special = card.special ?? '';

  if (card.faction === 'imperial') {
    return IMPERIAL_MAP[`${key}|${special}`] ?? CARD_BACK;
  }
  return CHAOS_MAP[`${key}|${special}`] ?? CARD_BACK;
}

export function getCardBackImage(): string {
  return CARD_BACK;
}

export function getOgreSubCardImage(type: 'ogre_move' | 'ogre_attack'): string {
  return type === 'ogre_move'
    ? '/assets/cards/ogre/ogre-move-card.png'
    : '/assets/cards/ogre/ogre-attack-card.png';
}

/** Warm the browser cache for every card image so flips don't show a load delay. */
export function preloadCardImages(): void {
  const paths = [
    CARD_BACK,
    '/assets/cards/ogre/ogre-move-card.png',
    '/assets/cards/ogre/ogre-attack-card.png',
    ...Object.values(IMPERIAL_MAP),
    ...Object.values(CHAOS_MAP),
  ];
  for (const path of paths) {
    const img = new Image();
    img.src = path;
  }
}

// Keys are sorted unitTypes joined with '+', pipe, then special (empty string if none)
const IMPERIAL_MAP: Record<string, string> = {
  // ALL_MOVE (whole army)
  'archer+crossbowman+imperial_knights+lord_knights+men_at_arms|ALL_MOVE': '/assets/cards/playing-card-13.png',
  // Men-at-Arms + Archer
  'archer+men_at_arms|': '/assets/cards/playing-card-14.png',
  // Mighty Cannon (CANNON_FIRE)
  'mighty_cannon|CANNON_FIRE': '/assets/cards/playing-card-15.png',
  // Archer only
  'archer|': '/assets/cards/playing-card-16.png',
  // Imperial Knights only
  'imperial_knights|': '/assets/cards/playing-card-17.png',
  // Men-at-Arms + Crossbowman + Archer
  'archer+crossbowman+men_at_arms|': '/assets/cards/playing-card-18.png',
  // Lord Knights only
  'lord_knights|': '/assets/cards/playing-card-19.png',
  // Imperial Knights + Lord Knights
  'imperial_knights+lord_knights|': '/assets/cards/playing-card-20.png',
  // Lord Knights CHARGE
  'lord_knights|CHARGE': '/assets/cards/playing-card-21.png',
  // Lord Knights + Imperial Knights CHARGE
  'imperial_knights+lord_knights|CHARGE': '/assets/cards/playing-card-22.png',
};

const CHAOS_MAP: Record<string, string> = {
  // ALL_MOVE (whole army)
  'beastman+champions_of_chaos+chaos_bowman+chaos_warrior+goblin+orc+wolf_rider|ALL_MOVE': '/assets/cards/playing-card-23.png',
  // Chaos Bowman + Champions of Chaos
  'champions_of_chaos+chaos_bowman|': '/assets/cards/playing-card-1.png',
  // Chaos Warrior + Champions of Chaos + Chaos Bowman
  'champions_of_chaos+chaos_bowman+chaos_warrior|': '/assets/cards/playing-card-2.png',
  // Champions of Chaos CHARGE
  'champions_of_chaos|CHARGE': '/assets/cards/playing-card-3.png',
  // Goblin + Orc
  'goblin+orc|': '/assets/cards/playing-card-4.png',
  // Champions of Chaos + Wolf Rider
  'champions_of_chaos+wolf_rider|': '/assets/cards/playing-card-5.png',
  // Wolf Rider WOLF_RIDER_DOUBLE_MOVE
  'wolf_rider|WOLF_RIDER_DOUBLE_MOVE': '/assets/cards/playing-card-6.png',
  // Ogre Champion OGRE_RAMPAGE
  'ogre_champion|OGRE_RAMPAGE': '/assets/cards/playing-card-7.png',
  // Goblin + Beastman + Wolf Rider
  'beastman+goblin+wolf_rider|': '/assets/cards/playing-card-8.png',
  // Goblin + Wolf Rider
  'goblin+wolf_rider|': '/assets/cards/playing-card-9.png',
  // Beastman + Orc + Goblin
  'beastman+goblin+orc|': '/assets/cards/playing-card-10.png',
  // Chaos Warrior + Beastman + Orc + Chaos Bowman + Goblin
  'beastman+chaos_bowman+chaos_warrior+goblin+orc|': '/assets/cards/playing-card-11.png',
  // Goblin + Champions of Chaos + Beastman
  'beastman+champions_of_chaos+goblin|': '/assets/cards/playing-card-12.png',
};
