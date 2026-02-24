import * as THREE from 'three';
import { Unit, Faction, UnitType } from '@battle-masters/game-logic';
import { getUnitDefinition } from '@battle-masters/game-logic';
import { hexToWorld } from '@battle-masters/game-logic';
import { AssetLoader } from './AssetLoader';

const FACTION_COLORS: Record<Faction, number> = {
  imperial: 0x3366aa,
  chaos: 0xaa3333,
};

const UNIT_ICONS: Record<UnitType, string> = {
  men_at_arms: '⚔',
  archer: '🏹',
  crossbowman: '🎯',
  imperial_knights: '🐴',
  lord_knights: '👑',
  mighty_cannon: '💣',
  goblin: '🗡',
  beastman: '🐂',
  chaos_bowman: '🏹',
  orc: '⚔',
  chaos_warrior: '🛡',
  wolf_rider: '🐺',
  champions_of_chaos: '👑',
  ogre_champion: '👹',
};

interface UnitMeshGroup {
  group: THREE.Group;
  standee: THREE.Mesh | null;
  model: THREE.Group | null;
  base: THREE.Mesh;
  unitId: string;
  targetX: number;
  targetZ: number;
  skullTokens: THREE.Mesh[];
  currentSkullCount: number;
}

// Shared skull texture (created once, reused)
let sharedSkullTexture: THREE.CanvasTexture | null = null;

function getSkullTexture(): THREE.CanvasTexture {
  if (sharedSkullTexture) return sharedSkullTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  // Dark red background circle
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60, 10, 10, 0.85)';
  ctx.fill();
  ctx.strokeStyle = '#880000';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Skull emoji
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('💀', 32, 34);
  sharedSkullTexture = new THREE.CanvasTexture(canvas);
  sharedSkullTexture.needsUpdate = true;
  return sharedSkullTexture;
}

export class UnitRenderer {
  private unitMeshes: Map<string, UnitMeshGroup> = new Map();
  private parentGroup: THREE.Group;
  private baseHeight = 0;
  private assetLoader: AssetLoader | null = null;

  constructor(private scene: THREE.Scene, assetLoader?: AssetLoader) {
    this.parentGroup = new THREE.Group();
    this.scene.add(this.parentGroup);
    this.assetLoader = assetLoader ?? null;
  }

  setBaseHeight(tileTopY: number) {
    this.baseHeight = tileTopY - 0.175;
  }

  /** Sync rendered units with game state.
   *  deferDamageForId: if set, skull tokens for this unit won't update (used during dice roll display) */
  syncUnits(units: Map<string, Unit>, selectedUnitId: string | null, preserveIds?: Set<string>, deferDamageForId?: string | null) {
    const currentIds = new Set(units.keys());

    // Remove units no longer in state (unless preserved for pending effects)
    for (const [id] of this.unitMeshes) {
      if (!currentIds.has(id) && !preserveIds?.has(id)) {
        this.removeUnitMesh(id);
      }
    }

    // Add/update units
    for (const [id, unit] of units) {
      if (!this.unitMeshes.has(id)) {
        this.createUnitMesh(unit);
      }
      this.updateUnitMesh(unit, id === selectedUnitId);

      // Sync skull tokens (defer if this unit's damage display is suppressed)
      if (deferDamageForId !== id) {
        this.syncSkullTokens(unit);
      }
    }
  }

  private createUnitMesh(unit: Unit) {
    const def = getUnitDefinition(unit.definitionType);
    const group = new THREE.Group();

    // Base cylinder (faction-colored)
    const baseGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.15, 16);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.3,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);

    let standee: THREE.Mesh | null = null;
    let model: THREE.Group | null = null;

    // Try to load 3D model
    const unitModel = this.assetLoader?.getModel(`unit_${unit.definitionType}`);
    if (unitModel) {
      model = unitModel;

      // Auto-scale model to fit within the hex cell
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleOverrides: Partial<Record<UnitType, number>> = {
        ogre_champion: 1.5,
        imperial_knights: 1.5,
        lord_knights: 1.5,
        champions_of_chaos: 1.5,
        mighty_cannon: 1.2,
      };
      const targetSize = 0.8 * (scaleOverrides[unit.definitionType] ?? 1.0);
      if (maxDim > 0) {
        const scale = targetSize / maxDim;
        model.scale.setScalar(scale);
      }

      // Re-center horizontally and sit on the base
      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const min = box.min;
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= min.y;
      model.position.y += 0.33;

      // Enable shadows on all meshes in the model
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Tag for raycasting
          child.userData = { unitId: unit.id };
        }
      });
      // Per-unit rotation overrides (radians, applied before faction flip)
      const rotationOverrides: Partial<Record<UnitType, number>> = {
        mighty_cannon: Math.PI,
        imperial_knights: Math.PI / 2,
        lord_knights: Math.PI / 2,
        men_at_arms: Math.PI / 2,
        goblin: Math.PI / 2,
        beastman: Math.PI / 2,
        orc: Math.PI / 2,
        chaos_warrior: Math.PI / 2,
        wolf_rider: Math.PI / 2,
        champions_of_chaos: Math.PI / 2,
        ogre_champion: Math.PI / 2,
      };
      const baseRotation = rotationOverrides[unit.definitionType] ?? 0;
      // Face chaos units toward imperial side (rotate 180°)
      model.rotation.y = baseRotation + (unit.faction === 'chaos' ? Math.PI : 0);
      group.add(model);
    } else {
      // Fallback: standee card
      const texture = this.createPlaceholderTexture(unit, def.name);
      const standeeMat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.7,
        metalness: 0.0,
      });
      const standeeGeo = new THREE.PlaneGeometry(0.7, 1.05);
      standee = new THREE.Mesh(standeeGeo, standeeMat);
      standee.position.y = 0.85;
      standee.castShadow = true;
      standee.userData = { unitId: unit.id };
      group.add(standee);
    }

    // Store userData for raycasting
    group.userData = { unitId: unit.id, faction: unit.faction };
    base.userData = { unitId: unit.id };

    const pos = hexToWorld(unit.position);
    group.position.set(pos.x, this.baseHeight, pos.z);

    this.parentGroup.add(group);
    this.unitMeshes.set(unit.id, {
      group, standee, model, base, unitId: unit.id,
      targetX: pos.x, targetZ: pos.z,
      skullTokens: [], currentSkullCount: 0,
    });
  }

  private createPlaceholderTexture(unit: Unit, name: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    // Background
    const bgColor = unit.faction === 'imperial' ? '#2244aa' : '#aa2222';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 192);

    // Border
    ctx.strokeStyle = unit.faction === 'imperial' ? '#4477dd' : '#dd4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 124, 188);

    // Icon (vertically centered)
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(UNIT_ICONS[unit.definitionType] || '?', 64, 76);

    // Name (below icon, centered)
    ctx.font = 'bold 14px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 64, 126);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private syncSkullTokens(unit: Unit) {
    const meshGroup = this.unitMeshes.get(unit.id);
    if (!meshGroup) return;

    const damageTaken = unit.maxHp - unit.hp;
    if (damageTaken === meshGroup.currentSkullCount) return;

    // Remove existing skull tokens
    for (const skull of meshGroup.skullTokens) {
      meshGroup.group.remove(skull);
      skull.geometry.dispose();
      (skull.material as THREE.Material).dispose();
    }
    meshGroup.skullTokens = [];
    meshGroup.currentSkullCount = damageTaken;

    if (damageTaken <= 0) return;

    // Create skull token meshes in a semicircle around the front of the base
    const radius = 0.38;
    const skullSize = 0.18;
    const skullY = 0.42;
    const texture = getSkullTexture();

    // Spread skulls in an arc from -60° to +60° (front-facing)
    const arcStart = -Math.PI / 3;
    const arcEnd = Math.PI / 3;

    for (let i = 0; i < damageTaken; i++) {
      const angle = damageTaken === 1
        ? 0
        : arcStart + (arcEnd - arcStart) * (i / (damageTaken - 1));

      const geo = new THREE.PlaneGeometry(skullSize, skullSize);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.0,
      });
      const skull = new THREE.Mesh(geo, mat);
      skull.position.set(
        Math.sin(angle) * radius,
        skullY,
        Math.cos(angle) * radius,
      );
      meshGroup.group.add(skull);
      meshGroup.skullTokens.push(skull);
    }
  }

  private updateUnitMesh(unit: Unit, isSelected: boolean) {
    const meshGroup = this.unitMeshes.get(unit.id);
    if (!meshGroup) return;

    const pos = hexToWorld(unit.position);
    meshGroup.targetX = pos.x;
    meshGroup.targetZ = pos.z;

    // Clear any leftover emissive from previous selection
    const baseMat = meshGroup.base.material as THREE.MeshStandardMaterial;
    baseMat.emissive.setHex(0x000000);
    baseMat.emissiveIntensity = 0;
    meshGroup.group.position.y = this.baseHeight;
  }

  /** Animate units sliding toward their target positions */
  update(dt: number) {
    const speed = 6;
    for (const [, mg] of this.unitMeshes) {
      const dx = mg.targetX - mg.group.position.x;
      const dz = mg.targetZ - mg.group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.01) {
        mg.group.position.x = mg.targetX;
        mg.group.position.z = mg.targetZ;
      } else {
        const step = Math.min(speed * dt, dist);
        mg.group.position.x += (dx / dist) * step;
        mg.group.position.z += (dz / dist) * step;
      }
    }
  }

  private removeUnitMesh(id: string) {
    const meshGroup = this.unitMeshes.get(id);
    if (!meshGroup) return;

    // Dispose skull tokens
    for (const skull of meshGroup.skullTokens) {
      skull.geometry.dispose();
      (skull.material as THREE.Material).dispose();
    }

    this.parentGroup.remove(meshGroup.group);
    if (meshGroup.standee) {
      meshGroup.standee.geometry.dispose();
      (meshGroup.standee.material as THREE.Material).dispose();
    }
    if (meshGroup.model) {
      meshGroup.model.traverse((child) => {
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
    meshGroup.base.geometry.dispose();
    (meshGroup.base.material as THREE.Material).dispose();
    this.unitMeshes.delete(id);
  }

  /** Billboard all standees toward camera */
  updateBillboards(camera: THREE.Camera) {
    for (const [, meshGroup] of this.unitMeshes) {
      // Only billboard standees (not 3D models)
      if (meshGroup.standee) {
        const camPos = camera.position.clone();
        camPos.y = meshGroup.standee.position.y + meshGroup.group.position.y;
        const worldPos = new THREE.Vector3();
        meshGroup.standee.getWorldPosition(worldPos);
        camPos.y = worldPos.y;
        meshGroup.standee.lookAt(camPos);
      }

      // Billboard skull tokens
      for (const skull of meshGroup.skullTokens) {
        const skullWorld = new THREE.Vector3();
        skull.getWorldPosition(skullWorld);
        const skullCamPos = camera.position.clone();
        skullCamPos.y = skullWorld.y;
        skull.lookAt(skullCamPos);
      }
    }
  }

  /** Get all meshes for raycasting (bases + standees + model children) */
  getUnitMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const [, mg] of this.unitMeshes) {
      meshes.push(mg.base);
      if (mg.standee) {
        meshes.push(mg.standee);
      }
      if (mg.model) {
        mg.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshes.push(child);
          }
        });
      }
    }
    return meshes;
  }

  dispose() {
    for (const [id] of this.unitMeshes) {
      this.removeUnitMesh(id);
    }
    this.scene.remove(this.parentGroup);
  }
}
