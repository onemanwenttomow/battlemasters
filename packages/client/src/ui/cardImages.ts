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
  'beastman+chaos_bowman+chaos_warrior+champions_of_chaos+goblin+orc+wolf_rider|ALL_MOVE': '/assets/cards/playing-card-23.png',
  // Goblin + Champions of Chaos + Beastman
  'beastman+champions_of_chaos+goblin|': '/assets/cards/playing-card-1.png',
  // Chaos Warrior + Champions of Chaos + Chaos Bowman
  'chaos_bowman+chaos_warrior+champions_of_chaos|': '/assets/cards/playing-card-2.png',
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
  // Chaos Bowman + Champions of Chaos
  'chaos_bowman+champions_of_chaos|': '/assets/cards/playing-card-12.png',
};
