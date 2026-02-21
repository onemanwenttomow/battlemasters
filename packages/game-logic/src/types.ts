// ─── Coordinates ───────────────────────────────────────────────

export interface HexCoord {
  col: number;
  row: number;
}

// ─── Factions ──────────────────────────────────────────────────

export type Faction = 'kingdom' | 'legion';

// ─── Unit Types ────────────────────────────────────────────────

export type KingdomUnitType = 'footsoldier' | 'ranger' | 'cavalry' | 'cannon';
export type LegionUnitType = 'warrior' | 'skirmisher' | 'beast_rider' | 'brute' | 'warlord';
export type UnitType = KingdomUnitType | LegionUnitType;

// ─── Terrain ───────────────────────────────────────────────────

export type TerrainType =
  | 'plain'
  | 'river'
  | 'ford'
  | 'tower'
  | 'forest'
  | 'hill'
  | 'marsh'
  | 'hedge'
  | 'ditch';

// ─── Units ─────────────────────────────────────────────────────

export interface UnitDefinition {
  type: UnitType;
  name: string;
  faction: Faction;
  hp: number;
  attack: number;
  defense: number;
  movement: number;
  range: number;
  special?: string[];
  spriteKey: string;
}

export interface Unit {
  id: string;
  definitionType: UnitType;
  faction: Faction;
  hp: number;
  maxHp: number;
  position: HexCoord;
  hasActivated: boolean;
  hasAttacked: boolean;
  hasMoved: boolean;
}

// ─── Board ─────────────────────────────────────────────────────

export interface HexTile {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
}

export interface BoardState {
  width: number;
  height: number;
  tiles: Map<string, HexTile>;
}

// ─── Combat ────────────────────────────────────────────────────

export type DieResult = 'skull' | 'blank' | 'shield';

export interface CombatResult {
  attackerId: string;
  defenderId: string;
  attackerRolls: DieResult[];
  defenderRolls: DieResult[];
  hits: number;
  blocks: number;
  damage: number;
  unitDestroyed: boolean;
}

export interface CombatEvent {
  turnNumber: number;
  result: CombatResult;
}

// ─── Battle Cards ──────────────────────────────────────────────

export type SpecialCardType = 'ALL_MOVE' | 'CANNON_FIRE' | 'OGRE_RAMPAGE';

export interface BattleCard {
  id: string;
  faction: Faction;
  unitTypes: UnitType[];
  count: number;
  special?: SpecialCardType;
}

// ─── Game Phases ───────────────────────────────────────────────

export type GamePhase =
  | 'setup'
  | 'draw_card'
  | 'activation'
  | 'combat'
  | 'game_over';

// ─── Game Actions ──────────────────────────────────────────────

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'DRAW_CARD' }
  | { type: 'SELECT_UNIT'; unitId: string }
  | { type: 'MOVE_UNIT'; unitId: string; to: HexCoord }
  | { type: 'ATTACK'; attackerId: string; defenderId: string }
  | { type: 'END_ACTIVATION' }
  | { type: 'PASS' };

// ─── Game State ────────────────────────────────────────────────

export interface GameState {
  board: BoardState;
  units: Map<string, Unit>;
  currentPhase: GamePhase;
  activeFaction: Faction;
  battleDeck: BattleCard[];
  discardPile: BattleCard[];
  currentCard: BattleCard | null;
  combatLog: CombatEvent[];
  turnNumber: number;
  winner: Faction | null;
  selectedUnitId: string | null;
  activatedUnitIds: string[];
  seed: number;
}

// ─── Helpers ───────────────────────────────────────────────────

export function coordToKey(coord: HexCoord): string {
  return `${coord.col},${coord.row}`;
}

export function keyToCoord(key: string): HexCoord {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}
