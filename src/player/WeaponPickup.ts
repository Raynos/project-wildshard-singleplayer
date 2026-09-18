import * as THREE from 'three';
import type { Interactable } from '../world/Cabin';

/**
 * ItemPickup (exported as WeaponPickup too) — an item lying in the world for the player to find, presented like
 * art/pickup-A-bubble.png: the item floats HOVER m over the floor point, tilted ~20°, turning slowly, inside a
 * translucent sphere (SPHERE_R × 2 ≈ 0.9 m Ø) with a thin bright Fresnel rim and a soft inner glow, ~MOTES tiny motes
 * drifting upward inside it, and a light pool on the floor (a fading disc + a short-range PointLight).
 *
 *   const drop = new WeaponPickup({ scene, item: rifle.displayModel(), position: floorPoint, tier: 'common', prompt: 'Take AR-15' });
 *   interactables.push(drop.interactable);   // the door / harvest prompt path shows "[E] Take AR-15" within `radius`
 *   drop.onPickup = () => { weapons.unlock('rifle'); … };
 *   game.onUpdate((dt, t) => drop.update(dt, t, game.renderer, game.camera));
 *
 * `tier` sets the colour — the user's rule: BLUE (#8fe3ff) orb = items, PURPLE (#c38fff) orb = rare skins — the same
 * effect otherwise, so the rare-skins pickups reuse this class. Picking it up (E / USE → `take()`): the item vanishes,
 * the sphere bursts (scales up and fades over BURST_TIME s) and the motes scatter, then everything is removed;
 * `interactable.radius` drops to 0 at once so the prompt loop never picks it again. `dispose()` removes + frees it.
 */

export type PickupTier = 'common' | 'rare';
export const TIER_COLOUR: Record<PickupTier, number> = { common: 0x8fe3ff, rare: 0xc38fff };

export interface ItemPickupOptions {
  scene: THREE.Scene;
  /** the world-space model (origin near its centre; the AR-15's `displayModel()`) */
  item: THREE.Object3D;
  /** the floor point under the orb */
  position: THREE.Vector3;
  tier?: PickupTier;
  /** the interact prompt after "[E]" ("Take AR-15") */
  prompt?: string;
  /** interact radius (m, measured from the eye to a point a little above the item) */
  radius?: number;
  /** item tilt (rad, muzzle / tip up) and scale */
  tilt?: number; scale?: number;
}

const HOVER = 0.5, BOB = 0.04, BOB_RATE = 1.3, YAW_RATE = THREE.MathUtils.degToRad(20);
const SPHERE_R = 0.46, POOL_R = 0.62, MOTES = 30, BURST_TIME = 0.32, MODEL_SCALE = 1.15, TILT = THREE.MathUtils.degToRad(20);
const RENDER_ORDER = 20; // after the world's transparents (mist, halos), before the viewmodel's depth clear (999)

const SPHERE_VERT = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
    gl_Position = projectionMatrix * mv;
  }`;
const SPHERE_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform float uRim;
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 5.0) * uRim;                          // thin bright edge
    float fill = 0.045 + 0.02 * sin(uTime * 1.7 + vY * 6.0); // soft inner haze, breathing
    float band = smoothstep(0.02, 0.0, abs(fract(vY * 1.3 - uTime * 0.12) - 0.5) - 0.48) * 0.08; // a faint scanline drifting up
    gl_FragColor = vec4(uColor * (rim + fill + band), uAlpha);
  }`;
const MOTE_VERT = /* glsl */`
  attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
  void main() { vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`;
const MOTE_FRAG = /* glsl */`
  uniform vec3 uColor; varying float vA;
  void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; float a = (1.0 - r) * (1.0 - r) * vA; gl_FragColor = vec4(uColor * (0.6 + a), a); }`;

/** radial light pool: bright centre fading to nothing at the edge */
function makePoolTexture(): THREE.CanvasTexture {
  const S = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.35, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let poolTex: THREE.CanvasTexture | null = null;

const _size = new THREE.Vector2();

export class ItemPickup {
  readonly group = new THREE.Group();
  readonly interactable: Interactable;
  readonly tier: PickupTier;
  onPickup?: () => void;
  taken = false;
  private scene: THREE.Scene;
  private holder = new THREE.Group();
  private sphere: THREE.Mesh; private sphereMat: THREE.ShaderMaterial;
  private motes: THREE.Points; private moteMat: THREE.ShaderMaterial;
  private motePos: Float32Array; private moteVel: Float32Array; private moteAlpha: Float32Array; private moteLife: Float32Array;
  private pool: THREE.Mesh; private poolMat: THREE.MeshBasicMaterial;
  private light: THREE.PointLight;
  private burstT = -1;
  private phase = Math.random() * 6;
  private disposed = false;

  constructor(opts: ItemPickupOptions) {
    this.scene = opts.scene;
    this.tier = opts.tier ?? 'common';
    const colour = new THREE.Color(TIER_COLOUR[this.tier]);
    this.group.position.copy(opts.position);
    // the item: tilted (muzzle / tip up), a little over life size, spun by the holder
    const item = opts.item;
    item.rotation.x = opts.tilt ?? TILT; item.rotation.z = 0.12;
    item.scale.setScalar(opts.scale ?? MODEL_SCALE);
    this.holder.add(item);
    this.holder.position.y = HOVER;
    // the sphere: Fresnel rim + soft haze, additive, no depth write so the item inside and the wall behind show through
    this.sphereMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: colour }, uTime: { value: 0 }, uAlpha: { value: 1 }, uRim: { value: 1.0 } },
      vertexShader: SPHERE_VERT, fragmentShader: SPHERE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R, 40, 28), this.sphereMat);
    this.sphere.position.y = HOVER; this.sphere.renderOrder = RENDER_ORDER + 1;
    // motes: MOTES soft points drifting up inside the sphere, respawning at the bottom
    const g = new THREE.BufferGeometry();
    this.motePos = new Float32Array(MOTES * 3); this.moteVel = new Float32Array(MOTES * 3); this.moteAlpha = new Float32Array(MOTES); this.moteLife = new Float32Array(MOTES);
    const sizes = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) { this.spawnMote(i, true); sizes[i] = 0.022 + Math.random() * 0.022; }
    g.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.moteAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, HOVER, 0), SPHERE_R * 3);
    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: colour }, uScale: { value: 400 } },
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(g, this.moteMat);
    this.motes.renderOrder = RENDER_ORDER + 2;
    // light pool on the floor + a short-range point light
    poolTex ??= makePoolTexture();
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: colour, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(POOL_R * 2, POOL_R * 2), this.poolMat);
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.y = 0.012; this.pool.renderOrder = RENDER_ORDER;
    this.light = new THREE.PointLight(colour, 3, 3.2, 2);
    this.light.position.y = HOVER;
    this.group.add(this.holder, this.sphere, this.motes, this.pool, this.light);
    this.scene.add(this.group);
    // the prompt loop measures from the CAMERA (eye height): the interact point sits a little above the item so the
    // radius reads as ground distance, like the door's `FLOOR + 1.0` point
    const radius = opts.radius ?? 1.8;
    this.interactable = { position: new THREE.Vector3(opts.position.x, opts.position.y + HOVER + 0.6, opts.position.z), radius, label: opts.prompt ?? 'Take item', onInteract: () => this.take() };
  }

  /** the prompt text after "[E]" */
  get prompt() { return this.interactable.label; }
  set prompt(v: string) { this.interactable.label = v; }

  private spawnMote(i: number, anywhere: boolean) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * SPHERE_R * 0.85;
    this.motePos[i * 3] = Math.cos(a) * r;
    this.motePos[i * 3 + 1] = HOVER + (anywhere ? (Math.random() - 0.5) * 2 : -0.8) * SPHERE_R * 0.9;
    this.motePos[i * 3 + 2] = Math.sin(a) * r;
    this.moteVel[i * 3] = (Math.random() - 0.5) * 0.04; this.moteVel[i * 3 + 1] = 0.05 + Math.random() * 0.07; this.moteVel[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    this.moteLife[i] = Math.random();
  }

  /** pick it up: the item vanishes, the orb bursts, `onPickup` fires; a no-op the second time */
  take() {
    if (this.taken) return;
    this.taken = true;
    this.interactable.radius = 0;
    this.holder.visible = false;
    this.burstT = 0;
    for (let i = 0; i < MOTES; i++) { // scatter
      const dx = this.motePos[i * 3], dz = this.motePos[i * 3 + 2], dy = this.motePos[i * 3 + 1] - HOVER, l = Math.hypot(dx, dy, dz) || 1;
      this.moteVel[i * 3] = (dx / l) * 2.5; this.moteVel[i * 3 + 1] = (dy / l) * 2.5 + 0.8; this.moteVel[i * 3 + 2] = (dz / l) * 2.5;
    }
    this.onPickup?.();
  }

  /** remove it from the scene and free its GPU resources (also used by `?weapon=rifle`, which unlocks the rifle at load) */
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.taken = true; this.interactable.radius = 0;
    this.scene.remove(this.group);
    this.sphere.geometry.dispose(); this.sphereMat.dispose(); this.motes.geometry.dispose(); this.moteMat.dispose(); this.pool.geometry.dispose(); this.poolMat.dispose();
  }

  update(dt: number, t: number, renderer?: THREE.WebGLRenderer, camera?: THREE.PerspectiveCamera) {
    if (this.disposed) return;
    if (renderer && camera) { renderer.getDrawingBufferSize(_size); this.moteMat.uniforms.uScale.value = _size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); }
    const tt = t + this.phase;
    this.sphereMat.uniforms.uTime.value = tt;
    if (this.burstT >= 0) {
      this.burstT += dt;
      const p = Math.min(1, this.burstT / BURST_TIME);
      this.sphere.scale.setScalar(1 + p * 1.6);
      this.sphereMat.uniforms.uAlpha.value = 1 - p; this.sphereMat.uniforms.uRim.value = 2.0 * (1 - p);
      this.poolMat.opacity = 0.9 * (1 - p);
      this.light.intensity = 9 * (1 - p);
      this.stepMotes(dt, true);
      if (p >= 1) this.dispose();
      return;
    }
    this.holder.position.y = HOVER + Math.sin(tt * BOB_RATE) * BOB;
    this.holder.rotation.y += YAW_RATE * dt;
    this.sphereMat.uniforms.uRim.value = 0.95 + Math.sin(tt * 2.2) * 0.15; // the post chain tone-maps: brighter than ~1 washes the rim white
    this.poolMat.opacity = 0.5 + Math.sin(tt * 2.2) * 0.08;
    this.light.intensity = 2.8 + Math.sin(tt * 2.2) * 0.5;
    this.stepMotes(dt, false);
  }

  private stepMotes(dt: number, scatter: boolean) {
    const pos = this.motePos, vel = this.moteVel;
    for (let i = 0; i < MOTES; i++) {
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (scatter) { this.moteAlpha[i] = Math.max(0, this.moteAlpha[i] - dt * 2.5); continue; }
      this.moteLife[i] += dt * 0.25;
      const y = (pos[i * 3 + 1] - HOVER) / SPHERE_R; // -1 … 1 inside the orb
      this.moteAlpha[i] = 0.9 * Math.max(0, 1 - y * y) * Math.min(1, this.moteLife[i] * 4);
      if (y > 0.95 || Math.hypot(pos[i * 3], pos[i * 3 + 2]) > SPHERE_R * 0.95) this.spawnMote(i, false);
    }
    (this.motes.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.motes.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** the AR-15 was the first item; main.ts constructs it under this name */
export const WeaponPickup = ItemPickup;
export type WeaponPickup = ItemPickup;
