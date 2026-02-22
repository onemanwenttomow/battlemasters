import { HexCoord, BoardState, coordToKey } from './types.js';

// ─── Hex Constants ─────────────────────────────────────────────

/** Pointy-top hex geometry constants */
export const HEX_SIZE = 1; // radius (center to vertex)
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = 2 * HEX_SIZE;

// ─── Cube Coordinates (internal) ───────────────────────────────

interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

// ─── Coordinate Conversions ────────────────────────────────────
// Using even-r offset coordinates for pointy-top hexes
// Even rows are shifted right by half a hex width
// Reference: https://www.redblobgames.com/grids/hexagons/

export function offsetToCube(coord: HexCoord): CubeCoord {
  const q = coord.col - (coord.row + (coord.row & 1)) / 2;
  const r = coord.row;
  const s = -q - r;
  return { q, r, s };
}

export function cubeToOffset(cube: CubeCoord): HexCoord {
  const col = cube.q + (cube.r + (cube.r & 1)) / 2;
  const row = cube.r;
  return { col, row };
}

// ─── World Position Conversion ─────────────────────────────────

/** Convert hex grid coordinate to 3D world position (pointy-top, even-r offset) */
export function hexToWorld(coord: HexCoord): { x: number; z: number } {
  // Even rows shift right: add 0.5 when row is even (row & 1 === 0)
  const x = HEX_SIZE * Math.sqrt(3) * (coord.col + 0.5 * (1 - (coord.row & 1)));
  const z = HEX_SIZE * (3 / 2) * coord.row;
  return { x, z };
}

/** Convert 3D world position back to nearest hex coordinate (pointy-top, even-r) */
export function worldToHex(x: number, z: number): HexCoord {
  // Pointy-top axial conversion
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / HEX_SIZE;
  const r = (2 / 3 * z) / HEX_SIZE;
  const s = -q - r;

  // Round to nearest cube coordinate
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  } else {
    rs = -rq - rr;
  }

  return cubeToOffset({ q: rq, r: rr, s: rs });
}

// ─── Neighbors ─────────────────────────────────────────────────

// Even-r pointy-top neighbor offsets [col, row]
// "Shifted" = even rows (shifted right), "Unshifted" = odd rows
const NEIGHBOR_OFFSETS_SHIFTED: [number, number][] = [
  [+1, 0], [+1, -1], [0, -1],
  [-1, 0], [0, +1], [+1, +1],
];

const NEIGHBOR_OFFSETS_UNSHIFTED: [number, number][] = [
  [+1, 0], [0, -1], [-1, -1],
  [-1, 0], [-1, +1], [0, +1],
];

/** Get the 6 neighboring hex coordinates (even-r pointy-top) */
export function getNeighbors(coord: HexCoord): HexCoord[] {
  // Even rows are shifted right, odd rows are not
  const offsets = (coord.row & 1) === 0 ? NEIGHBOR_OFFSETS_SHIFTED : NEIGHBOR_OFFSETS_UNSHIFTED;
  return offsets.map(([dc, dr]) => ({
    col: coord.col + dc,
    row: coord.row + dr,
  }));
}

// ─── Distance ──────────────────────────────────────────────────

/** Manhattan distance between two hexes in cube coordinates */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ac = offsetToCube(a);
  const bc = offsetToCube(b);
  return Math.max(
    Math.abs(ac.q - bc.q),
    Math.abs(ac.r - bc.r),
    Math.abs(ac.s - bc.s)
  );
}

// ─── Pathfinding & Reachability ────────────────────────────────

/** Check if a coordinate is within board bounds */
export function isInBounds(coord: HexCoord, width: number, height: number): boolean {
  return coord.col >= 0 && coord.col < width && coord.row >= 0 && coord.row < height;
}

/** BFS to find all hexes reachable within a movement range, respecting terrain */
export function getReachableHexes(
  from: HexCoord,
  range: number,
  board: BoardState,
  occupiedHexes: Set<string> = new Set()
): HexCoord[] {
  const visited = new Set<string>();
  const result: HexCoord[] = [];
  const queue: { coord: HexCoord; distance: number }[] = [{ coord: from, distance: 0 }];
  visited.add(coordToKey(from));

  while (queue.length > 0) {
    const { coord, distance } = queue.shift()!;

    if (distance > 0) {
      result.push(coord);
    }

    if (distance >= range) continue;

    for (const neighbor of getNeighbors(coord)) {
      const key = coordToKey(neighbor);
      if (visited.has(key)) continue;
      if (!isInBounds(neighbor, board.width, board.height)) continue;

      const tile = board.tiles.get(key);
      if (!tile) continue;

      // Impassable terrain
      if (tile.terrain === 'river' || tile.terrain === 'marsh') continue;

      // Can't move through occupied hexes (but can stop on them if they're empty)
      if (occupiedHexes.has(key)) continue;

      visited.add(key);
      queue.push({ coord: neighbor, distance: distance + 1 });
    }
  }

  return result;
}

/** Get all hexes within a distance range (ignoring terrain/obstacles) */
export function getHexesInRange(center: HexCoord, range: number, width: number, height: number): HexCoord[] {
  const result: HexCoord[] = [];
  const centerCube = offsetToCube(center);

  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      const s = -q - r;
      const cube: CubeCoord = {
        q: centerCube.q + q,
        r: centerCube.r + r,
        s: centerCube.s + s,
      };
      const offset = cubeToOffset(cube);

      if (q === 0 && r === 0) continue; // Skip center
      if (isInBounds(offset, width, height)) {
        result.push(offset);
      }
    }
  }

  return result;
}

// ─── Line of Sight ─────────────────────────────────────────────

function cubeLineDraw(a: CubeCoord, b: CubeCoord): CubeCoord[] {
  const n = Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  );

  if (n === 0) return [a];

  const results: CubeCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const q = a.q + (b.q - a.q) * t;
    const r = a.r + (b.r - a.r) * t;
    const s = a.s + (b.s - a.s) * t;

    // Round to nearest cube coordinate
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    } else {
      rs = -rq - rr;
    }

    results.push({ q: rq, r: rr, s: rs });
  }

  return results;
}

/**
 * Check line of sight between two hexes.
 * Per Battle Masters rules, archers/crossbowmen can shoot over friendly units,
 * terrain features, and even the Tower. Nothing blocks ranged fire.
 */
export function lineOfSight(_from: HexCoord, _to: HexCoord, _board: BoardState): boolean {
  return true;
}
