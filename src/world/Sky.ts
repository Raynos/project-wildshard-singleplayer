import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { loadHDR } from '../core/assets';
import { fogUniforms } from './Atmosphere';

/**
 * Lighting rig: HDRI sky for IBL + background, a cascaded-shadow sun matched to the
 * HDRI's brightest pixel, a visible sun disc (for god rays) and the ringed planet that
 * hangs over every Wildshard shard.
 */
export class Sky {
  sunDir = new THREE.Vector3(0.3, 0.6, 0.4).normalize();
  sunColor = new THREE.Color(1.0, 0.93, 0.82);
  csm!: CSM;
  sunDisc!: THREE.Mesh;
  planet = new THREE.Group();
  planetDir = new THREE.Vector3(-0.75, 0.33, 0.55).normalize();
  private materials = new Set<THREE.Material>();

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private renderer: THREE.WebGLRenderer) {}

  async build() {
    const hdr = await loadHDR('/assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr');
    this.findSun(hdr);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = hdr;
    this.scene.backgroundIntensity = 1.0;
    this.scene.backgroundBlurriness = 0.0;

    // Fog colour = average of the sky just above the horizon in the view direction
    const horizon = this.sampleHorizon(hdr);
    this.scene.fog = new THREE.Fog(horizon, 1, 1e6); // distances unused: Atmosphere.ts overrides the maths
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    fogUniforms.fogSunColor.value.set(1.0, 0.78, 0.5);

    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: 3, mode: 'practical',
      maxFar: 220, shadowMapSize: 2048, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: 3.2, shadowBias: -0.00012, lightMargin: 120, lightNear: 1, lightFar: 600,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.shadow.normalBias = 0.05; l.shadow.radius = 2; }

    this.scene.add(new THREE.HemisphereLight(0x8fb2d9, 0x3a3121, 0.25));

    this.buildSunDisc();
    this.buildPlanet();
    return this;
  }

  /** Wrap CSM's onBeforeCompile so materials keep their own shader patches. */
  setupMaterial(mat: THREE.Material) {
    if (this.materials.has(mat)) return;
    this.materials.add(mat);
    const own = mat.onBeforeCompile;
    this.csm.setupMaterial(mat);
    const csmHook = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => { own.call(mat, shader, renderer); csmHook.call(mat, shader, renderer); };
    const key = mat.customProgramCacheKey;
    mat.customProgramCacheKey = () => key.call(mat) + '|csm';
    mat.needsUpdate = true;
  }

  update() { this.csm.update(); }

  private findSun(hdr: THREE.DataTexture) {
    const { width, height, data } = hdr.image as { width: number; height: number; data: Float32Array | Uint16Array };
    let best = -1, bx = 0, by = 0;
    const isHalf = data instanceof Uint16Array;
    const px = (i: number) => (isHalf ? THREE.DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number));
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const l = px(i) + px(i + 1) + px(i + 2);
      if (l > best) { best = l; bx = x; by = y; }
    }
    // HDR is flipY=true so row 0 is the top → v = 1 - y/height
    const u = (bx + 0.5) / width, v = 1 - (by + 0.5) / height;
    const theta = (u - 0.5) * 2 * Math.PI, phi = (v - 0.5) * Math.PI;
    this.sunDir.set(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi)).normalize();
    if (this.sunDir.y < 0.25) this.sunDir.y = 0.25, this.sunDir.normalize();
  }

  private sampleHorizon(hdr: THREE.DataTexture) {
    const { width, height, data } = hdr.image as { width: number; height: number; data: Float32Array | Uint16Array };
    const isHalf = data instanceof Uint16Array;
    const px = (i: number) => (isHalf ? THREE.DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number));
    const c = new THREE.Color(0, 0, 0);
    const y = Math.floor(height * 0.47); // just above the horizon line
    let n = 0;
    for (let x = 0; x < width; x += 4) { const i = (y * width + x) * 4; c.r += px(i); c.g += px(i + 1); c.b += px(i + 2); n++; }
    c.multiplyScalar(1 / n);
    // clamp very bright values so fog never blows out
    const m = Math.max(c.r, c.g, c.b, 1e-3);
    if (m > 1.1) c.multiplyScalar(1.1 / m);
    return c;
  }

  private buildSunDisc() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.95, 0.85), fog: false, toneMapped: false });
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 24), mat);
    this.sunDisc.position.copy(this.sunDir).multiplyScalar(1500);
    this.sunDisc.frustumCulled = false;
    this.scene.add(this.sunDisc);
  }

  private buildPlanet() {
    // A gas giant with rings sits low over the east horizon — the world's signature skyline.
    const dir = this.planetDir;
    const dist = 1700, radius = 190;
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), new THREE.MeshLambertMaterial({
      color: 0xc9b39a, fog: false, emissive: 0x2a2f45, emissiveIntensity: 0.6,
    }));
    const bandsTex = makePlanetTexture();
    (body.material as THREE.MeshLambertMaterial).map = bandsTex;
    const ringTex = makeRingTexture();
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.3, 96, 1), new THREE.MeshLambertMaterial({
      map: ringTex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false, alphaMap: ringTex,
    }));
    this.setupMaterial(body.material as THREE.Material);
    this.setupMaterial(ring.material as THREE.Material);
    // ring uv: remap radial
    const uv = ring.geometry.attributes.uv as THREE.BufferAttribute;
    const pos = ring.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - radius * 1.35) / (radius * 0.95), 0.5);
    }
    ring.rotation.x = Math.PI / 2 - 0.35; ring.rotation.z = 0.2;
    this.planet.add(body, ring);
    this.planet.position.copy(dir).multiplyScalar(dist);
    this.planet.lookAt(0, 0, 0);
    this.planet.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(this.planet);
  }
}

function makePlanetTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  const bands = ['#d9c3a5', '#b8956e', '#e5d3b8', '#a67c52', '#cdb590', '#8f6b47', '#e0cfb5', '#b9987a'];
  for (let y = 0; y < 256; y++) {
    const t = y / 256;
    const b = bands[Math.floor(t * bands.length + Math.sin(t * 40) * 0.4) % bands.length];
    g.fillStyle = b; g.globalAlpha = 0.85 + 0.15 * Math.sin(y * 0.3);
    g.fillRect(0, y, 512, 1);
  }
  g.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#fff' : '#6b4a2f'; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 256, 20 + Math.random() * 60, 4 + Math.random() * 8, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeRingTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 4;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 512; x++) {
    const t = x / 512;
    const a = (0.35 + 0.65 * Math.abs(Math.sin(t * 60) * Math.sin(t * 13))) * (t < 0.08 ? t / 0.08 : 1) * (t > 0.92 ? (1 - t) / 0.08 : 1) * (Math.abs(t - 0.62) < 0.03 ? 0.15 : 1);
    const l = 190 + 40 * Math.sin(t * 25);
    g.fillStyle = `rgba(${l},${l - 15},${l - 40},${a})`; g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
