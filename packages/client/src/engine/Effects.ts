import * as THREE from 'three';
import { hexToWorld } from '@battle-masters/game-logic';
import type { HexCoord } from '@battle-masters/game-logic';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Effects {
  private group: THREE.Group;
  private particles: Particle[] = [];

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  /** Spawn a hit effect at a hex position */
  spawnHitEffect(coord: HexCoord) {
    const pos = hexToWorld(coord);
    const count = 8;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.5, pos.z);

      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 1 + Math.random() * 2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 2,
        Math.sin(angle) * speed
      );

      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life: 0, maxLife: 0.5 + Math.random() * 0.3 });
    }
  }

  /** Spawn a death effect (unit destroyed) */
  spawnDeathEffect(coord: HexCoord) {
    const pos = hexToWorld(coord);
    const count = 15;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff3333 : 0x333333,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.4, pos.z);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 3;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        1.5 + Math.random() * 3,
        Math.sin(angle) * speed
      );

      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life: 0, maxLife: 0.8 + Math.random() * 0.4 });
    }
  }

  /** Spawn cannon fire burst at cannon position */
  spawnCannonFireEffect(coord: HexCoord) {
    const pos = hexToWorld(coord);
    const count = 12;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff8844 : 0xffcc44,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.6, pos.z);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        3 + Math.random() * 2,
        Math.sin(angle) * speed
      );

      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life: 0, maxLife: 0.4 + Math.random() * 0.3 });
    }
  }

  /** Spawn explosion effect (large red/orange burst) */
  spawnExplosionEffect(coord: HexCoord) {
    const pos = hexToWorld(coord);
    const count = 20;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.07, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff3333 : 0xff6600,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.4, pos.z);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 3,
        Math.sin(angle) * speed
      );

      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life: 0, maxLife: 1.0 + Math.random() * 0.5 });
    }
  }

  /** Spawn bouncing impact effect (quick yellow burst) */
  spawnBouncingEffect(coord: HexCoord) {
    const pos = hexToWorld(coord);
    const count = 6;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.5, pos.z);

      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
      const speed = 1.5 + Math.random() * 1.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2 + Math.random() * 1.5,
        Math.sin(angle) * speed
      );

      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life: 0, maxLife: 0.3 + Math.random() * 0.2 });
    }
  }

  /** Update particle simulation */
  update(deltaTime: number) {
    const gravity = -9.8;
    const toRemove: number[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += deltaTime;

      if (p.life >= p.maxLife) {
        toRemove.push(i);
        continue;
      }

      // Physics
      p.velocity.y += gravity * deltaTime;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));

      // Fade out
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
    }

    // Remove expired particles (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const p = this.particles[idx];
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      this.particles.splice(idx, 1);
    }
  }

  dispose() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
    this.scene.remove(this.group);
  }
}
