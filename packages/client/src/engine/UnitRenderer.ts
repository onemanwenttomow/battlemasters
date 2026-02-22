import * as THREE from 'three';
import { Unit, Faction, UnitType, coordToKey } from '@battle-masters/game-logic';
import { getUnitDefinition } from '@battle-masters/game-logic';
import { hexToWorld } from '@battle-masters/game-logic';

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
  standee: THREE.Mesh;
  base: THREE.Mesh;
  unitId: string;
  targetX: number;
  targetZ: number;
}

export class UnitRenderer {
  private unitMeshes: Map<string, UnitMeshGroup> = new Map();
  private parentGroup: THREE.Group;
  private clock = new THREE.Clock();
  /** Y offset applied to unit groups so the base cylinder rests on the tile surface.
   *  The base cylinder center is at local y=0.2, height=0.1, so bottom = local y=0.15.
   *  We set group.y = tileTopY - 0.15 so the base sits flush on the tile. */
  private baseHeight = 0;

  constructor(private scene: THREE.Scene) {
    this.parentGroup = new THREE.Group();
    this.scene.add(this.parentGroup);
  }

  /** Set the Y height of the tile surface so unit bases rest on top */
  setBaseHeight(tileTopY: number) {
    // Base cylinder bottom is at local y=0.175 within the group (center 0.25, half-height 0.075)
    this.baseHeight = tileTopY - 0.175;
  }

  /** Sync rendered units with game state */
  syncUnits(units: Map<string, Unit>, selectedUnitId: string | null) {
    const currentIds = new Set(units.keys());

    // Remove units no longer in state
    for (const [id, meshGroup] of this.unitMeshes) {
      if (!currentIds.has(id)) {
        this.removeUnitMesh(id);
      }
    }

    // Add/update units
    for (const [id, unit] of units) {
      if (!this.unitMeshes.has(id)) {
        this.createUnitMesh(unit);
      }
      this.updateUnitMesh(unit, id === selectedUnitId);
    }
  }

  private createUnitMesh(unit: Unit) {
    const def = getUnitDefinition(unit.definitionType);
    const group = new THREE.Group();

    // Base cylinder (faction-colored)
    const baseGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.15, 16);
    const baseMat = new THREE.MeshStandardMaterial({
      color: FACTION_COLORS[unit.faction],
      roughness: 0.6,
      metalness: 0.3,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);

    // Standee card (canvas-generated placeholder)
    const texture = this.createPlaceholderTexture(unit, def.name);
    const standeeMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.0,
    });
    const standeeGeo = new THREE.PlaneGeometry(0.7, 1.05);
    const standee = new THREE.Mesh(standeeGeo, standeeMat);
    standee.position.y = 0.85;
    standee.castShadow = true;
    group.add(standee);

    // Store userData for raycasting
    group.userData = { unitId: unit.id, faction: unit.faction };
    base.userData = { unitId: unit.id };
    standee.userData = { unitId: unit.id };

    const pos = hexToWorld(unit.position);
    group.position.set(pos.x, this.baseHeight, pos.z);

    this.parentGroup.add(group);
    this.unitMeshes.set(unit.id, { group, standee, base, unitId: unit.id, targetX: pos.x, targetZ: pos.z });
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

    // Icon
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(UNIT_ICONS[unit.definitionType] || '?', 64, 70);

    // Name
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 64, 110);

    // HP pips
    const pipSize = 8;
    const pipSpacing = 12;
    const startX = 64 - ((unit.maxHp - 1) * pipSpacing) / 2;
    for (let i = 0; i < unit.maxHp; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * pipSpacing, 145, pipSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = i < unit.hp ? '#44ff44' : '#333333';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Stats
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#cccccc';
    const def = getUnitDefinition(unit.definitionType);
    ctx.fillText(`CV:${def.combatValue} MOV:${def.movement} RNG:${def.range}`, 64, 175);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private updateUnitMesh(unit: Unit, isSelected: boolean) {
    const meshGroup = this.unitMeshes.get(unit.id);
    if (!meshGroup) return;

    const pos = hexToWorld(unit.position);
    meshGroup.targetX = pos.x;
    meshGroup.targetZ = pos.z;

    // Selection highlight — bob animation + emissive
    const baseMat = meshGroup.base.material as THREE.MeshStandardMaterial;
    if (isSelected) {
      baseMat.emissive.setHex(0xffcc00);
      baseMat.emissiveIntensity = 0.5;
      const bobOffset = Math.sin(Date.now() * 0.005) * 0.05;
      meshGroup.group.position.y = this.baseHeight + bobOffset;
    } else {
      baseMat.emissive.setHex(0x000000);
      baseMat.emissiveIntensity = 0;
      meshGroup.group.position.y = this.baseHeight;
    }
  }

  /** Animate units sliding toward their target positions */
  update(dt: number) {
    const speed = 6; // units per second
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

    this.parentGroup.remove(meshGroup.group);
    meshGroup.standee.geometry.dispose();
    (meshGroup.standee.material as THREE.Material).dispose();
    meshGroup.base.geometry.dispose();
    (meshGroup.base.material as THREE.Material).dispose();
    this.unitMeshes.delete(id);
  }

  /** Billboard all standees toward camera */
  updateBillboards(camera: THREE.Camera) {
    for (const [, meshGroup] of this.unitMeshes) {
      // Y-axis only billboard
      const camPos = camera.position.clone();
      camPos.y = meshGroup.standee.position.y + meshGroup.group.position.y;
      const worldPos = new THREE.Vector3();
      meshGroup.standee.getWorldPosition(worldPos);
      camPos.y = worldPos.y;
      meshGroup.standee.lookAt(camPos);
    }
  }

  /** Get all meshes for raycasting (bases + standees) */
  getUnitMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const [, mg] of this.unitMeshes) {
      meshes.push(mg.base, mg.standee);
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
