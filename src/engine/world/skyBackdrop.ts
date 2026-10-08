import { publicBytes } from '../boot/tables';
import * as THREE from 'three';
import type { Renderer } from '../render/renderer';
import type { Scope } from '../app/scope';
import type { SkyRig as Sky } from './skyRig';
import type { SkySpec } from '../level/data';
import type { LevelSpec } from '../level/spec';
import type { SkyDressing } from '../render/look';
import { Noise2D } from '../core/noise';
import { Rng } from '../core/rng';
import { loadHDR } from '../core/assets';
import { bakedTexture, preloadBakedTextures } from '../boot/bakedTextures';
import { bakedSkyUrls, loadBakedSky as loadSkyPair } from './BakedSky';
import { macrotask } from '../boot/plan';
import { loadLUT } from './lut';
import type { LookupTexture } from 'postprocessing';

export const PLANET_DIST = 1700;

/** public/assets/baked/<slug>/sky.json — the HDR's sun direction and horizon colour, scanned at build time (scripts/bake-sky.mjs). */
async function loadBakedSky(levelId: string, hdri: string): Promise<{ sunDir: [number, number, number]; horizon: [number, number, number] } | null> {
  const url = `/assets/baked/${levelId}/sky.json`;
  if (!(url in publicBytes()) || new URLSearchParams(location.search).has('nobake')) return null;
  try {
    const j = await (await fetch(url)).json() as { hdri: string; sunDir: [number, number, number]; horizon: [number, number, number] };
    return j.hdri === hdri ? j : null; // a different HDRI than the bake saw → scan at launch
  } catch { return null; }
}

/** The default background and visible sky pieces, independent of the lighting/shadow rig. */
export class SkyBackdropView {
  sunDisc!: THREE.Mesh;
  sunHalo: THREE.Sprite | null = null;
  readonly planet = new THREE.Group();
  readonly planetDir = new THREE.Vector3(-0.75, 0.33, 0.55).normalize();
  clouds: THREE.Object3D | null = null;
  lut: LookupTexture | null = null;
  private level!: LevelSpec;
  private dressing: SkyDressing | null = null;
  private readonly scene: THREE.Scene;
  private readonly renderer: Renderer;
  private readonly scope: Scope;
  private readonly sky: Sky;
  constructor(scene: THREE.Scene, renderer: Renderer, scope: Scope, sky: Sky) {
    this.scene = scene;
    this.renderer = renderer;
    this.scope = scope;
    this.sky = sky;
  }
  private get sunDir(): THREE.Vector3 { return this.sky.sunDir; }
  private setupMaterial(material: THREE.Material): void { this.sky.setupMaterial(material); }
  configure(level: LevelSpec, dressing: SkyDressing | null): void { this.level = level; this.dressing = dressing; }
  attachClouds(clouds: THREE.Object3D): void { this.clouds = clouds; if (clouds.parent !== this.scene) this.scene.add(clouds); }
  /** uCloudLit / uCloudAlpha: the lit / shade tint and the cover's opacity (the forest clock's clock turns them; 1 = the fixed sky) */
  readonly cloudUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uLight: { value: new THREE.Color(1, 1, 1) }, uCloudLit: { value: new THREE.Color(1, 1, 1) }, uCloudAlpha: { value: 1 } };

  /** the default rig (no backdrop): the HDRI is the background and the IBL; returns the fog colour. */
  async setupHDRI(): Promise<THREE.Color> {
    const { sky: S, id } = this.level;
    const hdriName = S.hdri;
    if (hdriName === undefined) throw new Error('Sky: the HDRI rig needs level.sky.hdri');
    // baked procedural textures (clouds, fur…) and the baked sun / horizon (scripts/bake-sky.mjs) ride along with the HDR
    // the HDR itself: the gain-mapped JPEG + PNG pair (~0.3 MB, BakedSky.ts) when the build has it, else the 4–5 MB .hdr
    const pair = bakedSkyUrls(hdriName);
    const hdrUrl = `/assets/hdri/${hdriName}_2k.hdr`;
    // `ChunkSky.sun` places the sun by hand; `ChunkSky.painted` paints the whole sky around it (nothing downloaded)
    if (S.sun) this.sunDir.copy(compassDir(S.sun.azimuth, S.sun.elevation));
    const painted = S.painted ?? null;
    const loadSky = painted ? Promise.resolve(paintSky(painted, this.sunDir))
      : pair ? loadSkyPair(pair).catch((e: unknown) => { console.warn(`[sky] gain-mapped pair not used (${String(e)}); loading the .hdr`); return loadHDR(hdrUrl); }) : loadHDR(hdrUrl);
    const [hdr, , baked, lut] = await Promise.all([loadSky, preloadBakedTextures(), painted ? Promise.resolve(null) : loadBakedSky(id, hdriName), loadLUT(id)]);
    this.lut = lut; // the level's learned LUT (lut.ts): no file, no fetch, no pass
    if (!S.sun) { if (baked) this.sunDir.fromArray(baked.sunDir).normalize(); else this.findSun(hdr); }
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
    this.scene.environmentIntensity = S.envIntensity;
    this.scene.background = hdr;
    this.scene.backgroundIntensity = S.bgIntensity;
    this.scene.backgroundBlurriness = 0.0;

    // Fog colour = average of the sky just above the horizon in the view direction
    return baked ? new THREE.Color(...baked.horizon) : this.sampleHorizon(hdr);
  }

  rebuildEnvironment(): void {
    const hdr = this.scene.background;
    if (!(hdr instanceof THREE.Texture)) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
  }
  private cloudTex: THREE.Texture | null = null;
  /**
   * The engine's tileable cloud fbm (R): the one the page's cloud layer or dressing was built with, else made once and
   * freed with the sky's scope (SF63: a grid region's sky dressing builds on it, `render/regionLook.ts`).
   */
  cloudField(): THREE.Texture {
    if (this.cloudTex !== null) return this.cloudTex;
    const tex = bakedTexture('clouds', makeCloudTexture);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
    this.scope.onDispose(() => { tex.dispose(); });
    this.cloudTex = tex;
    return tex;
  }
  /** Thin procedural cirrus/cumulus layer on a sky dome — the HDRI has none, and a forest needs a sky with some drama. */
  buildClouds(): void {
    const dressing = this.dressing;
    if (dressing !== null && !dressing.clouds && dressing.build === undefined) return; // no layer and no cloud field asked for
    const geo = new THREE.SphereGeometry(1400, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const tex = bakedTexture('clouds', makeCloudTexture); // 512² six-octave simplex on a torus: ~200 ms of phone CPU when not baked
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.cloudTex = tex;
    if (dressing !== null) {
      // a level's own sky (LookStrategy.sky): the cloud fbm is its to use (a painted sky's cloud shadows); `clouds: false` = no layer
      tex.needsUpdate = true;
      dressing.build?.(this.sky, tex);
      if (!dressing.clouds) return;
    }
    // a painted sky (a painted sky) gets big painted cumulus: larger cells, crisper edges, bright sunlit tops over soft blue-grey bellies
    const big = this.level.sky.painted ? 1.0 : 0.0;
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunColor.value.set(...this.level.sky.cloudSunColor);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.cloudUniforms, tClouds: { value: tex }, uBig: { value: big } },
      transparent: true, depthWrite: false, side: THREE.BackSide,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tClouds; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uBig; uniform vec3 uLight; uniform vec3 uCloudLit; uniform float uCloudAlpha;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < 0.02) discard;
          // project onto a flat cloud plane at height ~1 for a believable perspective
          vec2 p = d.xz / (d.y + 0.15);
          vec2 uv = p * mix(0.5, 0.26, uBig) + vec2(uTime * 0.004, uTime * 0.002);
          float a = texture2D(tClouds, uv).r;
          float b = texture2D(tClouds, uv * mix(3.1, 2.2, uBig) + vec2(-uTime * 0.006, uTime * 0.003)).r;
          float dens = a * mix(0.7, 0.82, uBig) + b * mix(0.3, 0.18, uBig);
          float cover = mix(smoothstep(0.52, 0.8, dens), smoothstep(0.55, 0.6, dens), uBig);
          float horizon = smoothstep(0.02, 0.22, d.y);
          float sunAmt = max(dot(d, uSunDir), 0.0);
          vec3 lit = mix(vec3(0.62, 0.66, 0.74), vec3(1.0, 0.94, 0.86), smoothstep(0.3, 0.9, a));
          // painted cumulus: the belly (thin, low density) blue-grey, the piled-up tops bright, the sun side warm
          float top = smoothstep(0.56, 0.78, dens) * (0.6 + 0.4 * smoothstep(0.4, 0.8, b));
          vec3 painted = mix(vec3(0.66, 0.74, 0.9), vec3(1.25, 1.22, 1.18), top);
          lit = mix(lit, painted, uBig);
          lit = mix(lit, uSunColor * 1.3, pow(sunAmt, 6.0) * 0.6) * uCloudLit;
          float alpha = cover * horizon * mix(0.85, 0.97, uBig) * uCloudAlpha;
          gl_FragColor = vec4(lit * uLight, alpha);
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

  buildSunDisc(): void {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.95, 0.85), fog: false, toneMapped: false });
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 24), mat);
    // three uploads visible mesh geometry before checking material.visible. Hide the object itself.
    // E398: a disc that is off can stay on as the god rays' source only (`sun.rays`): out of the scene, so never drawn
    const rays = this.dressing?.sun?.disc === false ? this.dressing.sun.rays : undefined;
    const raysOnly = rays !== undefined && rays !== false;
    if (typeof rays === 'object') this.raysDir = compassDir(rays.azimuth, rays.elevation);
    this.sunDisc.visible = this.dressing?.sun?.disc !== false || raysOnly;
    this.sunDisc.position.copy(this.sunDir).multiplyScalar(1500);
    this.sunDisc.frustumCulled = false;
    // soft corona so the disc reads as a glowing sun rather than a white ball
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = ctx2d(c);
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,240,210,0.9)'); grad.addColorStop(0.12, 'rgba(255,210,150,0.55)'); grad.addColorStop(0.4, 'rgba(255,170,90,0.12)'); grad.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    halo.scale.setScalar(this.level.sky.painted ? 250 : 420); // a painted sun: a tighter glow (the mockups keep the sky blue right up to it)
    halo.scale.z = 1;
    halo.visible = this.dressing?.sun?.halo !== false;
    this.sunHalo = halo;
    // the practice room (src/engine/practice/TrainingArena.ts) is a closed box: there its ceiling must hide the glow (E285)
    this.scope.listen(document, 'ws:practice-active', (e) => { if (e instanceof CustomEvent) halo.material.depthTest = e.detail === true; });
    // Keep the original hierarchy for default skies. A halo without a disc must escape its hidden parent.
    if ((!this.sunDisc.visible || raysOnly) && halo.visible) {
      halo.position.copy(this.sunDisc.position);
      this.scene.add(halo);
    } else this.sunDisc.add(halo);
    // a rays-only disc stays parentless: GodRaysEffect draws it in its own light scene and leaves it there
    if (!raysOnly) this.scene.add(this.sunDisc);
  }

  /** the god rays' source direction when it is not the light's sun (`sun.rays: { azimuth, elevation }`, E398); null = the sun */
  raysDir: THREE.Vector3 | null = null;

  /** Only the independently selected halo needs a separate infinite-distance placement. */
  updateSunHalo(camera: THREE.PerspectiveCamera): void {
    if (this.sunHalo?.parent === this.scene) this.sunHalo.position.copy(camera.position).addScaledVector(this.sunDir, 1500);
  }

  /** the 16 Sep ringed planet's materials and their built opacities (the forest clock's clock fades them, fadePlanet) */
  private planetFade: { m: THREE.Material; base: number }[] = [];
  /** A clock can fade the ringed planet with night; fixed skies keep their original opacity. */
  fadePlanet(night: number): void {
    const k = Math.min(1, Math.max(0, night));
    this.planet.visible = k > 0.01;
    for (const { m, base } of this.planetFade) m.opacity = base * k;
  }

  buildPlanet(): void {
    if (this.dressing?.planet === false) return; // the level's sky dressing paints its own
    const P = this.level.sky.planet;
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
    this.planetFade = [{ m: body.material, base: body.material.opacity }, { m: ring.material, base: ring.material.opacity }];
    this.planet.position.copy(dir).multiplyScalar(dist);
    this.planet.lookAt(0, 0, 0);
    this.planet.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(this.planet);
  }

  /**
   * `ChunkSky.planet`: a banded gas giant with a thin bright ring on the sky where the def puts it
   * (the island look). Two transparent, fogless, depth-write-free meshes in `this.planet` (Game.ts
   * keeps the group `PLANET_DIST` along `planetDir` from the camera): the body is a sphere shaded in
   * its own shader — band texture wrapped about the ring axis, soft terminator from the sun's side,
   * limb darkening and sky-haze at the limb so it sits *in* the sky like the mockups — and the ring
   * an annulus whose shader hides the part behind the body and darkens the body's shadow on it.
   */
  private buildGasGiant(P: NonNullable<SkySpec['planet']>) {
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
    if (this.level.sky.painted) { this.giantUniforms.uHazeAmt.value = 0.22; this.giantUniforms.uGain.value = 1.5; this.giantUniforms.uFar.value = 1; }
    this.giantUniforms.uCrisp.value = 0; // a backdrop may set 1 (a crisp, opaque disc) when it binds

    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.ShaderMaterial({
      uniforms: { ...this.giantUniforms, tBands: { value: bands } },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vW; uniform float uFar;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
          if (uFar > 0.5) gl_Position.z = gl_Position.w * 0.9999; // behind every range and cloud (the painterly sky)
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tBands; uniform vec3 uSunDir; uniform vec3 uHaze; uniform vec3 uAxis; uniform float uTime; uniform vec3 uLight; uniform float uOpacity; uniform float uHazeAmt; uniform float uGain; uniform float uCrisp;
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
          float mu = clamp(dot(N, V), 0.0, 1.0);                // ≤ 1: pow(1 − mu) below must never see a negative (NaN → bloom black square, E91)
          float day = smoothstep(-0.35, 0.3, dot(N, uSunDir));   // a wide soft terminator: the disc reads bright, with a shaded crescent
          float limb = 0.45 + 0.55 * mu;                       // limb darkening
          vec3 lit = col * (0.24 + 0.95 * day) * limb + col * vec3(0.05, 0.08, 0.14) * (1.0 - day); // a little sky bounce on the night side
          // sky haze: the disc is pale and airy, more so at the limb (it sits in the atmosphere, not in front of it)
          float h = (0.1 + 0.45 * pow(1.0 - mu, 2.4)) * uHazeAmt * (1.0 - 0.7 * uCrisp);   // uCrisp (the stylized sky): a crisp, opaque disc
          vec3 c = mix(lit * uGain, uHaze, h);
          gl_FragColor = vec4(c * uLight, mix(0.92 - 0.25 * pow(1.0 - mu, 3.0), 1.0, uCrisp) * uOpacity);
        }`,
    }));
    body.renderOrder = -12;

    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.38, R * 2.08, 160, 1), new THREE.ShaderMaterial({
      uniforms: { ...this.giantUniforms },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec2 vL; varying vec3 vC; uniform float uFar;
        void main() {
          vL = position.xy;
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
          vC = modelMatrix[3].xyz;                      // the planet's centre (the ring sits at the group origin)
          gl_Position = projectionMatrix * viewMatrix * w;
          if (uFar > 0.5) gl_Position.z = gl_Position.w * 0.9999;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir; uniform vec3 uHaze; uniform vec3 uAxis; uniform float uRadius; uniform vec3 uLight; uniform float uOpacity; uniform float uHazeAmt; uniform float uGain; uniform float uCrisp;
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
          vec3 col = vec3(0.98, 0.95, 0.88) * (0.45 + 0.9 * lit) * bright * uGain;
          col = mix(col, uHaze, 0.2 * uHazeAmt * (1.0 - 0.6 * uCrisp));
          gl_FragColor = vec4(col * uLight, a * mix(0.8, 0.95, uCrisp) * uOpacity);
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
  /** uHazeAmt / uGain / uFar: the island look's giant is 1 / 1 / 0; a `ChunkSky.painted` sky draws it brighter, clearer and at the far plane (behind the ranges); uCrisp: the stylized (low-poly) sky's crisp, opaque disc */
  readonly giantUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uHaze: { value: new THREE.Color() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uRadius: { value: 1 }, uLight: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 1 }, uHazeAmt: { value: 1 }, uGain: { value: 1 }, uFar: { value: 0 }, uCrisp: { value: 0 } };
}

/** compass degrees (0 = north = +Z, 90 = east = −X) + elevation → a unit direction (the `ChunkSky.planet` convention) */
function compassDir(azimuth: number, elevation: number): THREE.Vector3 {
  const d2r = Math.PI / 180, az = azimuth * d2r, el = elevation * d2r;
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

/**
 * `ChunkSky.painted`: a small equirectangular half-float sky in the HDR's layout (row 0 = the top, flipY, the same
 * u/v → direction mapping `findSun` reads) — zenith → horizon gradient, a soft warm glow and a hot core round the
 * sun, the ground colour below the skyline. It is the background and the PMREM environment, so it replaces the
 * HDRI entirely (~2 ms to paint, nothing to download).
 */
function paintSky(P: NonNullable<SkySpec['painted']>, sun: THREE.Vector3): THREE.DataTexture {
  const W = 512, H = 256;
  const data = new Uint16Array(W * H * 4);
  const [zr, zg, zb] = P.zenith, [hr, hg, hb] = P.horizon, [gr, gg, gb] = P.ground, [wr, wg, wb] = P.glow;
  const half = (v: number): number => THREE.DataUtils.toHalfFloat(v);
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H, phi = (v - 0.5) * Math.PI;
    const cp = Math.cos(phi), e = Math.sin(phi);
    for (let x = 0; x < W; x++) {
      const theta = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
      const dx = Math.cos(theta) * cp, dz = Math.sin(theta) * cp;
      const g = Math.max(0, dx * sun.x + e * sun.y + dz * sun.z);
      let r: number, gg2: number, b: number;
      if (e >= 0) {
        const t = THREE.MathUtils.smoothstep(e ** 0.55, 0, 1);
        r = hr + (zr - hr) * t; gg2 = hg + (zg - hg) * t; b = hb + (zb - hb) * t;
        // the horizon is warmer on the sun's side, and a soft wide glow + a hot core surround the disc
        const side = (Math.max(0, dx * sun.x + dz * sun.z) / Math.max(1e-3, Math.hypot(sun.x, sun.z))) ** 2 * (1 - t) * 0.35;
        const glow = g ** 6 * 0.45 + g ** 48 * 1.6 + side;
        r += wr * glow; gg2 += wg * glow; b += wb * glow;
      } else {
        const t = THREE.MathUtils.smoothstep(-e, 0, 0.12);
        r = hr * 0.85 + (gr - hr * 0.85) * t; gg2 = hg * 0.85 + (gg - hg * 0.85) * t; b = hb * 0.85 + (gb - hb * 0.85) * t;
      }
      const i = (y * W + x) * 4;
      data[i] = half(r); data[i + 1] = half(gg2); data[i + 2] = half(b); data[i + 3] = half(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.flipY = true; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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
