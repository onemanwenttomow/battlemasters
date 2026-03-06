// ─── Coordinates ───────────────────────────────────────────────

export interface HexCoord {
  col: number;
  row: number;
}

// ─── Factions ──────────────────────────────────────────────────

export type Faction = 'imperial' | 'chaos';

// ─── Unit Types ────────────────────────────────────────────────

export type ImperialUnitType =
  | 'men_at_arms'
  | 'archer'
  | 'crossbowman'
  | 'imperial_knights'
  | 'lord_knights'
  | 'mighty_cannon';

export type ChaosUnitType =
  | 'goblin'
  | 'beastman'
  | 'chaos_bowman'
  | 'orc'
  | 'chaos_warrior'
  | 'wolf_rider'
  | 'champions_of_chaos'
  | 'ogre_champion';

export type UnitType = ImperialUnitType | ChaosUnitType;

// ─── Terrain ───────────────────────────────────────────────────

export type TerrainType =
  | 'plain'
  | 'road'
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
  combatValue: number;
  movement: number;
  range: number;
  minRange?: number;
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
  hidden?: boolean;
}

// ─── Board ─────────────────────────────────────────────────────

export interface HexTile {
  coord: HexCoord;
  terrain: TerrainType;
  elevation: number;
  orientation?: number; // Ditch: first open direction. 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
  fortifiedSides?: number; // Ditch: number of fortified sides (2, 3, or 4). Default 4.
}

export interface BoardState {
  width: number;
  height: number;
  tiles: Map<string, HexTile>;
  hedges: Set<string>;
}

/** Canonical edge key for the border between two adjacent hexes */
export function edgeKey(a: HexCoord, b: HexCoord): string {
  const ak = `${a.col},${a.row}`;
  const bk = `${b.col},${b.row}`;
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
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

export interface MeleeCombatEvent {
  type: 'melee';
  turnNumber: number;
  result: CombatResult;
  attackerName: string;
  defenderName: string;
}

export interface CannonFireEvent {
  type: 'cannon_fire';
  turnNumber: number;
  cannonName: string;
  targetName: string | null;
  targetDestroyed: boolean;
  misfire: boolean;
  tileResults: CannonTileResult[];
}

export type CombatEvent = MeleeCombatEvent | CannonFireEvent;

// ─── Battle Cards ──────────────────────────────────────────────

export type SpecialCardType =
  | 'ALL_MOVE'
  | 'CANNON_FIRE'
  | 'OGRE_RAMPAGE'
  | 'WOLF_RIDER_DOUBLE_MOVE'
  | 'CHARGE';

export interface BattleCard {
  id: string;
  faction: Faction;
  unitTypes: UnitType[];
  count: number;
  special?: SpecialCardType;
}

// ─── Ogre Sub-Cards ─────────────────────────────────────────────

export interface OgreSubCard {
  type: 'ogre_move' | 'ogre_attack';
}

// ─── Cannon Tiles ───────────────────────────────────────────────

export type CannonTileType = 'flying' | 'bouncing' | 'explosion';

export interface CannonTile {
  type: CannonTileType;
}

export interface CannonTileResult {
  tileType: CannonTileType;
  unitHit: string | null;   // unit name if hit
  damage: number;
  destroyed: boolean;
  towerRubbleAdded?: boolean;
  towerDestroyed?: boolean;
}

export interface TowerState {
  rubbleCount: number;
  destroyed: boolean;
}

export interface CannonFireState {
  cannonUnitId: string;
  targetCoord: HexCoord;
  targetUnitId: string | null;
  tileDeck: CannonTile[];
  tileIndex: number;
  path: HexCoord[];                  // intermediate hexes from cannon to target (exclusive of both endpoints)
  placedTiles: { coord: HexCoord; tile: CannonTile }[];
  tileResults: CannonTileResult[];   // per-tile hit tracking for combat log
  pathStepIndex: number;
  resolved: boolean;
  misfire: boolean;
  misfireTile: CannonTile | null;
  targetDestroyed: boolean;
  adjacentShot: boolean;
}

// ─── Placeable Terrain (Standard Game) ────────────────────────

export type PlaceableTerrainType = 'tower' | 'marsh' | 'ditch';

// ─── Game Phases ───────────────────────────────────────────────

export type GamePhase =
  | 'setup'
  | 'terrain_placement'
  | 'side_selection'
  | 'deployment'
  | 'draw_card'
  | 'activation'
  | 'combat'
  | 'ogre_rampage'
  | 'cannon_fire'
  | 'game_over';

// ─── Game Actions ──────────────────────────────────────────────

export type GameAction =
  | { type: 'START_GAME'; scenarioId?: string }
  | { type: 'START_STANDARD_GAME'; terrainPlacer: Faction }
  | { type: 'PLACE_TERRAIN'; terrainType: PlaceableTerrainType; position: HexCoord; orientation?: number; fortifiedSides?: number }
  | { type: 'PLACE_HEDGE'; from: HexCoord; to: HexCoord }
  | { type: 'REMOVE_TERRAIN'; position: HexCoord }
  | { type: 'REMOVE_HEDGE'; from: HexCoord; to: HexCoord }
  | { type: 'FINISH_TERRAIN_PLACEMENT' }
  | { type: 'SELECT_SIDE'; side: 'top' | 'bottom' }
  | { type: 'PLACE_UNIT'; unitType: UnitType; position: HexCoord }
  | { type: 'AUTO_DEPLOY' }
  | { type: 'DRAW_CARD' }
  | { type: 'SELECT_UNIT'; unitId: string }
  | { type: 'MOVE_UNIT'; unitId: string; to: HexCoord }
  | { type: 'ATTACK'; attackerId: string; defenderId: string; attackerRolls?: DieResult[]; defenderRolls?: DieResult[] }
  | { type: 'END_ACTIVATION' }
  | { type: 'DRAW_OGRE_CARD' }
  | { type: 'END_OGRE_ACTIVATION' }
  | { type: 'FIRE_CANNON'; targetCoord: HexCoord }
  | { type: 'SELECT_CANNON_PATH'; path: HexCoord[] }
  | { type: 'DRAW_CANNON_TILE' }
  | { type: 'END_CANNON_FIRE' }
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
  // Ogre Rampage sub-deck state
  ogreSubDeck: OgreSubCard[];
  ogreSubCardIndex: number;
  ogreSubCardsTotal: number;
  currentOgreSubCard: OgreSubCard | null;
  // Cannon Fire state
  cannonFireState: CannonFireState | null;
  // Tower state
  towerState: TowerState;
  // Scenario
  scenarioId?: string;
  // Deployment phase
  deploymentZone?: { faction: Faction; rows: number[]; cols?: number[]; additionalHexes?: HexCoord[] };
  unplacedUnits?: { type: UnitType; faction: Faction }[];
  // Card-based deployment (Road to Grunburg)
  cardDeployment?: boolean;
  allUnplacedUnits?: { type: UnitType; faction: Faction }[];
  justDeployedUnitIds?: string[];
  cardDeploymentZones?: { imperial: { rows: number[]; cols?: number[] }; chaos: { rows: number[]; cols?: number[] } };
  // Hidden deployment (Battle of the Plains)
  hiddenDeployment?: boolean;
  hiddenDeploymentZones?: {
    imperial: { rows: number[]; cols: number[]; additionalHexes?: HexCoord[] };
    chaos: { rows: number[]; cols: number[]; additionalHexes?: HexCoord[] };
  };
  // Standard Game fields
  standardGame?: boolean;
  terrainPlacerFaction?: Faction;
  availableTerrain?: { tower: number; marsh: number; ditch: number; hedge: number };
  sideSelectionFaction?: Faction;
  deploymentSides?: { imperial: number[]; chaos: number[] };
  deploymentTurn?: Faction;
}

// ─── Helpers ───────────────────────────────────────────────────

export function coordToKey(coord: HexCoord): string {
  return `${coord.col},${coord.row}`;
}

export function keyToCoord(key: string): HexCoord {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}
