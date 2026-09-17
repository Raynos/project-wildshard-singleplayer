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
  sunColor = new THREE.Color(1.0, 0.86, 0.68);
  csm!: CSM;
  sunDisc!: THREE.Mesh;
  planet = new THREE.Group();
  planetDir = new THREE.Vector3(-0.75, 0.33, 0.55).normalize();
  private materials = new Set<THREE.Material>();

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private renderer: THREE.WebGLRenderer) {}

  async build() {
    const hdriName = new URLSearchParams(location.search).get('hdri') ?? 'qwantani_late_afternoon_puresky';
    const hdr = await loadHDR(`/assets/hdri/${hdriName}_2k.hdr`);
    this.findSun(hdr);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.8;
    this.scene.background = hdr;
    this.scene.backgroundIntensity = 1.15;
    this.scene.backgroundBlurriness = 0.0;

    // Fog colour = average of the sky just above the horizon in the view direction
    const horizon = this.sampleHorizon(hdr);
    this.scene.fog = new THREE.Fog(horizon, 1, 1e6); // distances unused: Atmosphere.ts overrides the maths
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    fogUniforms.fogSunColor.value.set(1.0, 0.78, 0.5);

    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: 3, mode: 'practical',
      maxFar: 220, shadowMapSize: 2048, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: 4.6, shadowBias: -0.00012, lightMargin: 120, lightNear: 1, lightFar: 600,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.shadow.normalBias = 0.05; l.shadow.radius = 2; }

    this.scene.add(new THREE.HemisphereLight(0x9fb8d8, 0x4a3a28, 0.35));

    this.buildSunDisc();
    this.buildPlanet();
    this.buildClouds();
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

  clouds!: THREE.Mesh;
  private cloudUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() } };

  update(dt = 0) { this.csm.update(); this.cloudUniforms.uTime.value += dt; }

  /** Thin procedural cirrus/cumulus layer on a sky dome — the HDRI has none, and a forest needs a sky with some drama. */
  private buildClouds() {
    const geo = new THREE.SphereGeometry(1400, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const tex = makeCloudTexture();
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunColor.value.set(1.0, 0.82, 0.62);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.cloudUniforms, tClouds: { value: tex } },
      transparent: true, depthWrite: false, side: THREE.BackSide,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tClouds; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < 0.02) discard;
          // project onto a flat cloud plane at height ~1 for a believable perspective
          vec2 p = d.xz / (d.y + 0.15);
          vec2 uv = p * 0.5 + vec2(uTime * 0.004, uTime * 0.002);
          float a = texture2D(tClouds, uv).r;
          float b = texture2D(tClouds, uv * 3.1 + vec2(-uTime * 0.006, uTime * 0.003)).r;
          float cover = smoothstep(0.52, 0.8, a * 0.7 + b * 0.3);
          float horizon = smoothstep(0.02, 0.22, d.y);
          float sunAmt = max(dot(d, uSunDir), 0.0);
          vec3 lit = mix(vec3(0.62, 0.66, 0.74), vec3(1.0, 0.94, 0.86), smoothstep(0.3, 0.9, a));
          lit = mix(lit, uSunColor * 1.3, pow(sunAmt, 6.0) * 0.6);
          float alpha = cover * horizon * 0.85;
          gl_FragColor = vec4(lit, alpha);
        }`,
    });
    this.clouds = new THREE.Mesh(geo, mat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -10;
    this.scene.add(this.clouds);
  }

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
    const dist = 1700, radius = 300;
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), new THREE.MeshLambertMaterial({
      color: 0xb9c2cc, fog: false, emissive: 0x4a5a70, emissiveIntensity: 0.9,
    }));
    const bandsTex = makePlanetTexture();
    (body.material as THREE.MeshLambertMaterial).map = bandsTex;
    const ringTex = makeRingTexture();
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.25, radius * 2.35, 128, 1), new THREE.MeshLambertMaterial({
      map: ringTex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false, alphaMap: ringTex,
      color: 0xd8dde6, emissive: 0x2a3446, emissiveIntensity: 0.8,
    }));
    this.setupMaterial(body.material as THREE.Material);
    this.setupMaterial(ring.material as THREE.Material);
    // ring uv: remap radial
    const uv = ring.geometry.attributes.uv as THREE.BufferAttribute;
    const pos = ring.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - radius * 1.25) / (radius * 1.1), 0.5);
    }
    ring.rotation.x = Math.PI / 2 - 0.42; ring.rotation.z = 0.35;
    this.planet.add(body, ring);
    this.planet.position.copy(dir).multiplyScalar(dist);
    this.planet.lookAt(0, 0, 0);
    this.planet.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(this.planet);
  }
}

function makeCloudTexture() {
  // tileable fbm value noise
  const N = 512;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const rnd = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const val = (x: number, y: number, f: number) => {
    const X = ((x * f) % N + N) % N, Y = ((y * f) % N + N) % N;
    const x0 = Math.floor(X), y0 = Math.floor(Y), tx = X - x0, ty = Y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const per = N / f;
    const r = (i: number, j: number) => rnd(((i % per) + per) % per, ((j % per) + per) % per);
    const a = r(x0, y0), b = r(x0 + 1, y0), cc = r(x0, y0 + 1), d = r(x0 + 1, y0 + 1);
    return (a + (b - a) * sx) * (1 - sy) + (cc + (d - cc) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 6; o++) { const f = (2 ** o) / 64; v += val(x, y, f) * amp; norm += amp; amp *= 0.55; }
    v /= norm;
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function makePlanetTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d')!;
  const bands = ['#d9d3c6', '#c4b8a6', '#e6e0d4', '#b8a996', '#d2c9ba', '#a8998a', '#e3dccf', '#c9bcab'];
  for (let y = 0; y < 512; y++) {
    const t = y / 512;
    const k = t * bands.length + Math.sin(t * 37) * 0.6 + Math.sin(t * 91) * 0.25;
    const b = bands[Math.floor(Math.abs(k)) % bands.length];
    g.fillStyle = b; g.globalAlpha = 0.9 + 0.1 * Math.sin(y * 0.2);
    g.fillRect(0, y, 1024, 1);
  }
  g.globalAlpha = 0.18;
  for (let i = 0; i < 90; i++) {
    g.fillStyle = i % 3 ? '#ffffff' : '#8a7a68'; g.beginPath();
    g.ellipse(Math.random() * 1024, Math.random() * 512, 30 + Math.random() * 140, 3 + Math.random() * 7, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeRingTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 4;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 1024; x++) {
    const t = x / 1024;
    let a = 0.55 + 0.45 * Math.sin(t * 28) * Math.sin(t * 7.3 + 1) ;
    a *= t < 0.06 ? t / 0.06 : 1;
    a *= t > 0.9 ? (1 - t) / 0.1 : 1;
    if (Math.abs(t - 0.58) < 0.035) a *= 0.12;            // Cassini-style gap
    if (Math.abs(t - 0.3) < 0.012) a *= 0.4;
    const l = 205 + 30 * Math.sin(t * 19);
    g.fillStyle = `rgba(${l},${l - 8},${l - 22},${Math.max(0, Math.min(1, a))})`; g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
