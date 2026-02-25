import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { DieResult } from '@battle-masters/game-logic';

// Face mapping: which DieResult is on each cube face index
// Three.js box face order: +X, -X, +Y, -Y, +Z, -Z (indices 0-5)
// Distribution: 3 skulls, 2 blanks, 1 shield
const FACE_MAP: DieResult[] = ['skull', 'blank', 'skull', 'shield', 'skull', 'blank'];

// Which axis/direction each face's normal points along
const FACE_NORMALS: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),   // +X
  new THREE.Vector3(-1, 0, 0),  // -X
  new THREE.Vector3(0, 1, 0),   // +Y (top)
  new THREE.Vector3(0, -1, 0),  // -Y
  new THREE.Vector3(0, 0, 1),   // +Z
  new THREE.Vector3(0, 0, -1),  // -Z
];

const DIE_SIZE = 1.0;
const GROUND_Y = 0;
const SAFETY_TIMEOUT_MS = 3000;

interface PhysicsDie {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  settled: boolean;
}

/** Read which face is pointing up */
function readTopFace(quat: THREE.Quaternion): DieResult {
  const up = new THREE.Vector3(0, 1, 0);
  let bestDot = -Infinity;
  let bestIndex = 0;

  for (let i = 0; i < FACE_NORMALS.length; i++) {
    const worldNormal = FACE_NORMALS[i].clone().applyQuaternion(quat);
    const dot = worldNormal.dot(up);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = i;
    }
  }
  return FACE_MAP[bestIndex];
}

function createFaceTexture(symbol: string, color: string, bgColor: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle border/bevel
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  // Symbol
  ctx.fillStyle = color;
  ctx.font = 'bold 140px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, size / 2, size / 2 + 4);

  // Glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillText(symbol, size / 2, size / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createDiceMaterials(): THREE.MeshStandardMaterial[] {
  const matParams: Record<DieResult, { symbol: string; color: string }> = {
    skull: { symbol: '\u2620', color: '#ff4444' },
    shield: { symbol: '\u26E8', color: '#4488ff' },
    blank: { symbol: '\u25CB', color: '#888888' },
  };

  const bgColor = '#1a1a2e';

  return FACE_MAP.map((face) => {
    const { symbol, color } = matParams[face];
    const texture = createFaceTexture(symbol, color, bgColor);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.1,
    });
  });
}

export class DiceScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: CANNON.World;
  private dice: PhysicsDie[] = [];
  private groundBody: CANNON.Body;
  private wallBodies: CANNON.Body[] = [];
  private animFrame: number | null = null;
  private materials: THREE.MeshStandardMaterial[];
  private onSettledCallback: ((results: DieResult[]) => void) | null = null;
  private safetyTimer: number | null = null;
  private disposed = false;

  constructor(container: HTMLElement) {
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 200;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Camera — looking down at dice area from above and slightly in front
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    this.camera.position.set(0, 8, 6);
    this.camera.lookAt(0, 0.5, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.5);
    dirLight.position.set(3, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x99bbff, 0.4);
    fillLight.position.set(-3, 4, -2);
    this.scene.add(fillLight);

    // Ground plane (shadow receiver, semi-transparent)
    const groundGeo = new THREE.PlaneGeometry(12, 12);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = GROUND_Y;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -25, 0),
    });
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.restitution = 0.2;
    this.world.defaultContactMaterial.friction = 0.6;

    // Ground plane
    this.groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);

    // Invisible walls to contain dice
    const wallConfigs: { pos: [number, number, number]; euler: [number, number, number] }[] = [
      { pos: [4, 2, 0],   euler: [0, -Math.PI / 2, 0] },  // +X wall, normal → -X
      { pos: [-4, 2, 0],  euler: [0, Math.PI / 2, 0] },   // -X wall, normal → +X
      { pos: [0, 2, 3],   euler: [0, Math.PI, 0] },        // +Z wall, normal → -Z
      { pos: [0, 2, -3],  euler: [0, 0, 0] },              // -Z wall, normal → +Z (default)
    ];

    for (const { pos, euler } of wallConfigs) {
      const wall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
      });
      wall.position.set(pos[0], pos[1], pos[2]);
      wall.quaternion.setFromEuler(euler[0], euler[1], euler[2]);
      this.world.addBody(wall);
      this.wallBodies.push(wall);
    }

    // Create dice materials (textures)
    this.materials = createDiceMaterials();
  }

  rollDice(count: number, onSettled: (results: DieResult[]) => void): void {
    this.clearDice();
    this.onSettledCallback = onSettled;

    const spacing = 1.6;
    const startX = -((count - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const die = this.createDie(startX + i * spacing);
      this.dice.push(die);
    }

    // Safety timeout: force settle after 3s
    this.safetyTimer = window.setTimeout(() => {
      this.forceSleepAll();
    }, SAFETY_TIMEOUT_MS);

    // Start animation loop
    if (this.animFrame === null) {
      this.animate();
    }
  }

  private createDie(xPos: number): PhysicsDie {
    const geometry = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 4, 0.08);
    const dieMaterials = this.materials.map((m) => m.clone());
    const mesh = new THREE.Mesh(geometry, dieMaterials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const halfSize = DIE_SIZE / 2;
    const shape = new CANNON.Box(new CANNON.Vec3(halfSize, halfSize, halfSize));
    const body = new CANNON.Body({
      mass: 1,
      shape,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.6,
      linearDamping: 0.2,
      angularDamping: 0.2,
    });

    // Start position: above and behind camera view, spread out
    body.position.set(
      xPos + (Math.random() - 0.5) * 0.5,
      3.5 + Math.random() * 1.5,
      -1 + (Math.random() - 0.5) * 0.5,
    );

    // Random initial rotation
    body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    );

    // Throw dice forward and down with spin
    body.velocity.set(
      (Math.random() - 0.5) * 3,
      -4 - Math.random() * 2,
      2 + Math.random() * 2,
    );

    body.angularVelocity.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
    );

    this.world.addBody(body);

    return { mesh, body, settled: false };
  }

  clearDice(): void {
    if (this.safetyTimer !== null) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }

    for (const die of this.dice) {
      this.scene.remove(die.mesh);
      die.mesh.geometry.dispose();
      if (Array.isArray(die.mesh.material)) {
        die.mesh.material.forEach((m) => m.dispose());
      }
      this.world.removeBody(die.body);
    }
    this.dice = [];
    this.onSettledCallback = null;
  }

  private forceSleepAll(): void {
    for (const die of this.dice) {
      if (!die.settled) {
        die.body.velocity.set(0, 0, 0);
        die.body.angularVelocity.set(0, 0, 0);
        die.body.sleep();
      }
    }
  }

  private animate = (): void => {
    if (this.disposed) return;

    // Step physics (no guidance torque — dice roll freely)
    this.world.step(1 / 60);

    // Sync meshes with physics & handle settling
    for (const die of this.dice) {
      if (die.settled) continue;

      // Sync from physics
      die.mesh.position.copy(die.body.position as unknown as THREE.Vector3);
      die.mesh.quaternion.copy(die.body.quaternion as unknown as THREE.Quaternion);

      // Check if body is sleeping
      if (die.body.sleepState === CANNON.Body.SLEEPING) {
        die.settled = true;
        this.checkAllSettled();
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.animFrame = requestAnimationFrame(this.animate);
  };

  private checkAllSettled(): void {
    if (this.dice.length === 0) return;
    const allSettled = this.dice.every((d) => d.settled);
    if (allSettled && this.onSettledCallback) {
      if (this.safetyTimer !== null) {
        clearTimeout(this.safetyTimer);
        this.safetyTimer = null;
      }

      // Read the top face of each die
      const results: DieResult[] = this.dice.map((die) => {
        const quat = new THREE.Quaternion(
          die.body.quaternion.x, die.body.quaternion.y,
          die.body.quaternion.z, die.body.quaternion.w,
        );
        return readTopFace(quat);
      });

      const cb = this.onSettledCallback;
      this.onSettledCallback = null;
      setTimeout(() => cb(results), 50);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.safetyTimer !== null) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }

    for (const die of this.dice) {
      this.scene.remove(die.mesh);
      die.mesh.geometry.dispose();
      if (Array.isArray(die.mesh.material)) {
        die.mesh.material.forEach((m) => m.dispose());
      }
      this.world.removeBody(die.body);
    }
    this.dice = [];

    for (const mat of this.materials) {
      mat.map?.dispose();
      mat.dispose();
    }

    this.world.removeBody(this.groundBody);
    for (const wall of this.wallBodies) {
      this.world.removeBody(wall);
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
