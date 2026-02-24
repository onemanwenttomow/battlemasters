import * as THREE from 'three';
import { HexCoord } from '@battle-masters/game-logic';
import { hexToWorld, HEX_SIZE } from '@battle-masters/game-logic';

type HighlightType = 'move' | 'attack' | 'selected' | 'activatable' | 'cannonRange' | 'cannonPath' | 'cannonPathPreview' | 'cannonTileFlying' | 'cannonTileBouncing' | 'cannonTileExplosion';

const HIGHLIGHT_COLORS: Record<HighlightType, number> = {
  move: 0x44aaff,
  attack: 0xff4444,
  selected: 0xffcc00,
  activatable: 0xffcc00,
  cannonRange: 0xff8844,
  cannonPath: 0xff6622,
  cannonPathPreview: 0xff8844,
  cannonTileFlying: 0x4488ff,
  cannonTileBouncing: 0xffaa44,
  cannonTileExplosion: 0xff2222,
};

export class Highlights {
  private group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private time = 0;

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.y = 0.16; // Default, updated by setHeight()
    this.scene.add(this.group);
  }

  /** Set Y position so highlights sit just above tile surfaces */
  setHeight(tileTopY: number) {
    this.group.position.y = tileTopY + 0.02;
  }

  /** Show movement highlights on given hexes */
  showMoveHighlights(hexes: HexCoord[]) {
    for (const hex of hexes) {
      this.addHighlight(hex, 'move');
    }
  }

  /** Show attack highlights on given hexes */
  showAttackHighlights(hexes: HexCoord[]) {
    for (const hex of hexes) {
      this.addHighlight(hex, 'attack');
    }
  }

  /** Show selected hex highlight */
  showSelectedHighlight(hex: HexCoord) {
    this.addHighlight(hex, 'selected');
  }

  /** Show highlights on hexes with units that can be activated */
  showActivatableHighlights(hexes: HexCoord[]) {
    for (const hex of hexes) {
      this.addHighlight(hex, 'activatable');
    }
  }

  private addHighlight(coord: HexCoord, type: HighlightType) {
    const pos = hexToWorld(coord);
    const shape = new THREE.Shape();

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = HEX_SIZE * 0.9 * Math.cos(angle);
      const y = HEX_SIZE * 0.9 * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    const baseOpacity = type === 'cannonPathPreview' ? 0.5 : 0.3;
    const material = new THREE.MeshBasicMaterial({
      color: HIGHLIGHT_COLORS[type],
      transparent: true,
      opacity: baseOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0, pos.z);
    mesh.userData = { hexCoord: coord, highlightType: type };

    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  /** Animate highlights (gentle pulse) */
  update(deltaTime: number) {
    this.time += deltaTime;
    for (const mesh of this.meshes) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const type = mesh.userData.highlightType as HighlightType;
      if (type === 'cannonPathPreview') {
        mat.opacity = 0.4 + Math.sin(this.time * 4) * 0.15;
      } else if (type === 'cannonPath') {
        mat.opacity = 0.1 + Math.sin(this.time * 3) * 0.05;
      } else {
        mat.opacity = 0.2 + Math.sin(this.time * 3) * 0.1;
      }
    }
  }

  /** Show cannon range highlights */
  showCannonRangeHighlights(hexes: HexCoord[]) {
    for (const hex of hexes) {
      this.addHighlight(hex, 'cannonRange');
    }
  }

  /** Show cannon path highlights */
  showCannonPathHighlights(hexes: HexCoord[]) {
    for (const hex of hexes) {
      this.addHighlight(hex, 'cannonPath');
    }
  }

  /** Show cannon path preview highlights (selected/hovered path) */
  showCannonPathPreviewHighlights(hexes: HexCoord[]) {
    for (const hex of hexes) {
      this.addHighlight(hex, 'cannonPathPreview');
    }
  }

  /** Show a cannon tile highlight with type-specific color */
  showCannonTileHighlight(hex: HexCoord, tileType: 'flying' | 'bouncing' | 'explosion') {
    const highlightMap: Record<string, HighlightType> = {
      flying: 'cannonTileFlying',
      bouncing: 'cannonTileBouncing',
      explosion: 'cannonTileExplosion',
    };
    this.addHighlight(hex, highlightMap[tileType]);
  }

  /** Remove all highlights */
  clear() {
    for (const mesh of this.meshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes = [];
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
