import * as THREE from 'three';

export class CameraController {
  private target = new THREE.Vector3(10, 0, 9);
  private spherical = new THREE.Spherical(25, Math.PI / 4, Math.PI / 6);
  private isDragging = false;
  private isPanning = false;
  private lastPointer = { x: 0, y: 0 };
  private lastPinchDist = 0;
  private pointers: Map<number, { x: number; y: number }> = new Map();

  // Limits
  private minDistance = 8;
  private maxDistance = 45;
  private minPolar = 0.3; // Don't go too flat
  private maxPolar = Math.PI / 2.2; // Don't go below ground

  constructor(
    private camera: THREE.PerspectiveCamera,
    private domElement: HTMLElement
  ) {
    this.addListeners();
    this.updateCamera();
  }

  private addListeners() {
    const el = this.domElement;

    // Pointer events (unified mouse + touch)
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });

    // Prevent context menu on right-click
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1) {
      if (e.button === 2 || e.button === 1) {
        // Right/middle click → pan
        this.isPanning = true;
      } else {
        // Left click → orbit
        this.isDragging = true;
      }
      this.lastPointer = { x: e.clientX, y: e.clientY };
    } else if (this.pointers.size === 2) {
      // Two fingers → pan + pinch
      this.isDragging = false;
      this.isPanning = true;
      this.lastPinchDist = this.getPinchDistance();
      this.lastPointer = this.getPinchCenter();
    }

    this.domElement.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      // Pinch zoom
      const dist = this.getPinchDistance();
      const delta = dist - this.lastPinchDist;
      this.spherical.radius *= 1 - delta * 0.005;
      this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
      this.lastPinchDist = dist;

      // Two-finger pan
      const center = this.getPinchCenter();
      const dx = center.x - this.lastPointer.x;
      const dy = center.y - this.lastPointer.y;
      this.pan(dx, dy);
      this.lastPointer = center;
    } else if (this.isDragging) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.spherical.theta -= dx * 0.005;
      this.spherical.phi -= dy * 0.005;
      this.spherical.phi = Math.max(this.minPolar, Math.min(this.maxPolar, this.spherical.phi));
      this.lastPointer = { x: e.clientX, y: e.clientY };
    } else if (this.isPanning) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.pan(dx, dy);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    }

    if (this.isDragging || this.isPanning) {
      this.updateCamera();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.isDragging = false;
      this.isPanning = false;
    } else if (this.pointers.size === 1) {
      // Switch back to single-pointer mode
      const remaining = this.pointers.values().next().value!;
      this.lastPointer = { x: remaining.x, y: remaining.y };
      this.isDragging = true;
      this.isPanning = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.spherical.radius *= 1 + e.deltaY * 0.001;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    this.updateCamera();
  };

  private pan(dx: number, dy: number) {
    const panSpeed = 0.02 * this.spherical.radius / 20;

    // Pan in camera-local XZ plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    this.target.add(right.multiplyScalar(-dx * panSpeed));
    this.target.add(forward.multiplyScalar(dy * panSpeed));
  }

  private getPinchDistance(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPinchCenter(): { x: number; y: number } {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return pts[0] || { x: 0, y: 0 };
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }

  private updateCamera() {
    const pos = new THREE.Vector3().setFromSpherical(this.spherical).add(this.target);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  dispose() {
    const el = this.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
  }
}
