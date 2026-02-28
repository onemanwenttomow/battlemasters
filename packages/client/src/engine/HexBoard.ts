import * as THREE from "three";
import {
  BoardState,
  HexTile,
  TerrainType,
  coordToKey,
  keyToCoord,
  getNeighbors,
  getNeighborDirection,
} from "@battle-masters/game-logic";
import { hexToWorld, HEX_SIZE } from "@battle-masters/game-logic";
import { AssetLoader } from "./AssetLoader";

/** Fallback colors for terrain without 3D models */
const TERRAIN_COLORS: Record<TerrainType, number> = {
  plain: 0x4a7a3e,
  road: 0x8a7a5a,
  river: 0x2266aa,
  ford: 0x6699bb,
  tower: 0x888877,
  forest: 0x2d5a27,
  hill: 0x7a6b4e,
  marsh: 0x2a3a1a,
  hedge: 0x3d6a32,
  ditch: 0x5a5040,
};

/** Terrain → model key mapping. Array means stack multiple models. */
const TERRAIN_MODEL_MAP: Partial<Record<TerrainType, string[]>> = {
  plain: ["grass"],
  road: ["grass"],
  river: ["water"],
  ford: ["water"],
  tower: ["building_tower"],
  forest: ["grass_forest"],
  hill: ["grass_hill"],
  marsh: [],
  ditch: [],
  hedge: ["grass"],
};

/** Terrain types that should have their materials recolored */
const TERRAIN_TINT: Partial<Record<TerrainType, number>> = {
  marsh: 0x4a6a3a,
  ditch: 0x8a7a55,
  river: 0x1155cc,
  ford: 0x1155cc,
};

/**
 * Base rotation offset for Kenney path overlays (radians).
 * Adjust this if path pieces appear rotated from their connections.
 */
const PATH_BASE_ROTATION = 0;

/**
 * Manual overrides for specific road/ford tiles.
 * Use this for junctions, forks, or anywhere the auto-detection picks the wrong piece.
 * Key: "col,row", value: { model, dir (0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE) }
 */
const PATH_OVERRIDES: Record<string, { model: string; dir: number }> = {
  "4,4": { model: "path_straight", dir: 2 },
  "0,3": { model: "path_corner", dir: 1 },
  "3,9": { model: "path_corner", dir: 4 },
  "7,9": { model: "path_corner", dir: 4 },
  "11,9": { model: "path_corner", dir: 4 },
  "2,11": { model: "path_straight", dir: 4 },
  "6,11": { model: "path_straight", dir: 4 },
  "10,11": { model: "path_straight", dir: 4 },
  "12,3": { model: "path_straight", dir: 4 },
  "1,0": { model: "path_straight", dir: 4 },
  "5,0": { model: "path_straight", dir: 4 },
  "9,0": { model: "path_straight", dir: 4 },
  "4,3": { model: "path_intersection", dir: 1 },
  "8,3": { model: "path_intersection", dir: 1 },
  "2,7": { model: "path_intersection2", dir: 5 },
  "6,7": { model: "path_intersection2", dir: 5 },
  "10,7": { model: "path_intersection2", dir: 5 },
};

/** Terrains that count as "road-connected" for path overlay detection */
function isRoadConnected(terrain: TerrainType): boolean {
  return terrain === "road" || terrain === "ford" || terrain === "tower";
}

/**
 * Determine which path overlay model and rotation to use for a road/ford tile
 * based on its connected road/ford/tower neighbors.
 *
 * Neighbor direction indices (pointy-top even-r):
 *   0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 */
function getRoadOverlay(
  tile: HexTile,
  board: BoardState,
): { model: string; rotationY: number } | null {
  if (tile.terrain !== "road" && tile.terrain !== "ford") return null;

  // Convert a direction index to a Y rotation in radians.
  // Positive rotation.y = counterclockwise from +X (East) when viewed from above,
  // which matches our hex direction ordering: 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE.
  const dirToRad = (dir: number) => PATH_BASE_ROTATION + dir * (Math.PI / 3);

  // Check for manual override first
  const key = coordToKey(tile.coord);
  const override = PATH_OVERRIDES[key];
  if (override) {
    return { model: override.model, rotationY: dirToRad(override.dir) };
  }

  const neighbors = getNeighbors(tile.coord);
  const roadDirs: number[] = [];

  for (let i = 0; i < 6; i++) {
    const nKey = coordToKey(neighbors[i]);
    const nTile = board.tiles.get(nKey);
    if (nTile && isRoadConnected(nTile.terrain)) {
      roadDirs.push(i);
    }
  }

  if (roadDirs.length === 0) return null;

  if (roadDirs.length === 1) {
    return { model: "path_end", rotationY: dirToRad(roadDirs[0]) };
  }

  // Helper: pick the right model for exactly 2 connection directions
  const pickForPair = (
    a: number,
    b: number,
  ): { model: string; rotationY: number } => {
    const diff = (b - a + 6) % 6;
    if (diff === 3) {
      return { model: "path_straight", rotationY: dirToRad(a) };
    }
    if (diff === 2) {
      return { model: "path_corner", rotationY: dirToRad(a) };
    }
    if (diff === 4) {
      return { model: "path_corner", rotationY: dirToRad(b) };
    }
    if (diff === 1) {
      return { model: "path_cornerSharp", rotationY: dirToRad(a) };
    }
    // diff === 5
    return { model: "path_cornerSharp", rotationY: dirToRad(b) };
  };

  if (roadDirs.length === 2) {
    return pickForPair(roadDirs[0], roadDirs[1]);
  }

  // 3+ connections: find the straight pair (opposite dirs) for the main axis.
  // Use PATH_OVERRIDES above to manually set crossings/forks where needed.
  for (let i = 0; i < roadDirs.length; i++) {
    for (let j = i + 1; j < roadDirs.length; j++) {
      if ((roadDirs[j] - roadDirs[i] + 6) % 6 === 3) {
        return { model: "path_straight", rotationY: dirToRad(roadDirs[i]) };
      }
    }
  }
  // No straight pair — pick the widest-angle pair
  return pickForPair(roadDirs[0], roadDirs[roadDirs.length - 1]);
}

/**
 * Decorative models to scatter on plain grass tiles.
 * Each entry has a weight controlling relative frequency.
 */
const SCATTER_DECORATIONS: { model: string; weight: number }[] = [
  { model: "nature_grass", weight: 6 },
  { model: "nature_grass_dense", weight: 4 },
  { model: "nature_flower_red1", weight: 2 },
  { model: "nature_flower_red2", weight: 2 },
  { model: "nature_flower_blue1", weight: 2 },
  { model: "nature_flower_blue2", weight: 2 },
  { model: "nature_flower_beige1", weight: 2 },
  { model: "nature_flower_beige2", weight: 2 },
  { model: "nature_plant_bushSmall", weight: 3 },
  { model: "nature_plant_flatSmall", weight: 3 },
  { model: "nature_mushroom_red", weight: 1 },
  { model: "nature_mushroom_brown", weight: 1 },
  { model: "nature_rock_small1", weight: 1 },
  { model: "nature_rock_small2", weight: 1 },
];

/**
 * Marsh-specific scatter decorations — dense grasses and bushes only.
 */
const MARSH_SCATTER: { model: string; weight: number }[] = [
  { model: "nature_grass", weight: 5 },
  { model: "nature_grass_dense", weight: 8 },
  { model: "nature_plant_bushSmall", weight: 4 },
  { model: "nature_plant_flatSmall", weight: 3 },
];

/** Terrain types that keep their 3D models (others are covered by the board mat) */
function keepTerrainModel(terrain: TerrainType): boolean {
  return (
    terrain === "tower" ||
    terrain === "marsh" ||
    terrain === "ditch" ||
    terrain === "hedge"
  );
}

/** Only plain grass tiles get scatter decorations */
function canScatter(terrain: TerrainType): boolean {
  return terrain === "plain";
}

/**
 * Check that this tile AND all 6 direct neighbors are plain grass (and on-board).
 * This prevents decorations from appearing near roads, rivers, etc.
 */
function isInteriorPlain(tile: HexTile, board: BoardState): boolean {
  if (tile.terrain !== "plain") return false;

  const neighbors = getNeighbors(tile.coord);
  for (let i = 0; i < 6; i++) {
    const nKey = coordToKey(neighbors[i]);
    const nTile = board.tiles.get(nKey);
    if (!nTile || nTile.terrain !== "plain") return false;
  }
  return true;
}

/** Simple seeded PRNG (mulberry32) for deterministic scatter */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class HexBoard {
  private group: THREE.Group;
  private coordLabelsGroup: THREE.Group;
  private hexMeshes: Map<string, THREE.Mesh> = new Map();
  private terrainModels: Map<string, THREE.Group[]> = new Map();
  private hedgeModels: Map<string, THREE.Group> = new Map();
  private scatterGroup: THREE.Group;
  private modelScale = 1;
  private modelScaleComputed = false;
  private hexTileTextures: Map<string, THREE.Texture> = new Map();
  private textureLoader = new THREE.TextureLoader();
  /** Snapshot of tile terrain+orientation for diffing */
  private lastTileState: Map<string, string> = new Map();
  /** Snapshot of hedge keys for diffing */
  private lastHedgeKeys: Set<string> = new Set();

  /** Y position of the top surface of a standard grass tile (after scaling) */
  tileTopY = 0.15; // fallback = extruded hex height

  constructor(
    private scene: THREE.Scene,
    private assetLoader?: AssetLoader,
  ) {
    this.group = new THREE.Group();
    this.coordLabelsGroup = new THREE.Group();
    this.coordLabelsGroup.visible = false;
    this.scatterGroup = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(this.coordLabelsGroup);
    this.scene.add(this.scatterGroup);
    this.computeModelScale();
  }

  /** Measure the grass model to figure out the scale factor and tile top Y */
  private computeModelScale() {
    if (!this.assetLoader) return;
    const grassTemplate = this.assetLoader.getModel("grass");
    if (!grassTemplate) return;

    // Kenney models are natively pointy-top — measure as-is
    const box = new THREE.Box3().setFromObject(grassTemplate);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Pointy-top hex: width (flat-to-flat) = √3 * HEX_SIZE
    // Model's smaller horizontal span = width for pointy-top
    const modelWidth = Math.min(size.x, size.z);
    const targetWidth = Math.sqrt(3) * HEX_SIZE;
    this.modelScale = targetWidth / modelWidth;
    this.modelScaleComputed = true;

    console.log("[HexBoard] grass native size:", {
      x: size.x.toFixed(3),
      y: size.y.toFixed(3),
      z: size.z.toFixed(3),
    });
    console.log(
      "[HexBoard] modelScale:",
      this.modelScale.toFixed(4),
      "tileTopY:",
      (box.max.y * this.modelScale).toFixed(4),
    );

    // Board mat mode: tiles sit at ground level, not on top of 3D grass models
    this.tileTopY = 0;
  }

  /** Build hex tile meshes from board state */
  buildFromState(board: BoardState) {
    this.clear();

    for (const [, tile] of board.tiles) {
      this.createHexTile(tile, board);
    }

    // Scatter decorations disabled — board mat provides ground detail
    // this.placeScatterDecorations(board);
    this.placeHedges(board);
    this.snapshotState(board);
  }

  /** Incrementally update only the tiles/hedges that changed */
  updateFromState(board: BoardState) {
    // Find tiles that changed terrain or orientation
    for (const [key, tile] of board.tiles) {
      const snap = `${tile.terrain}:${tile.orientation ?? ''}`;
      if (this.lastTileState.get(key) !== snap) {
        // Remove old terrain models for this tile
        this.clearTileModels(key);
        // Recreate just this tile's 3D models (the hex mesh stays)
        this.createTileModels(tile, board);
        this.lastTileState.set(key, snap);
      }
    }

    // Find hedges that were added or removed
    const currentHedges = board.hedges;
    // Remove hedges no longer present
    for (const key of this.lastHedgeKeys) {
      if (!currentHedges.has(key)) {
        const model = this.hedgeModels.get(key);
        if (model) {
          this.group.remove(model);
          this.disposeGroup(model);
          this.hedgeModels.delete(key);
        }
      }
    }
    // Add new hedges
    for (const key of currentHedges) {
      if (!this.lastHedgeKeys.has(key)) {
        const [aStr, bStr] = key.split("|");
        const a = keyToCoord(aStr);
        const b = keyToCoord(bStr);
        const hedgeGroup = this.createHedgeOnEdge(a, b);
        this.group.add(hedgeGroup);
        this.hedgeModels.set(key, hedgeGroup);
      }
    }

    this.lastHedgeKeys = new Set(currentHedges);
  }

  private snapshotState(board: BoardState) {
    this.lastTileState.clear();
    for (const [key, tile] of board.tiles) {
      this.lastTileState.set(key, `${tile.terrain}:${tile.orientation ?? ''}`);
    }
    this.lastHedgeKeys = new Set(board.hedges);
  }

  /** Remove only the 3D terrain models for a tile (keep the hex mesh) */
  private clearTileModels(key: string) {
    const models = this.terrainModels.get(key);
    if (models) {
      for (const model of models) {
        this.group.remove(model);
        this.disposeGroup(model);
      }
      this.terrainModels.delete(key);
    }
  }

  /** Create only the 3D terrain models for a tile (tower, marsh overlay, ditch, etc.) */
  private createTileModels(tile: HexTile, board: BoardState) {
    const pos = hexToWorld(tile.coord);
    const key = coordToKey(tile.coord);
    const modelKeys = TERRAIN_MODEL_MAP[tile.terrain];
    const hasModel =
      this.modelScaleComputed &&
      modelKeys &&
      this.assetLoader &&
      keepTerrainModel(tile.terrain);

    if (!hasModel || !modelKeys) return;

    const models: THREE.Group[] = [];
    let baseTopY = 0;

    for (const modelKey of modelKeys) {
      const clone = this.assetLoader!.getModel(modelKey);
      if (!clone) continue;

      if (modelKey === "building_tower") {
        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const maxHoriz = Math.max(size.x, size.z);
        const targetWidth = Math.sqrt(3) * HEX_SIZE * 0.9;
        const scale = maxHoriz > 0 ? targetWidth / maxHoriz : 1;
        clone.scale.setScalar(scale);
        clone.position.set(pos.x, baseTopY, pos.z);
        clone.updateMatrixWorld(true);
        const finalBox = new THREE.Box3().setFromObject(clone);
        const finalCenter = finalBox.getCenter(new THREE.Vector3());
        clone.position.x += pos.x - finalCenter.x;
        clone.position.z += pos.z - finalCenter.z;
        clone.position.y += baseTopY - finalBox.min.y;
      } else {
        clone.scale.setScalar(this.modelScale);
        clone.position.set(pos.x, baseTopY, pos.z);
        clone.updateMatrixWorld(true);
        const tileBox = new THREE.Box3().setFromObject(clone);
        baseTopY = tileBox.max.y;
      }

      const tint = TERRAIN_TINT[tile.terrain];
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (tint !== undefined && modelKey !== "building_tower") {
            child.material = (child.material as THREE.Material).clone();
            (child.material as THREE.MeshStandardMaterial).color.set(tint);
          }
        }
      });

      this.group.add(clone);
      models.push(clone);
    }

    if (tile.terrain === "ditch") {
      const ditchOverlay = this.createDitchOverlay(pos, tile.orientation ?? 0, tile.fortifiedSides ?? 4);
      this.group.add(ditchOverlay);
      models.push(ditchOverlay as unknown as THREE.Group);

      const ditchModels = this.createDitchFortifications(tile, pos);
      for (const m of ditchModels) {
        this.group.add(m);
        models.push(m);
      }
    }

    if (tile.terrain === "marsh") {
      const marshMesh = this.createMarshOverlay(pos);
      this.group.add(marshMesh);
      models.push(marshMesh as unknown as THREE.Group);
    }

    if (models.length > 0) {
      this.terrainModels.set(key, models);
    }
  }

  private createHexTile(tile: HexTile, board: BoardState) {
    const pos = hexToWorld(tile.coord);
    const key = coordToKey(tile.coord);
    const modelKeys = TERRAIN_MODEL_MAP[tile.terrain];
    const hasModel =
      this.modelScaleComputed &&
      modelKeys &&
      this.assetLoader &&
      keepTerrainModel(tile.terrain);

    // Create hex mesh textured with the board mat image
    const hexMesh = this.createHexMesh(tile, pos);
    this.group.add(hexMesh);
    this.hexMeshes.set(key, hexMesh);

    // Coordinate label sprite
    const label = this.createCoordSprite(
      `${tile.coord.col},${tile.coord.row}`,
      pos,
    );
    this.coordLabelsGroup.add(label);

    // Place 3D model(s)
    if (hasModel && modelKeys) {
      const models: THREE.Group[] = [];
      let baseTopY = 0;

      for (const modelKey of modelKeys) {
        const clone = this.assetLoader!.getModel(modelKey);
        if (!clone) continue;

        if (modelKey === "building_tower") {
          // Custom tower model: auto-scale to fit hex cell
          const box = new THREE.Box3().setFromObject(clone);
          const size = box.getSize(new THREE.Vector3());
          const maxHoriz = Math.max(size.x, size.z);
          const targetWidth = Math.sqrt(3) * HEX_SIZE * 0.9;
          const scale = maxHoriz > 0 ? targetWidth / maxHoriz : 1;
          clone.scale.setScalar(scale);

          // Center on hex and sit on stone base
          const scaledBox = new THREE.Box3().setFromObject(clone);
          const center = scaledBox.getCenter(new THREE.Vector3());
          clone.position.set(
            pos.x - center.x + pos.x,
            baseTopY - scaledBox.min.y,
            pos.z - center.z + pos.z,
          );
          // Re-measure to get correct position
          clone.position.set(pos.x, baseTopY, pos.z);
          clone.updateMatrixWorld(true);
          const finalBox = new THREE.Box3().setFromObject(clone);
          const finalCenter = finalBox.getCenter(new THREE.Vector3());
          clone.position.x += pos.x - finalCenter.x;
          clone.position.z += pos.z - finalCenter.z;
          clone.position.y += baseTopY - finalBox.min.y;
        } else {
          clone.scale.setScalar(this.modelScale);
          clone.position.set(pos.x, baseTopY, pos.z);

          // After placing the base tile, measure its top for stacking props
          clone.updateMatrixWorld(true);
          const tileBox = new THREE.Box3().setFromObject(clone);
          baseTopY = tileBox.max.y;
        }

        const tint = TERRAIN_TINT[tile.terrain];
        clone.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (tint !== undefined && modelKey !== "building_tower") {
              child.material = (child.material as THREE.Material).clone();
              (child.material as THREE.MeshStandardMaterial).color.set(tint);
            }
          }
        });

        this.group.add(clone);
        models.push(clone);
      }
      // Stack road path overlay on top of the grass base
      const overlay = getRoadOverlay(tile, board);
      if (overlay && this.assetLoader) {
        const pathClone = this.assetLoader.getModel(overlay.model);
        if (pathClone) {
          pathClone.scale.setScalar(this.modelScale);
          pathClone.position.set(pos.x, baseTopY, pos.z);
          pathClone.rotation.y = overlay.rotationY;

          pathClone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.group.add(pathClone);
          models.push(pathClone);
        }
      }

      // Place ditch overlay + fortification stakes
      if (tile.terrain === "ditch") {
        const ditchOverlay = this.createDitchOverlay(pos, tile.orientation ?? 0, tile.fortifiedSides ?? 4);
        this.group.add(ditchOverlay);
        models.push(ditchOverlay as unknown as THREE.Group);

        const ditchModels = this.createDitchFortifications(tile, pos);
        for (const m of ditchModels) {
          this.group.add(m);
          models.push(m);
        }
      }

      // Place marsh overlay — textured hex sitting on top of the base tile
      if (tile.terrain === "marsh") {
        const marshMesh = this.createMarshOverlay(pos);
        this.group.add(marshMesh);
        models.push(marshMesh as unknown as THREE.Group);
      }

      if (models.length > 0) {
        this.terrainModels.set(key, models);
      }
    }
  }

  /**
   * Create a marsh overlay — a flat textured hex placed on top of the base board tile.
   * Uses the marsh artwork from /assets/terrain/hex-tiles/marsh_tile.png.
   */
  private createMarshOverlay(pos: { x: number; z: number }): THREE.Mesh {
    const sqrt3 = Math.sqrt(3);
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = HEX_SIZE * Math.cos(angle);
      const y = HEX_SIZE * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: false,
    });

    // UV-map to fill the hex with the full texture
    const halfW = (sqrt3 * HEX_SIZE) / 2;
    const halfH = HEX_SIZE;
    const uv = geometry.attributes.uv;
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      const u = (lx + halfW) / (2 * halfW);
      const v = (ly + halfH) / (2 * halfH);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;

    const texture = this.textureLoader.load(
      "/assets/terrain/hex-tiles/marsh_tile.png",
    );
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.85,
      metalness: 0.05,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    // Sit slightly above the base tile to avoid z-fighting
    mesh.position.set(pos.x, this.tileTopY + 0.02, pos.z);
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Create a ditch overlay — a flat textured hex placed on top of the base board tile.
   * Picks the correct artwork based on fortifiedSides: 4→ditch_1, 2→ditch_2, 3→ditch_3.
   * Rotates to match the tile orientation (0-5, each step is 60°).
   */
  private createDitchOverlay(pos: { x: number; z: number }, orientation: number, fortifiedSides: number = 4): THREE.Mesh {
    const sqrt3 = Math.sqrt(3);
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = HEX_SIZE * Math.cos(angle);
      const y = HEX_SIZE * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: false,
    });

    const halfW = (sqrt3 * HEX_SIZE) / 2;
    const halfH = HEX_SIZE;
    const uv = geometry.attributes.uv;
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      const u = (lx + halfW) / (2 * halfW);
      const v = (ly + halfH) / (2 * halfH);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;

    // Pick texture based on fortified sides: 4→ditch_1, 2→ditch_2, 3→ditch_3
    const ditchTextureMap: Record<number, string> = { 4: 'ditch_1', 2: 'ditch_2', 3: 'ditch_3' };
    const textureName = ditchTextureMap[fortifiedSides] ?? 'ditch_1';
    const texture = this.textureLoader.load(
      `/assets/terrain/hex-tiles/${textureName}.png`,
    );
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.85,
      metalness: 0.05,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    // ditch_1 artwork base corresponds to orientation 1; ditch_2/ditch_3 to orientation 0.
    const baseOrientation = fortifiedSides === 4 ? 1 : 0;
    mesh.rotation.z = Math.PI + (orientation - baseOrientation) * (Math.PI / 3);
    mesh.position.set(pos.x, this.tileTopY + 0.02, pos.z);
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Create procedural sharpened stake fortifications on the fortified edges of a ditch tile.
   * Orientation determines which consecutive sides are open (no stakes).
   * fortifiedSides determines how many sides have stakes (2, 3, or 4).
   */
  private createDitchFortifications(
    tile: HexTile,
    pos: { x: number; z: number },
  ): THREE.Group[] {
    const orientation = (tile.orientation ?? 0) % 6;
    const fortifiedSides = tile.fortifiedSides ?? 4;
    const openCount = 6 - fortifiedSides;
    const openDirs: number[] = [];
    for (let i = 0; i < openCount; i++) {
      openDirs.push((orientation + i) % 6);
    }

    const results: THREE.Group[] = [];
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.85,
      metalness: 0.0,
    });

    const tiltAngle = Math.PI / 4; // 45° outward lean

    for (let dir = 0; dir < 6; dir++) {
      if (openDirs.includes(dir)) continue;

      const group = new THREE.Group();

      // Edge midpoint angle in world space (dir 0=E, each 60° apart)
      const edgeAngle = (Math.PI / 3) * dir;
      const edgeDist = HEX_SIZE * 0.68;

      const cx = pos.x + Math.cos(edgeAngle) * edgeDist;
      const cz = pos.z - Math.sin(edgeAngle) * edgeDist;

      // Direction along the edge (perpendicular to outward direction)
      const alongAngle = edgeAngle + Math.PI / 2;
      const edgeHalfLen = HEX_SIZE * 0.42;

      // Fence rotation: the rail should run along the edge
      const fenceRotY = alongAngle;

      // 12 stakes evenly spaced along the edge, leaning outward with sharpened tips
      const postCount = 12;
      const shaftHeight = 0.22;
      const tipHeight = 0.08;
      const shaftGeo = new THREE.BoxGeometry(0.03, shaftHeight, 0.03);
      const tipGeo = new THREE.ConeGeometry(0.025, tipHeight, 4);

      for (let i = 0; i < postCount; i++) {
        const t = (i / (postCount - 1) - 0.5) * 2 * edgeHalfLen;
        const px = cx + Math.cos(alongAngle) * t;
        const pz = cz - Math.sin(alongAngle) * t;

        // Stake pivot group at the base (raised above ditch overlay)
        const stakeGroup = new THREE.Group();
        stakeGroup.position.set(px, this.tileTopY + 0.07, pz);

        // Tilt outward using axis-angle rotation around the edge-along axis
        const alongEdge = new THREE.Vector3(
          Math.sin(edgeAngle),
          0,
          Math.cos(edgeAngle),
        );
        stakeGroup.quaternion.setFromAxisAngle(alongEdge, -tiltAngle);

        // Shaft (box)
        const shaft = new THREE.Mesh(shaftGeo, woodMat);
        shaft.position.set(0, shaftHeight / 2, 0);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        stakeGroup.add(shaft);

        // Sharpened tip (cone)
        const tip = new THREE.Mesh(tipGeo, woodMat);
        tip.position.set(0, shaftHeight + tipHeight / 2, 0);
        tip.castShadow = true;
        stakeGroup.add(tip);

        group.add(stakeGroup);
      }

      // Two horizontal rails
      const railLen = edgeHalfLen * 2;
      const railGeo = new THREE.BoxGeometry(railLen, 0.025, 0.025);

      for (const railY of [0.03, 0.1]) {
        const rail = new THREE.Mesh(railGeo, woodMat);
        rail.position.set(cx, this.tileTopY + 0.07 + railY, cz);
        rail.rotation.y = fenceRotY;
        rail.castShadow = true;
        rail.receiveShadow = true;
        group.add(rail);
      }

      results.push(group);
    }

    return results;
  }

  /** Place hedge meshes on all hedge edges */
  private placeHedges(board: BoardState) {
    for (const key of board.hedges) {
      const [aStr, bStr] = key.split("|");
      const a = keyToCoord(aStr);
      const b = keyToCoord(bStr);
      const hedgeGroup = this.createHedgeOnEdge(a, b);
      this.group.add(hedgeGroup);
      this.hedgeModels.set(key, hedgeGroup);
    }
  }

  /**
   * Create a green hedge mesh on the edge between two adjacent hexes.
   * The hedge is a row of bushy green shapes along the shared edge.
   */
  private createHedgeOnEdge(
    a: { col: number; row: number },
    b: { col: number; row: number },
  ): THREE.Group {
    const posA = hexToWorld(a);
    const posB = hexToWorld(b);

    // Edge midpoint
    const mx = (posA.x + posB.x) / 2;
    const mz = (posA.z + posB.z) / 2;

    // Direction along the edge (perpendicular to line between hex centers)
    const dx = posB.x - posA.x;
    const dz = posB.z - posA.z;
    // Perpendicular: rotate 90°
    const px = -dz;
    const pz = dx;
    const pLen = Math.sqrt(px * px + pz * pz);
    const nx = px / pLen;
    const nz = pz / pLen;

    const group = new THREE.Group();

    const hedgeMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a1e,
      roughness: 0.9,
      metalness: 0.0,
    });

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3520,
      roughness: 0.9,
      metalness: 0.0,
    });

    const edgeHalfLen = HEX_SIZE * 0.48;
    const bushCount = 9;
    const bushHeight = 0.2;
    const bushWidth = 0.15;
    const bushDepth = 0.1;

    for (let i = 0; i < bushCount; i++) {
      const t = (i / (bushCount - 1) - 0.5) * 2 * edgeHalfLen;
      const bx = mx + nx * t;
      const bz = mz + nz * t;

      // Bush body (slightly randomized scale for organic look)
      const scaleVar = 0.85 + (i % 3) * 0.1;
      const bushGeo = new THREE.SphereGeometry(
        bushWidth * 0.5 * scaleVar,
        6,
        5,
      );
      const bush = new THREE.Mesh(bushGeo, hedgeMat);
      bush.position.set(bx, this.tileTopY + bushHeight * 0.5, bz);
      bush.scale.set(
        1,
        bushHeight / (bushWidth * scaleVar),
        bushDepth / (bushWidth * scaleVar),
      );
      bush.castShadow = true;
      bush.receiveShadow = true;
      group.add(bush);

      // Small upper crown on alternating bushes for variation
      if (i % 2 === 0) {
        const crownGeo = new THREE.SphereGeometry(bushWidth * 0.35, 5, 4);
        const crown = new THREE.Mesh(crownGeo, hedgeMat);
        crown.position.set(bx, this.tileTopY + bushHeight * 0.85, bz);
        crown.scale.set(1, 0.8, bushDepth / (bushWidth * 0.7));
        crown.castShadow = true;
        group.add(crown);
      }
    }

    // Horizontal trunk/branch running along the hedge base
    const trunkLen = edgeHalfLen * 2;
    const trunkGeo = new THREE.BoxGeometry(trunkLen, 0.085, 0.085);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(mx, this.tileTopY + 0.02, mz);
    // Rotate trunk to align with edge direction
    trunk.rotation.y = Math.atan2(-nz, nx);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    return group;
  }

  /** Scatter small decorations (flowers, grass, bushes) on eligible tiles */
  private placeScatterDecorations(board: BoardState) {
    if (!this.assetLoader || !this.modelScaleComputed) return;

    const available = SCATTER_DECORATIONS.filter((d) =>
      this.assetLoader!.hasModel(d.model),
    );
    if (available.length === 0) return;

    const availableWeight = available.reduce((s, d) => s + d.weight, 0);
    const rng = mulberry32(42);
    const decoScale = this.modelScale * 0.18;
    const placementRadius = HEX_SIZE * 0.35;

    for (const [, tile] of board.tiles) {
      if (!canScatter(tile.terrain)) continue;

      // ~80% chance per plain tile to get decorations
      if (rng() > 0.8) continue;

      const count = 3 + Math.floor(rng() * 4); // 3-6 per tile
      const pos = hexToWorld(tile.coord);

      for (let i = 0; i < count; i++) {
        // Weighted random pick
        let roll = rng() * availableWeight;
        let picked = available[0];
        for (const d of available) {
          roll -= d.weight;
          if (roll <= 0) {
            picked = d;
            break;
          }
        }

        const clone = this.assetLoader!.getModel(picked.model);
        if (!clone) continue;

        const angle = rng() * Math.PI * 2;
        const radius = rng() * placementRadius;
        const ox = Math.cos(angle) * radius;
        const oz = Math.sin(angle) * radius;

        clone.scale.setScalar(decoScale);
        clone.position.set(pos.x + ox, this.tileTopY, pos.z + oz);
        clone.rotation.y = rng() * Math.PI * 2;

        clone.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Nature pack colors wash out under ACES tone mapping —
            // boost saturation and darken so they read on the board
            const mats = Array.isArray(child.material)
              ? child.material
              : [child.material];
            for (let mi = 0; mi < mats.length; mi++) {
              const mat = mats[mi];
              if (mat instanceof THREE.MeshStandardMaterial) {
                const cloned = mat.clone();
                const hsl = { h: 0, s: 0, l: 0 };
                cloned.color.getHSL(hsl);
                cloned.color.setHSL(
                  hsl.h,
                  Math.min(hsl.s * 2.5, 1.0),
                  hsl.l * 0.35,
                );
                cloned.metalness = 0;
                cloned.roughness = 0.85;
                if (Array.isArray(child.material)) {
                  child.material[mi] = cloned;
                } else {
                  child.material = cloned;
                }
              }
            }
          }
        });

        this.scatterGroup.add(clone);
      }
    }

    // Marsh tiles: dense grass/bush scatter sitting in the lower water basin
    const marshAvailable = MARSH_SCATTER.filter((d) =>
      this.assetLoader!.hasModel(d.model),
    );
    if (marshAvailable.length > 0) {
      const marshWeight = marshAvailable.reduce((s, d) => s + d.weight, 0);
      const marshDecoScale = this.modelScale * 0.28;
      const marshRadius = HEX_SIZE * 0.85;

      for (const [, tile] of board.tiles) {
        if (tile.terrain !== "marsh") continue;

        const count = 72 + Math.floor(rng() * 32); // 72-103 per marsh tile
        const pos = hexToWorld(tile.coord);

        for (let i = 0; i < count; i++) {
          let roll = rng() * marshWeight;
          let picked = marshAvailable[0];
          for (const d of marshAvailable) {
            roll -= d.weight;
            if (roll <= 0) {
              picked = d;
              break;
            }
          }

          const clone = this.assetLoader!.getModel(picked.model);
          if (!clone) continue;

          const angle = rng() * Math.PI * 2;
          const radius = rng() * marshRadius;
          const ox = Math.cos(angle) * radius;
          const oz = Math.sin(angle) * radius;

          clone.scale.setScalar(marshDecoScale);
          clone.position.set(pos.x + ox, this.tileTopY * 0.3, pos.z + oz);
          clone.rotation.y = rng() * Math.PI * 2;

          clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];
              for (let mi = 0; mi < mats.length; mi++) {
                const mat = mats[mi];
                if (mat instanceof THREE.MeshStandardMaterial) {
                  const cloned = mat.clone();
                  const hsl = { h: 0, s: 0, l: 0 };
                  cloned.color.getHSL(hsl);
                  cloned.color.setHSL(
                    hsl.h,
                    Math.min(hsl.s * 2.0, 1.0),
                    hsl.l * 0.25,
                  );
                  cloned.metalness = 0;
                  cloned.roughness = 0.9;
                  if (Array.isArray(child.material)) {
                    child.material[mi] = cloned;
                  } else {
                    child.material = cloned;
                  }
                }
              }
            }
          });

          this.scatterGroup.add(clone);
        }
      }
    }
  }

  /** Load (or return cached) hex tile texture for a given coordinate */
  private getHexTileTexture(col: number, row: number): THREE.Texture {
    const key = `${col}_${row}`;
    let tex = this.hexTileTextures.get(key);
    if (!tex) {
      tex = this.textureLoader.load(
        `/assets/terrain/hex-tiles/hex_${col}_${row}.png`,
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      this.hexTileTextures.set(key, tex);
    }
    return tex;
  }

  private createHexMesh(
    tile: HexTile,
    pos: { x: number; z: number },
  ): THREE.Mesh {
    const sqrt3 = Math.sqrt(3);
    // Hex shape (pointy-top: offset by 30°) — full size, no 0.95 shrink
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = HEX_SIZE * Math.cos(angle);
      const y = HEX_SIZE * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      bevelEnabled: false,
    });

    // UV-map: tile image is a bounding rect around the hex.
    // Image dimensions: width = sqrt3 * HEX_SIZE, height = 2 * HEX_SIZE
    // Local vertex (0,0) = hex center → UV (0.5, 0.5)
    const halfW = (sqrt3 * HEX_SIZE) / 2;
    const halfH = HEX_SIZE;
    const uv = geometry.attributes.uv;
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      const u = (lx + halfW) / (2 * halfW);
      const v = (ly + halfH) / (2 * halfH);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;

    const texture = this.getHexTileTexture(tile.coord.col, tile.coord.row);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.85,
      metalness: 0.05,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, this.tileTopY, pos.z);
    mesh.receiveShadow = true;

    // Store tile data for raycasting
    mesh.userData = { hexCoord: tile.coord, terrain: tile.terrain };

    return mesh;
  }

  /** Get the Three.js mesh for a hex coordinate */
  getHexMesh(col: number, row: number): THREE.Mesh | undefined {
    return this.hexMeshes.get(coordToKey({ col, row }));
  }

  /** Get all hex meshes for raycasting */
  getHexMeshes(): THREE.Mesh[] {
    return [...this.hexMeshes.values()];
  }

  /** Show or hide coordinate labels on each tile */
  setShowCoords(visible: boolean) {
    this.coordLabelsGroup.visible = visible;
  }

  /** Create a text sprite for a coordinate label */
  private createCoordSprite(
    text: string,
    pos: { x: number; z: number },
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 56, 8);
    ctx.fill();

    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(pos.x, this.tileTopY + 0.8, pos.z);
    sprite.scale.set(0.7, 0.35, 1);
    return sprite;
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  private clear() {
    // Dispose scatter decorations
    while (this.scatterGroup.children.length > 0) {
      const child = this.scatterGroup.children[0];
      this.scatterGroup.remove(child);
      if (child instanceof THREE.Group) {
        this.disposeGroup(child);
      }
    }

    // Dispose coord labels
    while (this.coordLabelsGroup.children.length > 0) {
      const sprite = this.coordLabelsGroup.children[0] as THREE.Sprite;
      this.coordLabelsGroup.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }

    // Dispose terrain models
    for (const models of this.terrainModels.values()) {
      for (const model of models) {
        this.group.remove(model);
        this.disposeGroup(model);
      }
    }
    this.terrainModels.clear();

    // Dispose hedge models
    for (const model of this.hedgeModels.values()) {
      this.group.remove(model);
      this.disposeGroup(model);
    }
    this.hedgeModels.clear();

    // Dispose hex meshes and their tile textures
    for (const mesh of this.hexMeshes.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.hexMeshes.clear();
    for (const tex of this.hexTileTextures.values()) {
      tex.dispose();
    }
    this.hexTileTextures.clear();

    // Remove any remaining children
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.scene.remove(this.coordLabelsGroup);
    this.scene.remove(this.scatterGroup);
  }
}
