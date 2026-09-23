/**
 * The painted horizon of the low-poly shard (Driftwood Isle — DRIFTWOOD-REMASTER X4, the film matte-painting trick):
 * a 360° band of far sea stacks, distant islands with palms, cloud banks sitting on the sea and sea haze, painted with
 * codex image_gen over real in-game captures at six headings and stitched into one seamless strip
 * (`art/driftwood-isle/round-9-horizon/`). Day + moonlit night versions; the sky's own palette tints and hazes it.
 *
 *   const matte = new HorizonMatte(sky).build();   // null-safe: builds nothing unless the sky is the stylized one
 *   scene.add(matte.mesh);
 *   matte.load(horizon.group);                     // lazy, after boot; hides the islets it replaces once shown
 *   game.onUpdate((dt) => matte.update(dt, camera, dayNight?.night ?? 0));
 *
 * - **mesh**: one open cylinder (128 × 8 quads) of radius `RADIUS` that follows the camera on XZ and stays at sea level,
 *   so the painted horizon row lands on the ocean's own horizon from any eye height. Rows map linearly to elevation
 *   `EL_MIN` … `EL_MAX` (y = sea + R·tan e). Inside the camera's far plane (2600 m) up to the top edge.
 * - **draw**: unlit, fogless, transparent, depth-tested (terrain / props in front hide it) with no depth write;
 *   renderOrder −16 — after the dome (−20), before the cumulus (−15), the planet (−12 / −11) and the sea (4), so the 3D
 *   clouds and the planet stay in front and the sea covers everything below its own horizon line. One draw call.
 * - **look**: the day texture × the cumulus' lit colour relative to midday (golden hour warms it, dusk dims it), faded into
 *   the night texture by the clock's `night`, then hazed toward the dome's live horizon colour near the sea and lit by
 *   the sun glow — so it rides every DayNight preset without a third texture. The alpha fades into the sky at the top.
 * - **textures**: two 4096 × 512 WebPs with alpha (`public/assets/horizon/`), fetched after boot; the band fades in over
 *   ~1.5 s once both are decoded. `?matte=0` leaves it out (before / after captures).
 */
import * as THREE from 'three';
import type { Sky } from './Sky';
import { MIDDAY_SKY } from './StylizedSky';

/** the band's radius (m): inside the camera's far plane (2600) even at the top edge (R / cos 24° ≈ 2520) */
const RADIUS = 2300;
/** the elevation range the strip's rows cover, bottom → top (degrees, seen from the sea surface at RADIUS) */
const EL_MIN = -4, EL_MAX = 24;
const URL_DAY = '/assets/horizon/driftwood-isle-day.webp';
const URL_NIGHT = '/assets/horizon/driftwood-isle-night.webp';
const FADE_IN = 1.5;

export class HorizonMatte {
  mesh: THREE.Mesh | null = null;
  private fade = 0;
  private loaded = false;
  private ready = false;
  private readonly u = {
    tDay: { value: placeholder() },
    tNight: { value: placeholder() },
    uFade: { value: 0 },
    uNightMix: { value: 0 },
    uHorizon: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uSunGlow: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMiddayLit: { value: MIDDAY_SKY.cloudLit.clone() },
    uHorizonV: { value: -EL_MIN / (EL_MAX - EL_MIN) },
    uGain: { value: 1.1 },
    uNightGain: { value: 0.72 },  // the painted moonlight sits a little bright against the night dome
  };

  constructor(private sky: Sky, private seaLevel = 0) {}

  build(): this {
    const st = this.sky.stylized;
    if (!st || new URLSearchParams(location.search).get('matte') === '0') return this;
    // share the dome's live palette uniforms (DayNight writes them): read-only here
    this.u.uHorizon = st.u.uHorizon; this.u.uCloudLit = st.u.uCloudLit; this.u.uSunGlow = st.u.uSunGlow; this.u.uSunDir = st.u.uSunDir;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.BackSide,
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vW;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDay; uniform sampler2D tNight;
        uniform float uFade; uniform float uNightMix; uniform float uHorizonV; uniform float uGain; uniform float uNightGain;
        uniform vec3 uHorizon; uniform vec3 uCloudLit; uniform vec3 uSunGlow; uniform vec3 uSunDir; uniform vec3 uMiddayLit;
        varying vec2 vUv; varying vec3 vW;
        void main() {
          vec4 d = texture2D(tDay, vUv);
          vec4 n = texture2D(tNight, vUv);
          vec3 tint = clamp(uCloudLit / uMiddayLit, 0.0, 1.6);                 // golden hour warms, dusk dims the painted light
          vec3 col = mix(d.rgb * tint * uGain, n.rgb * uNightGain, uNightMix);
          float a = mix(d.a, n.a, uNightMix);
          float above = vUv.y - uHorizonV;                                      // 0 on the painted horizon line
          col = mix(col, uHorizon, mix(0.22, 0.4, uNightMix) * (1.0 - smoothstep(0.0, 0.2, above))); // sea haze melts the feet into the dome's horizon
          vec3 dir = normalize(vW - cameraPosition);
          float s = max(dot(dir, uSunDir), 0.0);
          col += uSunGlow * (pow(s, 8.0) * 0.3) * (1.0 - uNightMix * 0.7);       // the dome's sun glow reaches over the band
          a *= 1.0 - smoothstep(0.9, 0.99, vUv.y);                              // never a hard top edge (the key already fades it)
          a *= smoothstep(0.0, 0.05, vUv.y);                                    // nor a bottom one (the sea covers it anyway)
          gl_FragColor = vec4(col, a * uFade);
        }`,
    });
    mat.name = 'horizonMatte';
    const mesh = new THREE.Mesh(bandGeometry(), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -16; // visible from the start at alpha 0: its program compiles with the rest at boot, never mid-play
    mesh.name = 'horizon-matte';
    this.mesh = mesh;
    return this;
  }

  /**
   * fetch + decode both paintings off the critical path (call once boot is done); resolves when the band is shown.
   * `replaces`: geometry the painting stands in for (Horizon.ts' faceted islet rings), hidden as the band fades in —
   * it stays the fallback when the paintings fail to load or `?matte=0`.
   */
  async load(replaces?: THREE.Object3D): Promise<void> {
    if (!this.mesh || this.loaded) return;
    this.loaded = true;
    try {
      const [day, night] = await Promise.all([loadTexture(URL_DAY), loadTexture(URL_NIGHT)]);
      this.u.tDay.value = day; this.u.tNight.value = night;
      this.ready = true;
      if (replaces) replaces.visible = false;
    } catch (e) {
      console.warn('[horizon-matte] paintings not loaded; the band stays off', e);
    }
  }

  /** every frame: follow the camera on XZ, fade in, set the day / night mix (0 = day … 1 = night) */
  update(dt: number, camera: THREE.Camera, night: number): void {
    const m = this.mesh;
    if (!m) return;
    m.position.set(camera.position.x, this.seaLevel, camera.position.z);
    if (this.ready && this.fade < 1) { this.fade = Math.min(1, this.fade + dt / FADE_IN); this.u.uFade.value = this.fade * this.fade * (3 - 2 * this.fade); }
    this.u.uNightMix.value = night;
  }
}

/** an open cylinder, u = azimuth (0 → +X, 0.25 → +Z), v = elevation EL_MIN → EL_MAX; viewed from inside */
function bandGeometry(): THREE.BufferGeometry {
  const SEG = 128, ROWS = 8, d2r = Math.PI / 180;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r <= ROWS; r++) {
    const v = r / ROWS;
    const y = RADIUS * Math.tan((EL_MIN + (EL_MAX - EL_MIN) * v) * d2r);
    for (let s = 0; s <= SEG; s++) {
      const u = s / SEG, a = u * Math.PI * 2;
      pos.push(Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS);
      uv.push(u, v);
    }
  }
  for (let r = 0; r < ROWS; r++) for (let s = 0; s < SEG; s++) {
    const a = r * (SEG + 1) + s, b = a + 1, c = a + SEG + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function placeholder(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  t.needsUpdate = true;
  return t;
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;           // the strip is seamless at the 0 / 360° wrap
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
