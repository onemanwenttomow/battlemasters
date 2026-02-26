import * as THREE from "three";
import {
  BoardState,
  HexTile,
  TerrainType,
  coordToKey,
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
  tower: ["stone", "building_tower"],
  forest: ["grass_forest"],
  hill: ["grass_hill"],
  marsh: ["water"],
  ditch: ["grass"],
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
  private scatterGroup: THREE.Group;
  private modelScale = 1;
  private modelScaleComputed = false;

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

    // Tile top Y = native model max Y * our scale factor
    this.tileTopY = box.max.y * this.modelScale;
  }

  /** Build hex tile meshes from board state */
  buildFromState(board: BoardState) {
    this.clear();

    for (const [, tile] of board.tiles) {
      this.createHexTile(tile, board);
    }

    this.placeScatterDecorations(board);
  }

  private createHexTile(tile: HexTile, board: BoardState) {
    const pos = hexToWorld(tile.coord);
    const key = coordToKey(tile.coord);
    const modelKeys = TERRAIN_MODEL_MAP[tile.terrain];
    const hasModel = this.modelScaleComputed && modelKeys && this.assetLoader;

    // Always create hex mesh for raycasting — hide it when a 3D model replaces it
    const hexMesh = this.createHexMesh(tile, pos);
    if (hasModel) {
      // Keep mesh raycastable but visually hidden (visible=false would skip raycasting)
      (hexMesh.material as THREE.MeshStandardMaterial).transparent = true;
      (hexMesh.material as THREE.MeshStandardMaterial).opacity = 0;
      (hexMesh.material as THREE.MeshStandardMaterial).depthWrite = false;
    }
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

      // Place ditch fortification stakes on fortified edges
      if (tile.terrain === "ditch") {
        const ditchModels = this.createDitchFortifications(tile, pos);
        for (const m of ditchModels) {
          this.group.add(m);
          models.push(m);
        }
      }

      if (models.length > 0) {
        this.terrainModels.set(key, models);
      }
    }
  }

  /**
   * Create procedural sharpened stake fortifications on the 5 fortified edges of a ditch tile.
   * Orientation determines which single side is open (no stakes).
   * Stakes lean outward at 45° with sharpened cone tips, connected by two horizontal rails.
   */
  private createDitchFortifications(
    tile: HexTile,
    pos: { x: number; z: number },
  ): THREE.Group[] {
    const orientation = tile.orientation ?? 0;
    const openDir = orientation % 6;

    const results: THREE.Group[] = [];
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.85,
      metalness: 0.0,
    });

    const tiltAngle = Math.PI / 4; // 45° outward lean

    for (let dir = 0; dir < 6; dir++) {
      if (dir === openDir) continue;

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

        // Stake pivot group at the base
        const stakeGroup = new THREE.Group();
        stakeGroup.position.set(px, this.tileTopY, pz);

        // Tilt outward using axis-angle rotation around the edge-along axis
        const alongEdge = new THREE.Vector3(Math.sin(edgeAngle), 0, Math.cos(edgeAngle));
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

      for (const railY of [0.03, 0.10]) {
        const rail = new THREE.Mesh(railGeo, woodMat);
        rail.position.set(cx, this.tileTopY + railY, cz);
        rail.rotation.y = fenceRotY;
        rail.castShadow = true;
        rail.receiveShadow = true;
        group.add(rail);
      }

      results.push(group);
    }

    return results;
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

  private createHexMesh(
    tile: HexTile,
    pos: { x: number; z: number },
  ): THREE.Mesh {
    const baseColor = TERRAIN_COLORS[tile.terrain];

    // Hex shape (pointy-top: offset by 30°)
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = HEX_SIZE * 0.95 * Math.cos(angle);
      const y = HEX_SIZE * 0.95 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: false,
    });

    // Slight random color variation
    const variation = (Math.random() - 0.5) * 0.03;
    const color = new THREE.Color(baseColor);
    color.r = Math.max(0, Math.min(1, color.r + variation));
    color.g = Math.max(0, Math.min(1, color.g + variation));
    color.b = Math.max(0, Math.min(1, color.b + variation));

    const material = new THREE.MeshStandardMaterial({
      color,
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

    // Dispose hex meshes
    for (const mesh of this.hexMeshes.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.hexMeshes.clear();

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
