import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface UnitSpriteConfig {
  idle: string;
  damaged?: string;
  dead?: string;
  width: number;
  height: number;
}

export interface AssetManifest {
  units: Record<string, UnitSpriteConfig>;
  unitModels?: Record<string, string>;
  terrain: Record<string, string>;
  models?: Record<string, string>;
  audio: {
    sfx: Record<string, string>;
    music: Record<string, string>;
  };
  ui: Record<string, string>;
}

export class AssetLoader {
  private textureLoader = new THREE.TextureLoader();
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private textures: Map<string, THREE.Texture> = new Map();
  private models: Map<string, THREE.Group> = new Map();
  private manifest: AssetManifest | null = null;

  constructor() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  /** Load manifest from URL */
  async loadManifest(url: string): Promise<void> {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        this.manifest = await resp.json();
      }
    } catch {
      // No manifest available — use placeholders
      this.manifest = null;
    }
  }

  /** Preload all textures and models from manifest */
  async loadAll(): Promise<void> {
    if (!this.manifest) return;

    const promises: Promise<void>[] = [];

    for (const [key, config] of Object.entries(this.manifest.units)) {
      promises.push(this.loadTexture(key, config.idle));
      if (config.damaged) promises.push(this.loadTexture(`${key}_damaged`, config.damaged));
      if (config.dead) promises.push(this.loadTexture(`${key}_dead`, config.dead));
    }

    // Load GLB models
    if (this.manifest.models) {
      for (const [key, path] of Object.entries(this.manifest.models)) {
        promises.push(this.loadModel(key, path));
      }
    }

    // Load unit GLB models
    if (this.manifest.unitModels) {
      for (const [key, path] of Object.entries(this.manifest.unitModels)) {
        promises.push(this.loadModel(`unit_${key}`, path));
      }
    }

    await Promise.allSettled(promises);
  }

  private loadTexture(key: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(key, texture);
          resolve();
        },
        undefined,
        () => {
          console.warn(`[AssetLoader] Failed to load texture "${key}" from "${path}"`);
          resolve();
        }
      );
    });
  }

  private loadModel(key: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          this.models.set(key, gltf.scene);
          resolve();
        },
        undefined,
        () => {
          console.warn(`[AssetLoader] Failed to load model "${key}" from "${path}"`);
          resolve();
        }
      );
    });
  }

  /** Get a unit texture, returns null if not loaded */
  getUnitTexture(spriteKey: string, variant: 'idle' | 'damaged' | 'dead' = 'idle'): THREE.Texture | null {
    const key = variant === 'idle' ? spriteKey : `${spriteKey}_${variant}`;
    return this.textures.get(key) ?? null;
  }

  /** Get a terrain texture */
  getTerrainTexture(terrainType: string): THREE.Texture | null {
    return this.textures.get(`terrain_${terrainType}`) ?? null;
  }

  /** Get a clone of a loaded model. Returns null if not loaded. */
  getModel(key: string): THREE.Group | null {
    const template = this.models.get(key);
    if (!template) return null;
    return template.clone();
  }

  /** Check if a model exists */
  hasModel(key: string): boolean {
    return this.models.has(key);
  }

  /** Check if a sprite exists in the manifest */
  hasSprite(spriteKey: string): boolean {
    return this.manifest?.units[spriteKey] !== undefined;
  }

  dispose(): void {
    for (const tex of this.textures.values()) {
      tex.dispose();
    }
    this.textures.clear();

    for (const model of this.models.values()) {
      model.traverse((child) => {
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
    this.models.clear();
    this.dracoLoader.dispose();
  }
}
