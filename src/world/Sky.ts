import * as THREE from 'three';
import { TIER_CONFIG } from '../core/tier';
import { setting } from '../ui/Settings';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { loadHDR } from '../core/assets';
import { fogUniforms } from './Atmosphere';
import { Noise2D } from '../core/noise';
import { Rng } from '../core/rng';
import { getActiveChunk } from '../chunks/registry';
import type { ChunkSky } from '../chunks/ChunkDef';
import { bakedTexture, preloadBakedTextures } from '../boot/bakedTextures';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import { bakedSkyUrls, loadBakedSky as loadSkyPair } from './BakedSky';
import { macrotask } from '../boot/plan';
import { installStylize, toonUniforms } from './stylize';
import { StylizedSky } from './StylizedSky';
import { DayNight } from './DayNight';
import { loadStylizedLUT } from './lut';
import type { LookupTexture } from 'postprocessing';

/** the low-poly shard's sun before the day / night clock moves it: mid-morning from the east-south-east, 38° up */
const STYLIZED_SUN = new THREE.Vector3(-0.74, 0.616, -0.27).normalize();

/** how far the planet group sits from the camera (Game.ts re-places it every frame along `planetDir`) */
export const PLANET_DIST = 1700;

/** public/assets/baked/<slug>/sky.json — the HDR's sun direction and horizon colour, scanned at build time (scripts/bake-sky.mjs). */
async function loadBakedSky(hdri: string): Promise<{ sunDir: [number, number, number]; horizon: [number, number, number] } | null> {
  const url = `/assets/baked/${getActiveChunk().slug}/sky.json`;
  if (!(url in PUBLIC_BYTES) || new URLSearchParams(location.search).has('nobake') || new URLSearchParams(location.search).has('hdri')) return null;
  try {
    const j = await (await fetch(url)).json() as { hdri: string; sunDir: [number, number, number]; horizon: [number, number, number] };
    return j.hdri === hdri ? j : null; // a different HDRI than the bake saw → scan at launch
  } catch { return null; }
}

/**
 * Lighting rig: HDRI sky for IBL + background, a cascaded-shadow sun matched to the
 * HDRI's brightest pixel, a visible sun disc (for god rays) and the ringed planet that
 * hangs over every Wildshard shard.
 */
export class Sky {
  sunDir = new THREE.Vector3(0.3, 0.6, 0.4).normalize();
  sunColor = new THREE.Color(...getActiveChunk().sky.sunColor);
  csm!: CSM;
  sunDisc!: THREE.Mesh;
  planet = new THREE.Group();
  planetDir = new THREE.Vector3(-0.75, 0.33, 0.55).normalize();
  private materials = new Set<THREE.Material>();

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private renderer: THREE.WebGLRenderer) {}

  /** the player's camera (world modules cull against it) */
  get viewCamera(): THREE.PerspectiveCamera { return this.camera; }

  async build(): Promise<this> {
    const { sky: S, atmosphere: A, style } = getActiveChunk();
    // Look Lab (E65): main menu ▸ Settings ▸ Look Lab keeps the pre-remaster looks selectable (reload to apply)
    const toon = style === 'lowpoly' && setting('lighting') === 'toon', stylizedSky = style === 'lowpoly' && setting('sky') === 'stylized';
    if (toon) installStylize(); // the toon lighting model (D1) — patched into three's chunk before anything compiles
    const qs = new URLSearchParams(location.search);
    const qn = (k: string, d: number) => { const v = qs.get(k); return v === null ? d : Number.parseFloat(v); };
    const horizon = stylizedSky ? await this.setupStylized() : await this.setupHDRI(qs, qn);
    this.scene.fog = new THREE.Fog(horizon, 1, 1e6); // distances unused: Atmosphere.ts overrides the maths
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    fogUniforms.fogSunColor.value.set(...S.fogSunColor);
    fogUniforms.fogHeight.value = A.fogHeight;
    fogUniforms.fogHeightFalloff.value = A.fogHeightFalloff;
    fogUniforms.fogHeightDensity.value = A.fogHeightDensity;
    fogUniforms.fogDistDensity.value = A.fogDistDensity;

    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: TIER_CONFIG.cascades, mode: 'practical',
      maxFar: TIER_CONFIG.shadowFar, shadowMapSize: TIER_CONFIG.shadowMapSize, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: qn('sunI', S.sunIntensity), shadowBias: -0.00012, lightMargin: TIER_CONFIG.shadowMargin, lightNear: 1, lightFar: 600,
    });
    this.csm.fade = true;
    if (!TIER_CONFIG.softShadows) this.renderer.shadowMap.type = THREE.PCFShadowMap; // 16-tap PCFSoft → 9-tap PCF on the phone
    patchCSMShaderChunk();
    // the stylized shard's low sun (golden hour, dawn) grazes the flat decks: more normal bias or the planks speckle with acne
    for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.shadow.normalBias = this.stylized ? 0.14 : 0.05; l.shadow.radius = this.stylized ? 0.6 : 2; }

    this.hemi = new THREE.HemisphereLight(S.hemiSky, S.hemiGround, S.hemiIntensity);
    this.scene.add(this.hemi);

    this.buildSunDisc();
    this.buildPlanet();
    if (this.stylized) {
      const st = this.stylized, fog = this.scene.fog;
      this.clouds = st.dome; // Game.ts keeps `clouds` on the camera: the dome and its cumulus ring
      // the day / night clock (L7, D3) turns every knob above from here on
      if (fog instanceof THREE.Fog) this.dayNight = new DayNight({
        sunDir: this.sunDir, lights: this.csm.lights, lightDirection: this.csm.lightDirection, hemi: this.hemi, fog,
        fogSunDir: fogUniforms.fogSunDir.value, fogSunColor: fogUniforms.fogSunColor.value, toon: toonUniforms,
        setSkyPalette: (pal, dir) => { st.setPalette(pal); st.u.uSunDir.value.copy(dir); },
        disc: this.sunDisc, planetSun: this.giantUniforms.uSunDir.value, planetHaze: this.giantUniforms.uHaze.value,
        refreshEnvironment: () => { this.refreshEnvironment(); },
      }, qn('sunI', S.sunIntensity) / 2.7);
    } else this.buildClouds();
    return this;
  }

  /** Pine Hollow's rig (and any `style: 'pbr'` shard): the HDRI is the background and the IBL; returns the fog colour. */
  private async setupHDRI(qs: URLSearchParams, qn: (k: string, d: number) => number): Promise<THREE.Color> {
    const { sky: S } = getActiveChunk();
    const hdriName = qs.get('hdri') ?? S.hdri;
    // baked procedural textures (clouds, fur…) and the baked sun / horizon (scripts/bake-sky.mjs) ride along with the HDR
    // the HDR itself: the gain-mapped JPEG + PNG pair (~0.3 MB, BakedSky.ts) when the build has it, else the 4–5 MB .hdr
    const pair = bakedSkyUrls(hdriName);
    const hdrUrl = `/assets/hdri/${hdriName}_2k.hdr`;
    const loadSky = pair ? loadSkyPair(pair).catch((e: unknown) => { console.warn(`[sky] gain-mapped pair not used (${String(e)}); loading the .hdr`); return loadHDR(hdrUrl); }) : loadHDR(hdrUrl);
    const [hdr, , baked] = await Promise.all([loadSky, preloadBakedTextures(), loadBakedSky(hdriName)]);
    if (baked) this.sunDir.fromArray(baked.sunDir).normalize();
    else this.findSun(hdr);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    // three tasks, not one 130 ms one at 4x CPU: the PMREM program compile, the 2048x1024 half-float upload, then the
    // cube-UV render + blur passes (same calls, same result — only the task boundaries move)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    await macrotask();
    this.renderer.initTexture(hdr);
    await macrotask();
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = qn('envI', S.envIntensity);
    this.scene.background = hdr;
    this.scene.backgroundIntensity = qn('bgI', S.bgIntensity);
    this.scene.backgroundBlurriness = 0.0;

    // Fog colour = average of the sky just above the horizon in the view direction
    return baked ? new THREE.Color(...baked.horizon) : this.sampleHorizon(hdr);
  }

  /**
   * The low-poly shard (D2): no HDRI at all — the stylized gradient dome + faceted cumulus (StylizedSky.ts) is the
   * background, a PMREM of the dome is the (specular-only, stylize.ts) environment, and the sun comes from the
   * day / night clock's start time. Returns the fog colour (the dome's horizon).
   */
  stylized: StylizedSky | null = null;
  /** the low-poly shard's learned colour LUT (lut.ts, X1) — Game.buildComposer ends the grade with it; null elsewhere */
  lut: LookupTexture | null = null;
  /** the low-poly shard's day / night clock (DayNight.ts) — null on a PBR shard */
  dayNight: DayNight | null = null;
  hemi!: THREE.HemisphereLight;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private async setupStylized(): Promise<THREE.Color> {
    const { sky: S } = getActiveChunk();
    const [, lut] = await Promise.all([preloadBakedTextures(), loadStylizedLUT()]);
    this.lut = lut;
    this.sunDir.copy(STYLIZED_SUN);
    const st = new StylizedSky(this.sunDir).build();
    this.stylized = st;
    this.scene.add(st.dome);
    this.scene.background = null;
    this.refreshEnvironment();
    this.scene.environmentIntensity = S.envIntensity;
    toonUniforms.uFogZenith.value.copy(st.u.uZenith.value); // the colour-ramp fog (L3) fades into the dome's own gradient
    return st.u.uHorizon.value.clone();
  }

  /**
   * After an in-place WebGL restore (src/core/GpuRecovery.ts, E54): the PMREM environment was a render target, so it came
   * back empty. Render it again — the stylized dome through refreshEnvironment, the HDR shard from its background texture.
   */
  rebuildEnvironment(): void {
    if (this.stylized) { this.pmrem = null; this.envRT = null; this.refreshEnvironment(); return; } // a fresh generator: the old one's targets belong to the lost context
    const hdr = this.scene.background;
    if (!(hdr instanceof THREE.Texture)) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
  }

  /** re-render the dome into the PMREM environment (DayNight calls it when the sky has moved on; ~1 ms of GPU) */
  refreshEnvironment(): void {
    if (!this.stylized) return;
    this.pmrem ??= new THREE.PMREMGenerator(this.renderer);
    const rt = this.pmrem.fromScene(this.stylized.envScene, 0, 1, 3000, { size: 64 });
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  /**
   * Shared 1×1 fillers so every plain MeshStandard/Physical material carries the same map slots
   * (map · normal · ao · roughness · metalness) and therefore the same program: three keys a program
   * on WHICH slots exist, not their contents, so a coloured post, a mapped plank and a full PBR set
   * were three ~150 ms Metal compiles on the iPhone for what is one shader with different uniforms.
   * White multiplies by 1, a flat normal leaves the geometry normal; materials with their own
   * shader patch (an own customProgramCacheKey) are left alone.
   */
  private static fillers: { white: THREE.DataTexture; flatNormal: THREE.DataTexture } | null = null;
  private static fillSlots(mat: THREE.Material) {
    const m = mat as THREE.MeshStandardMaterial;
    if (!m.isMeshStandardMaterial || Object.hasOwn(mat, 'customProgramCacheKey')) return;
    if (!Sky.fillers) {
      const tex = (rgb: [number, number, number], srgb: boolean) => { const t = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
      Sky.fillers = { white: tex([255, 255, 255], true), flatNormal: tex([128, 128, 255], false) };
    }
    const { white, flatNormal } = Sky.fillers;
    m.map ??= white;
    m.normalMap ??= flatNormal;
    m.aoMap ??= white;         // ao · roughness · metalness read r · g · b: white = ×1
    m.roughnessMap ??= white;
    m.metalnessMap ??= white;
  }

  /** Wrap CSM's onBeforeCompile so materials keep their own shader patches. */
  setupMaterial(mat: THREE.Material): void {
    if (this.materials.has(mat)) return;
    this.materials.add(mat);
    Sky.fillSlots(mat);
    const own = mat.onBeforeCompile.bind(mat);
    this.csm.setupMaterial(mat);
    const csmHook = mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => { own(shader, renderer); csmHook(shader, renderer); };
    const key = mat.customProgramCacheKey.bind(mat);
    mat.customProgramCacheKey = () => `${key()}|csm`;
    mat.needsUpdate = true;
  }

  clouds!: THREE.Mesh;
  private cloudUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() } };

  update(dt = 0): void { this.csm.update(); this.cloudUniforms.uTime.value += dt; this.giantUniforms.uTime.value += dt; if (this.stylized) { this.dayNight?.update(dt); this.stylized.update(dt); toonUniforms.uCloudTime.value += dt; } }

  /** Thin procedural cirrus/cumulus layer on a sky dome — the HDRI has none, and a forest needs a sky with some drama. */
  private buildClouds() {
    const geo = new THREE.SphereGeometry(1400, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const tex = bakedTexture('clouds', makeCloudTexture); // 512² six-octave simplex on a torus: ~200 ms of phone CPU when not baked
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunColor.value.set(...getActiveChunk().sky.cloudSunColor);
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
    if (this.sunDir.y < 0.12) { this.sunDir.y = 0.12; this.sunDir.normalize(); }
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
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 24), mat);
    this.sunDisc.position.copy(this.sunDir).multiplyScalar(1500);
    this.sunDisc.frustumCulled = false;
    // soft corona so the disc reads as a glowing sun rather than a white ball
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = ctx2d(c);
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,240,210,0.9)'); grad.addColorStop(0.12, 'rgba(255,210,150,0.55)'); grad.addColorStop(0.4, 'rgba(255,170,90,0.12)'); grad.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    halo.scale.set(420, 420, 1);
    this.sunDisc.add(halo);
    this.scene.add(this.sunDisc);
  }

  private buildPlanet() {
    const P = getActiveChunk().sky.planet;
    if (P) { this.buildGasGiant(P); return; }
    // A gas giant with rings sits low over the east horizon — the world's signature skyline.
    const dir = this.planetDir;
    const dist = 1700, radius = 300;
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), new THREE.MeshLambertMaterial({
      color: 0x9aa4b4, fog: false, emissive: 0x2c3646, emissiveIntensity: 0.7, transparent: true, opacity: 0.85,
    }));
    const bandsTex = bakedTexture('planet', makePlanetTexture); bandsTex.colorSpace = THREE.SRGBColorSpace;
    body.material.map = bandsTex;
    const ringTex = makeRingTexture();
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.25, radius * 2.35, 128, 1), new THREE.MeshLambertMaterial({
      map: ringTex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false, alphaMap: ringTex,
      color: 0xb8c0cc, emissive: 0x1e2838, emissiveIntensity: 0.7, opacity: 0.8,
    }));
    this.setupMaterial(body.material);
    this.setupMaterial(ring.material);
    // ring uv: remap radial
    const uv = ring.geometry.getAttribute('uv');
    const pos = ring.geometry.getAttribute('position');
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

  /**
   * `ChunkSky.planet`: a banded gas giant with a thin bright ring on the sky where the def puts it
   * (Driftwood Isle). Two transparent, fogless, depth-write-free meshes in `this.planet` (Game.ts
   * keeps the group `PLANET_DIST` along `planetDir` from the camera): the body is a sphere shaded in
   * its own shader — band texture wrapped about the ring axis, soft terminator from the sun's side,
   * limb darkening and sky-haze at the limb so it sits *in* the sky like the mockups — and the ring
   * an annulus whose shader hides the part behind the body and darkens the body's shadow on it.
   */
  private buildGasGiant(P: NonNullable<ChunkSky['planet']>) {
    const d2r = Math.PI / 180;
    const az = P.azimuth * d2r, el = P.elevation * d2r;
    this.planetDir.set(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    const dist = PLANET_DIST, R = dist * Math.tan(P.size * 0.5 * d2r);
    const haze = new THREE.Color().copy((this.scene.fog as THREE.Fog).color).lerp(new THREE.Color(0.55, 0.7, 0.95), 0.4);
    const bands = bakedTexture('giant', makeGiantTexture); bands.colorSpace = THREE.SRGBColorSpace;
    bands.wrapS = THREE.RepeatWrapping; bands.wrapT = THREE.ClampToEdgeWrapping;
    this.giantUniforms.uSunDir.value.copy(this.sunDir);
    this.giantUniforms.uHaze.value.copy(haze);
    this.giantUniforms.uRadius.value = R;
    this.giantUniforms.uCrisp.value = this.stylized ? 1 : 0;

    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.ShaderMaterial({
      uniforms: { ...this.giantUniforms, tBands: { value: bands } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tBands; uniform vec3 uSunDir; uniform vec3 uHaze; uniform vec3 uAxis; uniform float uTime; uniform float uCrisp;
        varying vec3 vN; varying vec3 vW;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          // bands wrap about the ring axis; the giant turns very slowly
          vec3 T = normalize(cross(uAxis, vec3(0.0, 0.0, 1.0)));
          vec3 B = cross(uAxis, T);
          float lat = dot(N, uAxis);
          float lon = atan(dot(N, B), dot(N, T)) / 6.2831853 + uTime * 0.0025;
          vec3 col = texture2D(tBands, vec2(lon, lat * 0.5 + 0.5)).rgb;
          float mu = max(dot(N, V), 0.0);
          float day = smoothstep(-0.35, 0.3, dot(N, uSunDir));   // a wide soft terminator: the disc reads bright, with a shaded crescent
          float limb = 0.45 + 0.55 * mu;                       // limb darkening
          vec3 lit = col * (0.24 + 0.95 * day) * limb + col * vec3(0.05, 0.08, 0.14) * (1.0 - day); // a little sky bounce on the night side
          // sky haze: the disc is pale and airy, more so at the limb (it sits in the atmosphere, not in front of it)
          float h = (0.1 + 0.45 * pow(1.0 - mu, 2.4)) * (1.0 - 0.7 * uCrisp);   // uCrisp (the stylized sky): a crisp, opaque disc
          vec3 c = mix(lit, uHaze, h);
          gl_FragColor = vec4(c, mix(0.92 - 0.25 * pow(1.0 - mu, 3.0), 1.0, uCrisp));
        }`,
    }));
    body.renderOrder = -12;

    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.38, R * 2.08, 160, 1), new THREE.ShaderMaterial({
      uniforms: { ...this.giantUniforms },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec2 vL; varying vec3 vC;
        void main() {
          vL = position.xy;
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vC = modelMatrix[3].xyz;                      // the planet's centre (the ring sits at the group origin)
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform vec3 uHaze; uniform vec3 uAxis; uniform float uRadius; uniform float uCrisp;
        varying vec3 vW; varying vec2 vL; varying vec3 vC;
        // does the ray o + d t (t > 0, t < tmax) pass through the body?
        bool hitsBody(vec3 o, vec3 d, float tmax) {
          float t = dot(vC - o, d);
          if (t < 0.0 || t > tmax) return false;
          return length(o + d * t - vC) < uRadius * 0.995;
        }
        void main() {
          float r = length(vL) / uRadius;                 // 1.38 … 2.08
          float t = (r - 1.38) / 0.70;
          // radial profile: a bright dense inner band, a thin gap, a fainter outer sheet with fine ringlets
          float a = 0.62 + 0.38 * sin(t * 31.0) * sin(t * 7.3 + 1.0);
          a *= smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.86, t);
          a *= 1.0 - 0.85 * smoothstep(0.03, 0.0, abs(t - 0.56));            // the Cassini gap
          a *= 1.0 - 0.5 * smoothstep(0.012, 0.0, abs(t - 0.3));
          a *= mix(1.0, 0.55, smoothstep(0.6, 1.0, t));                        // the outer sheet is thinner
          float bright = 0.55 + 0.45 * sin(t * 19.0 + 0.4);
          // hidden behind the body / in the body's shadow
          vec3 toEye = cameraPosition - vW; float dEye = length(toEye);
          if (hitsBody(vW, toEye / dEye, dEye)) discard;
          float shadow = hitsBody(vW, uSunDir, 1e9) ? 0.22 : 1.0;
          // lit face vs the face in shade
          vec3 V = toEye / dEye;
          float sameSide = sign(dot(uAxis, V)) == sign(dot(uAxis, uSunDir)) ? 1.0 : 0.6;
          float lit = (0.5 + 0.5 * abs(dot(uAxis, uSunDir))) * sameSide * shadow;
          vec3 col = vec3(0.98, 0.95, 0.88) * (0.45 + 0.9 * lit) * bright;
          col = mix(col, uHaze, 0.2 * (1.0 - 0.6 * uCrisp));
          gl_FragColor = vec4(col, a * mix(0.8, 0.95, uCrisp));
        }`,
    }));
    ring.rotation.set((90 - P.tilt) * d2r, 0, (P.roll ?? 20) * d2r, 'ZXY');
    ring.renderOrder = -11;

    this.planet.add(body, ring);
    this.planet.position.copy(this.planetDir).multiplyScalar(dist);
    this.planet.lookAt(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion).applyQuaternion(this.planet.quaternion).normalize();
    this.giantUniforms.uAxis.value.copy(axis);
    this.planet.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(this.planet);
  }
  private giantUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uHaze: { value: new THREE.Color() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uRadius: { value: 1 }, uCrisp: { value: 0 } };
}

/**
 * three r186's CSMShader replaces `lights_fragment_begin` with a copy that predates the
 * `#ifdef STANDARD` block computing `material.dfg` / multi-scattering compensation, so every
 * CSM material loses its IBL specular (metals go black, water loses its sky). Re-insert it.
 */
function patchCSMShaderChunk() {
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (chunk.includes('material.dfg')) return;
  const block = /* glsl */`
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;`;
  THREE.ShaderChunk.lights_fragment_begin = chunk.replace('IncidentLight directLight;', block);
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('[sky] no 2d canvas context');
  return g;
}

function makeCloudTexture() {
  // tileable fbm: sample simplex noise on a torus so both axes wrap without seams
  const N = 512;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = ctx2d(c);
  const img = g.createImageData(N, N);
  const n = new Noise2D(1234);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    const px = Math.cos(u) * 1.5, py = Math.sin(u) * 1.5, pz = Math.cos(v) * 1.5, pw = Math.sin(v) * 1.5;
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 6; o++) { const f = 2 ** o; s += (n.get((px + pz * 0.7) * f, (py + pw * 0.7) * f + o * 7.3) * 0.5 + 0.5) * amp; norm += amp; amp *= 0.55; }
    s /= norm;
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = s * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function makePlanetTexture() {
  const rng = new Rng(4242); // seeded: the bake (scripts/bake-textures.mjs) must be reproducible
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = ctx2d(c);
  const bands = ['#d9d3c6', '#c4b8a6', '#e6e0d4', '#b8a996', '#d2c9ba', '#a8998a', '#e3dccf', '#c9bcab'];
  for (let y = 0; y < 512; y++) {
    const t = y / 512;
    const k = t * bands.length + Math.sin(t * 37) * 0.6 + Math.sin(t * 91) * 0.25;
    const b = bands[Math.floor(Math.abs(k)) % bands.length];
    if (b === undefined) continue;
    g.fillStyle = b; g.globalAlpha = 0.9 + 0.1 * Math.sin(y * 0.2);
    g.fillRect(0, y, 1024, 1);
  }
  g.globalAlpha = 0.18;
  for (let i = 0; i < 90; i++) {
    g.fillStyle = i % 3 ? '#ffffff' : '#8a7a68'; g.beginPath();
    g.ellipse(rng.next() * 1024, rng.next() * 512, 30 + rng.next() * 140, 3 + rng.next() * 7, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeRingTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 4;
  const g = ctx2d(c);
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

/**
 * The gas giant's bands (`ChunkSky.planet`): cream / tan / rust latitude bands with turbulent edges and
 * a few storm ovals, wrapping seamlessly in longitude (noise sampled on a circle). Seeded so the bake is
 * reproducible (scripts/bake-textures.mjs, name `giant`).
 */
function makeGiantTexture() {
  const W = 512, H = 256;
  const rng = new Rng(7171), n = new Noise2D(7171);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const img = g.createImageData(W, H);
  // colour stops down the latitude (0 = south pole … 1 = north pole)
  const stops: [number, [number, number, number]][] = [
    [0.0, [200, 180, 150]], [0.08, [230, 214, 184]], [0.16, [196, 156, 108]], [0.24, [240, 228, 202]], [0.3, [172, 104, 64]],
    [0.36, [234, 218, 188]], [0.43, [208, 168, 118]], [0.5, [246, 236, 214]], [0.56, [190, 136, 90]], [0.62, [228, 208, 176]],
    [0.7, [156, 92, 58]], [0.76, [236, 222, 196]], [0.84, [200, 164, 118]], [0.92, [224, 204, 174]], [1.0, [188, 168, 142]],
  ];
  const ramp = (vIn: number, out: [number, number, number]) => {
    const v = Math.min(1, Math.max(0, vIn));
    let i = 0; for (; i < stops.length - 2; i++) { const next = stops[i + 1]; if (!next || !(next[0] < v)) break; }
    const s0 = stops[i], s1 = stops[i + 1];
    if (!s0 || !s1) return;
    const [v0, c0] = s0, [v1, c1] = s1;
    const u = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
    const e = u * u * (3 - 2 * u) * 0.6 + u * 0.4; // soft-ish band edges
    out[0] = c0[0] + (c1[0] - c0[0]) * e; out[1] = c0[1] + (c1[1] - c0[1]) * e; out[2] = c0[2] + (c1[2] - c0[2]) * e;
  };
  const col: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W) * Math.PI * 2, v = y / H;
    const cu = Math.cos(u), su = Math.sin(u);
    // turbulence: seamless in u (circle), stretched along the bands
    const t1 = n.fbm(cu * 1.4 + v * 9.0, su * 1.4 + 3.0, 3);
    const t2 = n.get(cu * 4.0 + v * 22.0, su * 4.0 + 11.0);
    ramp(v + t1 * 0.035 + t2 * 0.008, col);
    const shade = 0.96 + 0.04 * n.get(cu * 3 + v * 30, su * 3 + 5);
    const i = (y * W + x) * 4; img.data[i] = col[0] * shade; img.data[i + 1] = col[1] * shade; img.data[i + 2] = col[2] * shade; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // storm ovals: a couple of rust spots and pale eddies riding the bands
  for (let i = 0; i < 14; i++) {
    const big = i < 2;
    g.globalAlpha = big ? 0.55 : 0.3;
    g.fillStyle = big ? '#b0603e' : i % 3 ? '#f4eee0' : '#a97a52';
    g.beginPath();
    g.ellipse(rng.next() * W, H * (0.2 + rng.next() * 0.6), big ? 22 + rng.next() * 14 : 8 + rng.next() * 16, big ? 9 + rng.next() * 4 : 2.5 + rng.next() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
