import {
  BoardState,
  HexTile,
  HexCoord,
  TerrainType,
  coordToKey,
} from "./types.js";

export const BOARD_WIDTH = 13;
export const BOARD_HEIGHT = 12;

/**
 * Board layout: board[row][col], even-r offset pointy-top hexes.
 * Even rows: 12 cols (0-11), Odd rows: 13 cols (0-12).
 * Half-tiles at edges are treated as full spaces per Battle Masters rules.
 * g=plain, ro=road, ri=river, to=tower, sw=marsh, di=ditch
 */
const BOARD_LAYOUT: string[][] = [
  ["g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g", "g"],
  ["g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g", "g", "g"],
  ["ro", "g", "ri", "ri", "ro", "to", "ri", "ri", "ro", "g", "ri", "ri"],
  ["ro", "ri", "ri", "g", "ro", "ri", "ri", "g", "ro", "ri", "ri", "g", "ro"],
  ["ro", "g", "g", "ro", "ro", "g", "g", "ro", "ro", "g", "g", "ro"],
  ["g", "ro", "g", "ro", "g", "ro", "g", "ro", "g", "ro", "g", "ro", "g"],
  ["g", "ro", "ro", "g", "g", "ro", "ro", "g", "g", "ro", "ro", "g"],
  ["g", "g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g", "g"],
  ["g", "g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g"],
  ["g", "g", "g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g"],
  ["g", "g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g"],
  ["g", "g", "ro", "g", "g", "g", "ro", "g", "g", "g", "ro", "g", "g"],
];

/** Rows where the river runs — road tiles here become fords */
const RIVER_ROWS = new Set([2, 3]);

function mapTerrain(code: string, row: number): TerrainType {
  switch (code) {
    case "ri":
      return "river";
    case "to":
      return "tower";
    case "sw":
      return "marsh";
    case "di":
      return "ditch";
    case "ro":
      return RIVER_ROWS.has(row) ? "ford" : "road";
    case "g":
    default:
      return "plain";
  }
}

/** Create the default Battle Masters board layout */
export function createDefaultBoard(): BoardState {
  const tiles = new Map<string, HexTile>();

  for (let row = 0; row < BOARD_HEIGHT; row++) {
    const rowData = BOARD_LAYOUT[row];
    for (let col = 0; col < rowData.length; col++) {
      const coord: HexCoord = { col, row };
      tiles.set(coordToKey(coord), {
        coord,
        terrain: mapTerrain(rowData[col], row),
        elevation: 0,
      });
    }
  }

  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    tiles,
  };
}

/** Get a tile from the board, returning undefined if out of bounds */
export function getTile(
  board: BoardState,
  coord: HexCoord,
): HexTile | undefined {
  return board.tiles.get(coordToKey(coord));
}

/** Check if a terrain type blocks movement */
export function isImpassable(terrain: TerrainType): boolean {
  return terrain === "river" || terrain === "marsh";
}

/** Check if terrain provides a defensive bonus */
export function getDefenseModifier(terrain: TerrainType): number {
  switch (terrain) {
    case "tower":
      return 1;
    case "ditch":
      return 1;
    default:
      return 0;
  }
}

/** Check if terrain penalizes attackers */
export function getAttackModifier(terrain: TerrainType): number {
  switch (terrain) {
    case "tower":
      return -1;
    default:
      return 0;
  }
}

/** Bonus attack dice for attacker's own terrain */
export function getAttackerTerrainBonus(terrain: TerrainType): number {
  switch (terrain) {
    case "tower":
      return 1;
    default:
      return 0;
  }
}
