import * as THREE from 'three';
import { HexCoord } from '@battle-masters/game-logic';

export interface InputEvent {
  type: 'hex_click' | 'unit_click' | 'empty_click' | 'hex_right_click';
  hexCoord?: HexCoord;
  unitId?: string;
  worldPoint?: { x: number; z: number };
}

export interface HoverEvent {
  hexCoord: HexCoord | null;
  worldPoint: { x: number; z: number } | null;
}

export type InputCallback = (event: InputEvent) => void;
export type HoverCallback = (event: HoverEvent) => void;

export class InputHandler {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private callbacks: InputCallback[] = [];
  private hoverCallbacks: HoverCallback[] = [];
  private pointerDownPos = { x: 0, y: 0 };
  private readonly DRAG_THRESHOLD = 5; // pixels

  constructor(
    private camera: THREE.PerspectiveCamera,
    private domElement: HTMLElement,
    private hexMeshes: () => THREE.Mesh[],
    private unitMeshes: () => THREE.Object3D[]
  ) {
    domElement.addEventListener('pointerdown', this.onPointerDown);
    domElement.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('contextmenu', this.onContextMenu);
    domElement.addEventListener('pointermove', this.onPointerMove);
  }

  onInput(callback: InputCallback) {
    this.callbacks.push(callback);
  }

  onHover(callback: HoverCallback) {
    this.hoverCallbacks.push(callback);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return;

    // Check if this was a drag (not a click)
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > this.DRAG_THRESHOLD) return;

    // Convert to normalized device coordinates
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Check units first (higher priority)
    const unitHits = this.raycaster.intersectObjects(this.unitMeshes(), true);
    if (unitHits.length > 0) {
      const unitId = this.findUnitId(unitHits[0].object);
      if (unitId) {
        this.emit({ type: 'unit_click', unitId });
        return;
      }
    }

    // Check hex tiles
    const hexHits = this.raycaster.intersectObjects(this.hexMeshes());
    if (hexHits.length > 0) {
      const hexCoord = hexHits[0].object.userData.hexCoord as HexCoord | undefined;
      const point = hexHits[0].point;
      if (hexCoord) {
        this.emit({ type: 'hex_click', hexCoord, worldPoint: { x: point.x, z: point.z } });
        return;
      }
    }

    // Clicked empty space
    this.emit({ type: 'empty_click' });
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hexHits = this.raycaster.intersectObjects(this.hexMeshes());
    if (hexHits.length > 0) {
      const hexCoord = hexHits[0].object.userData.hexCoord as HexCoord | undefined;
      const point = hexHits[0].point;
      if (hexCoord) {
        this.emit({ type: 'hex_right_click', hexCoord, worldPoint: { x: point.x, z: point.z } });
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hexHits = this.raycaster.intersectObjects(this.hexMeshes());
    if (hexHits.length > 0) {
      const hexCoord = hexHits[0].object.userData.hexCoord as HexCoord | undefined;
      const point = hexHits[0].point;
      if (hexCoord) {
        this.emitHover({ hexCoord, worldPoint: { x: point.x, z: point.z } });
        return;
      }
    }
    this.emitHover({ hexCoord: null, worldPoint: null });
  };

  private findUnitId(obj: THREE.Object3D): string | undefined {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (current.userData.unitId) return current.userData.unitId;
      current = current.parent;
    }
    return undefined;
  }

  private emit(event: InputEvent) {
    for (const cb of this.callbacks) {
      cb(event);
    }
  }

  private emitHover(event: HoverEvent) {
    for (const cb of this.hoverCallbacks) {
      cb(event);
    }
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.callbacks = [];
    this.hoverCallbacks = [];
  }
}
