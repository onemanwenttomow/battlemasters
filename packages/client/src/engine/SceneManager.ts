import * as THREE from "three";

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    // Scene — dark background, no ground plane
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera — isometric-ish angle
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.camera.position.set(12, 18, 20);
    this.camera.lookAt(12, 0, 10);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.5);
    this.directionalLight.position.set(15, 25, 10);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 80;
    this.directionalLight.shadow.camera.left = -25;
    this.directionalLight.shadow.camera.right = 25;
    this.directionalLight.shadow.camera.top = 25;
    this.directionalLight.shadow.camera.bottom = -25;
    this.scene.add(this.directionalLight);

    this.fillLight = new THREE.DirectionalLight(0x99bbff, 0.7);
    this.fillLight.position.set(-10, 10, -5);
    this.scene.add(this.fillLight);

    // Handle resize
    window.addEventListener("resize", () => this.onResize(container));
  }

  private onResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
