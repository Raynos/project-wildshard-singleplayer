import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Interactable } from '../world/Cabin';

/**
 * ItemPickup (exported as WeaponPickup too) — an item lying in the world for the player to find, presented like
 * art/pickup-A-bubble.png and then some: the item floats HOVER m over the floor point (bobbing ±BOB on a BOB_PERIOD sine,
 * yawing YAW_RATE), inside a translucent sphere (SPHERE_R × 2 = 1.3 m Ø) with a bright Fresnel rim and an inner haze that
 * BREATHE (±25 % on a PULSE_PERIOD cycle, out of phase with the bob); two thin rings orbit the sphere on tilted axes,
 * counter-rotating; a sigil (crisp ring + faint outer ring with 24 ticks) turns slowly on the floor under a soft light
 * pool; MOTES motes spiral upward around the sphere on helices with short fading trails, one in eight a bright spark
 * that flashes; a PointLight lights the item and the room and the item itself carries a faint tier-coloured emissive.
 *
 * Approach: within NEAR_DIST the pulse runs ×NEAR_PULSE and the rings tilt toward the player; within the prompt radius
 * the rim goes ×1.5 and `onNear(true)` fires (main.ts → `audio.pickupHum(true)`), `onNear(false)` on leaving.
 * Pickup (E / USE → `take()`): the sphere collapses inward over COLLAPSE_TIME, then a shockwave ring (r 0.2 → 2.5 m over
 * SHOCK_TIME), BURST_MOTES motes flung outward under gravity and a ×3 light flash; then everything is removed.
 *
 *   const drop = new WeaponPickup({ scene, item: rifle.displayModel(), position: floorPoint, tier: 'common', prompt: 'Take AR-15' });
 *   interactables.push(drop.interactable);   // the door / harvest prompt path shows "[E] Take AR-15" within `radius`
 *   drop.onPickup = () => { weapons.unlock('rifle'); … };  drop.onNear = (on) => audio.pickupHum(on);
 *   game.onUpdate((dt, t) => drop.update(dt, t, game.renderer, game.camera));
 *
 * `tier` sets the colour — the user's rule: BLUE (#8fe3ff) orb = items, PURPLE (#c38fff) orb = rare skins — the same
 * effect otherwise, so the rare-skins pickups reuse this class. Everything is tone-mapped by the post chain (AgX in the
 * composer, so a material's `toneMapped` flag does nothing): the orb uses a deeper cyan than the HUD's #8fe3ff so it
 * survives the mapping. Cheap on purpose: every sprite (motes + trails + burst) lives in ONE Points, the rings share one
 * material, the sigil is one merged geometry, and the update loop allocates nothing.
 */

export type PickupTier = 'common' | 'rare';
export const TIER_COLOUR: Record<PickupTier, number> = { common: 0x8fe3ff, rare: 0xc38fff };
/** the orb's own colour: the tier colour pushed toward saturation — the post chain's AgX tone map washes a bright
 *  #8fe3ff to white, a deeper cyan / violet at the same energy stays cyan / violet */
const ORB_COLOUR: Record<PickupTier, number> = { common: 0x35d4ff, rare: 0xa862ff };

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

const SPHERE_R = 0.65, HOVER = 0.78;
const BOB = 0.06, BOB_PERIOD = 2.2, YAW_RATE = THREE.MathUtils.degToRad(25);
const PULSE_PERIOD = 1.6, PULSE_DEPTH = 0.25, PULSE_PHASE = 0.9; // breathing, out of phase with the bob
const RIM = 3.0, HAZE = 0.18, LIGHT = 8, LIGHT_DIST = 4, ITEM_EMISSIVE = 0.15;
const MODEL_SCALE = 1.15, TILT = THREE.MathUtils.degToRad(20);
const RING_R = SPHERE_R + 0.03, RING_TUBE = 0.004, RING_TILT = [THREE.MathUtils.degToRad(23), THREE.MathUtils.degToRad(-41)], RING_RATE = [THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(-65)];
const SIGIL_R = 0.55, SIGIL_OUTER_R = 0.8, SIGIL_TICKS = 24, SIGIL_RATE = THREE.MathUtils.degToRad(8), POOL_R = 0.9;
const MOTES = 60, TRAIL = 3, TRAIL_DT = 0.055, SPARK_EVERY = 8, BURST_MOTES = 80;
const NEAR_DIST = 3.5, NEAR_PULSE = 1.8, NEAR_TILT = 0.55;
const COLLAPSE_TIME = 0.12, SHOCK_TIME = 0.35, SHOCK_R0 = 0.2, SHOCK_R1 = 2.5, FLASH_TIME = 0.15, BURST_LIFE = 1.1;
const RENDER_ORDER = 20; // after the world's transparents (mist, halos), before the viewmodel's depth clear (999)
const SPRITES = MOTES * (1 + TRAIL) + BURST_MOTES;

const SPHERE_VERT = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
    gl_Position = projectionMatrix * mv;
  }`;
const SPHERE_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform float uRim; uniform float uHaze;
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 3.5) * uRim;                                   // bright edge, a little wider than a hairline
    float fill = uHaze * (0.85 + 0.15 * sin(uTime * 1.7 + vY * 6.0)); // inner haze, breathing
    float band = smoothstep(0.02, 0.0, abs(fract(vY * 1.3 - uTime * 0.12) - 0.5) - 0.48) * 0.08; // a faint scanline drifting up
    gl_FragColor = vec4(uColor * (rim + fill + band), uAlpha);
  }`;
const MOTE_VERT = /* glsl */`
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
  void main() { vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`;
const MOTE_FRAG = /* glsl */`
  varying float vA; varying vec3 vC;
  void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0 || vA <= 0.001) discard; float a = (1.0 - r) * (1.0 - r) * vA; gl_FragColor = vec4(vC * (1.0 + a * 1.5), a); }`;

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

/** the floor sigil: a crisp ring, a faint outer ring and 24 tick marks, one geometry in the XZ plane (y up) */
function makeSigil(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const inner = new THREE.RingGeometry(SIGIL_R - 0.012, SIGIL_R + 0.012, 64); parts.push(inner);
  const outer = new THREE.RingGeometry(SIGIL_OUTER_R - 0.004, SIGIL_OUTER_R + 0.004, 96); parts.push(outer);
  for (let i = 0; i < SIGIL_TICKS; i++) {
    const a = (i / SIGIL_TICKS) * Math.PI * 2, long = i % 6 === 0;
    const tick = new THREE.PlaneGeometry(0.012, long ? 0.09 : 0.05);
    tick.translate(0, SIGIL_OUTER_R - (long ? 0.065 : 0.045), 0); tick.rotateZ(a);
    parts.push(tick);
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  g.rotateX(-Math.PI / 2);
  return g;
}

const _size = new THREE.Vector2(), _eye = new THREE.Vector3(), _to = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

export class ItemPickup {
  readonly group = new THREE.Group();
  readonly interactable: Interactable;
  readonly tier: PickupTier;
  onPickup?: () => void;
  /** the player stepped inside (true) / out of (false) the prompt radius — main.ts plays the hum */
  onNear?: (inside: boolean) => void;
  taken = false;
  private scene: THREE.Scene;
  private holder = new THREE.Group();
  private sphere: THREE.Mesh; private sphereMat: THREE.ShaderMaterial;
  private rings = new THREE.Group(); private ringPivots: THREE.Object3D[] = []; private ringMat: THREE.MeshBasicMaterial;
  private sigil: THREE.Mesh; private sigilMat: THREE.MeshBasicMaterial;
  private pool: THREE.Mesh; private poolMat: THREE.MeshBasicMaterial;
  private shock: THREE.Mesh; private shockMat: THREE.MeshBasicMaterial;
  private light: THREE.PointLight;
  // sprites: motes [0, MOTES), their trails [MOTES, MOTES * (1 + TRAIL)), burst motes after that — one Points
  private points: THREE.Points; private moteMat: THREE.ShaderMaterial;
  private pos = new Float32Array(SPRITES * 3); private size = new Float32Array(SPRITES); private alpha = new Float32Array(SPRITES); private col = new Float32Array(SPRITES * 3);
  private posAttr: THREE.BufferAttribute; private sizeAttr: THREE.BufferAttribute; private alphaAttr: THREE.BufferAttribute;
  private mAngle = new Float32Array(MOTES); private mRadius = new Float32Array(MOTES); private mY = new Float32Array(MOTES); private mRise = new Float32Array(MOTES); private mSpin = new Float32Array(MOTES); private mSpark = new Uint8Array(MOTES); private mSize = new Float32Array(MOTES);
  private hist = new Float32Array(MOTES * TRAIL * 3); private histTimer = 0;
  private bVel = new Float32Array(BURST_MOTES * 3); private bLife = new Float32Array(BURST_MOTES);
  private pulse = 0; private bob = Math.random() * Math.PI * 2;
  private near = false; private approach = 0;
  private burstT = -1;
  private disposed = false;
  private glowing = new Map<THREE.MeshStandardMaterial, { colour: THREE.Color; intensity: number }>();
  private orb: THREE.Color; private sparkCol = new THREE.Color();

  constructor(opts: ItemPickupOptions) {
    this.scene = opts.scene;
    this.tier = opts.tier ?? 'common';
    const colour = this.orb = new THREE.Color(ORB_COLOUR[this.tier]);
    this.sparkCol.copy(colour).lerp(new THREE.Color(1, 1, 1), 0.7);
    this.group.position.copy(opts.position);
    // the item: tilted (muzzle / tip up), a little over life size, spun by the holder
    const item = opts.item;
    item.rotation.x = opts.tilt ?? TILT; item.rotation.z = 0.12;
    item.scale.setScalar(opts.scale ?? MODEL_SCALE);
    this.holder.add(item);
    this.holder.position.y = HOVER;
    // the sphere: Fresnel rim + haze, additive, no depth write so the item inside and the wall behind show through
    this.sphereMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: colour }, uTime: { value: 0 }, uAlpha: { value: 1 }, uRim: { value: RIM }, uHaze: { value: HAZE } },
      vertexShader: SPHERE_VERT, fragmentShader: SPHERE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
    });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R, 48, 32), this.sphereMat);
    this.sphere.position.y = HOVER; this.sphere.renderOrder = RENDER_ORDER + 1;
    // two orbit rings on tilted pivots, counter-rotating; the pivots' parent leans toward the player when close
    this.ringMat = new THREE.MeshBasicMaterial({ color: colour.clone().multiplyScalar(1.7), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    const ringGeo = new THREE.TorusGeometry(RING_R, RING_TUBE, 6, 96); ringGeo.rotateX(Math.PI / 2); // a ring in the XZ plane
    for (let i = 0; i < 2; i++) {
      const pivot = new THREE.Object3D(); pivot.rotation.z = RING_TILT[i];
      const ring = new THREE.Mesh(ringGeo, this.ringMat); ring.renderOrder = RENDER_ORDER + 3;
      pivot.add(ring); this.rings.add(pivot); this.ringPivots.push(pivot);
    }
    this.rings.position.y = HOVER;
    // sprites: motes + trails + burst, one Points
    for (let i = 0; i < MOTES; i++) this.spawnMote(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', (this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)));
    g.setAttribute('aSize', (this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage)));
    g.setAttribute('aAlpha', (this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage)));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, HOVER, 0), SHOCK_R1 + 1);
    this.moteMat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.points = new THREE.Points(g, this.moteMat);
    this.points.renderOrder = RENDER_ORDER + 2; this.points.frustumCulled = false;
    for (let i = 0; i < SPRITES; i++) { const c = i < MOTES && this.mSpark[i] ? this.sparkCol : colour; this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b; }
    // floor: sigil (crisp ring + outer ring + ticks) turning slowly over a soft light pool; a short-range point light
    this.sigilMat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.sigil = new THREE.Mesh(makeSigil(), this.sigilMat);
    this.sigil.position.y = 0.014; this.sigil.renderOrder = RENDER_ORDER + 1;
    poolTex ??= makePoolTexture();
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: colour, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(POOL_R * 2, POOL_R * 2), this.poolMat);
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.y = 0.01; this.pool.renderOrder = RENDER_ORDER;
    // the pickup shockwave: a flat ring scaled out from SHOCK_R0 to SHOCK_R1
    this.shockMat = new THREE.MeshBasicMaterial({ color: colour.clone().multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.shock = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), this.shockMat);
    this.shock.rotation.x = -Math.PI / 2; this.shock.position.y = HOVER; this.shock.visible = false; this.shock.renderOrder = RENDER_ORDER + 4;
    this.light = new THREE.PointLight(colour, LIGHT, LIGHT_DIST, 2);
    this.light.position.y = HOVER;
    // the item glows faintly with the orb's colour while it sits inside (materials are shared with the viewmodel: restored on pickup)
    item.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !('emissive' in m) || this.glowing.has(m)) return;
      this.glowing.set(m, { colour: m.emissive.clone(), intensity: m.emissiveIntensity });
      m.emissive.set(TIER_COLOUR[this.tier]); m.emissiveIntensity = ITEM_EMISSIVE;
    });
    this.group.add(this.holder, this.sphere, this.rings, this.points, this.sigil, this.pool, this.shock, this.light);
    this.scene.add(this.group);
    // the prompt loop measures from the CAMERA (eye height): the interact point sits a little above the item so the
    // radius reads as ground distance, like the door's `FLOOR + 1.0` point
    const radius = opts.radius ?? 1.8;
    this.interactable = { position: new THREE.Vector3(opts.position.x, opts.position.y + HOVER + 0.5, opts.position.z), radius, label: opts.prompt ?? 'Take item', onInteract: () => this.take() };
  }

  /** the prompt text after "[E]" */
  get prompt() { return this.interactable.label; }
  set prompt(v: string) { this.interactable.label = v; }

  /** a mote on its helix: angle, radius 0.5–0.75 m (just outside the sphere), rising from the bottom */
  private spawnMote(i: number, anywhere: boolean) {
    this.mAngle[i] = Math.random() * Math.PI * 2;
    this.mRadius[i] = 0.5 + Math.random() * 0.25;
    this.mY[i] = HOVER + (anywhere ? (Math.random() - 0.5) * 2 : -1) * SPHERE_R * 1.05;
    this.mRise[i] = 0.16 + Math.random() * 0.14;
    this.mSpin[i] = (0.9 + Math.random() * 0.8) * (i % 2 ? 1 : -1);
    this.mSpark[i] = i % SPARK_EVERY === 0 ? 1 : 0;
    this.mSize[i] = (this.mSpark[i] ? 0.05 : 0.03) + Math.random() * 0.025;
    const x = Math.cos(this.mAngle[i]) * this.mRadius[i], z = Math.sin(this.mAngle[i]) * this.mRadius[i];
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = this.mY[i]; this.pos[i * 3 + 2] = z;
    for (let k = 0; k < TRAIL; k++) { const h = (i * TRAIL + k) * 3; this.hist[h] = x; this.hist[h + 1] = this.mY[i]; this.hist[h + 2] = z; }
  }

  /** pick it up: the item vanishes, the orb collapses then bursts, `onPickup` fires; a no-op the second time */
  take() {
    if (this.taken) return;
    this.taken = true;
    this.interactable.radius = 0;
    this.holder.visible = false;
    this.unglow();
    if (this.near) { this.near = false; this.onNear?.(false); }
    this.burstT = 0;
    this.onPickup?.();
  }

  /** put the item's materials back the way they were (they are the viewmodel's) */
  private unglow() {
    for (const [m, o] of this.glowing) { m.emissive.copy(o.colour); m.emissiveIntensity = o.intensity; }
    this.glowing.clear();
  }

  /** remove it from the scene and free its GPU resources (also used by `?weapon=rifle`, which unlocks the rifle at load) */
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.taken = true; this.interactable.radius = 0;
    this.unglow();
    if (this.near) { this.near = false; this.onNear?.(false); }
    this.scene.remove(this.group);
    this.sphere.geometry.dispose(); this.sphereMat.dispose(); this.points.geometry.dispose(); this.moteMat.dispose();
    (this.ringPivots[0].children[0] as THREE.Mesh).geometry.dispose(); this.ringMat.dispose();
    this.sigil.geometry.dispose(); this.sigilMat.dispose(); this.pool.geometry.dispose(); this.poolMat.dispose(); this.shock.geometry.dispose(); this.shockMat.dispose();
  }

  update(dt: number, t: number, renderer?: THREE.WebGLRenderer, camera?: THREE.PerspectiveCamera) {
    if (this.disposed) return;
    if (renderer && camera) { renderer.getDrawingBufferSize(_size); this.moteMat.uniforms.uScale.value = _size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); }
    this.sphereMat.uniforms.uTime.value = t;
    if (this.burstT >= 0) { this.stepBurst(dt); return; }

    // approach: the eye's distance to the orb (the prompt radius is measured the same way)
    let dist = 99;
    if (camera) { _eye.setFromMatrixPosition(camera.matrixWorld); _to.subVectors(_eye, this.interactable.position); dist = _to.length(); }
    const inside = dist <= this.interactable.radius;
    if (inside !== this.near) { this.near = inside; this.onNear?.(inside); }
    const nearK = dist < NEAR_DIST ? 1 : 0;
    this.approach += (nearK - this.approach) * Math.min(1, dt * 3);

    // breathing + bob (out of phase); faster when the player is close
    this.pulse += (dt * Math.PI * 2 / PULSE_PERIOD) * (1 + (NEAR_PULSE - 1) * this.approach);
    this.bob += dt * Math.PI * 2 / BOB_PERIOD;
    const breath = 1 + Math.sin(this.pulse + PULSE_PHASE) * PULSE_DEPTH;
    const rimK = inside ? 1.5 : 1;
    this.sphereMat.uniforms.uRim.value = RIM * breath * rimK;
    this.sphereMat.uniforms.uHaze.value = HAZE * breath;
    this.holder.position.y = HOVER + Math.sin(this.bob) * BOB;
    this.holder.rotation.y += YAW_RATE * dt;
    this.poolMat.opacity = 0.45 + Math.sin(this.pulse + PULSE_PHASE) * 0.12;
    this.light.intensity = LIGHT * (1 + Math.sin(this.pulse + PULSE_PHASE) * 0.2) * rimK;
    this.sigil.rotation.y += SIGIL_RATE * dt;
    this.sigilMat.opacity = 0.75 + Math.sin(this.pulse) * 0.15;

    // rings: counter-rotate on their tilted pivots; the whole pair leans toward the player when close
    for (let i = 0; i < 2; i++) this.ringPivots[i].rotation.y += RING_RATE[i] * dt * (1 + 0.5 * this.approach);
    if (camera && this.approach > 0.001) {
      _to.set(_eye.x - this.group.position.x, 0, _eye.z - this.group.position.z);
      if (_to.lengthSq() > 1e-4) {
        // yaw the pair so its +Z faces the player, then lean it toward them by NEAR_TILT × approach
        _q.setFromAxisAngle(_up, Math.atan2(_to.x, _to.z)).multiply(_q2.setFromAxisAngle(_xAxis, NEAR_TILT * this.approach));
        this.rings.quaternion.slerp(_q, Math.min(1, dt * 2.5));
      }
    } else this.rings.quaternion.slerp(_qIdentity, Math.min(1, dt * 2.5));
    this.ringMat.opacity = 0.75 + Math.sin(this.pulse * 1.5) * 0.15 + 0.1 * this.approach;

    this.stepMotes(dt, t);
  }

  /** motes spiral up their helices; every TRAIL_DT the history shifts and the trail sprites follow; sparks flash */
  private stepMotes(dt: number, t: number) {
    const pos = this.pos, hist = this.hist;
    this.histTimer += dt;
    const shift = this.histTimer >= TRAIL_DT; if (shift) this.histTimer = 0;
    for (let i = 0; i < MOTES; i++) {
      if (shift) { const h = i * TRAIL * 3; for (let k = TRAIL - 1; k > 0; k--) { hist[h + k * 3] = hist[h + (k - 1) * 3]; hist[h + k * 3 + 1] = hist[h + (k - 1) * 3 + 1]; hist[h + k * 3 + 2] = hist[h + (k - 1) * 3 + 2]; } hist[h] = pos[i * 3]; hist[h + 1] = pos[i * 3 + 1]; hist[h + 2] = pos[i * 3 + 2]; }
      this.mAngle[i] += this.mSpin[i] * dt; this.mY[i] += this.mRise[i] * dt;
      const y = (this.mY[i] - HOVER) / SPHERE_R; // -1 … 1 across the orb's height
      if (y > 1.1) this.spawnMote(i, false);
      const r = this.mRadius[i] * (0.9 + 0.1 * Math.cos(y * Math.PI)); // the helix narrows toward the poles
      pos[i * 3] = Math.cos(this.mAngle[i]) * r; pos[i * 3 + 1] = this.mY[i]; pos[i * 3 + 2] = Math.sin(this.mAngle[i]) * r;
      const fade = Math.max(0, 1 - Math.abs(y) * 0.85) * Math.min(1, (y + 1.05) * 4);
      const spark = this.mSpark[i] ? 0.55 + 0.45 * Math.max(0, Math.sin(t * 9 + i * 1.7)) ** 6 * 3 : 1;
      this.alpha[i] = 0.9 * fade * Math.min(1.6, spark); this.size[i] = this.mSize[i] * (this.mSpark[i] ? 0.7 + 0.5 * spark : 1);
      for (let k = 0; k < TRAIL; k++) { // trails: smaller, dimmer copies at the previous samples
        const s = MOTES + i * TRAIL + k, h = (i * TRAIL + k) * 3, f = 1 - (k + 1) / (TRAIL + 1);
        pos[s * 3] = hist[h]; pos[s * 3 + 1] = hist[h + 1]; pos[s * 3 + 2] = hist[h + 2];
        this.alpha[s] = this.alpha[i] * f * 0.55; this.size[s] = this.mSize[i] * (0.35 + 0.4 * f);
      }
    }
    this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true;
  }

  /** the pickup: collapse (COLLAPSE_TIME) → shockwave ring + BURST_MOTES motes flung out under gravity + light flash → dispose */
  private stepBurst(dt: number) {
    const was = this.burstT; this.burstT += dt;
    const tb = this.burstT;
    if (tb < COLLAPSE_TIME) {
      const p = tb / COLLAPSE_TIME;
      this.sphere.scale.setScalar(1 - p * 0.85); this.sphereMat.uniforms.uRim.value = RIM * (1 + p * 2); this.sphereMat.uniforms.uHaze.value = HAZE * (1 + p * 3);
      this.rings.scale.setScalar(1 - p * 0.8); this.light.intensity = LIGHT * (1 + p);
      return;
    }
    if (was < COLLAPSE_TIME) { // the bang: hide the orb, launch the shockwave and the burst motes
      this.sphere.visible = false; this.rings.visible = false; this.sigil.visible = false;
      this.shock.visible = true;
      for (let i = 0; i < MOTES * (1 + TRAIL); i++) this.alpha[i] = 0;
      for (let i = 0; i < BURST_MOTES; i++) {
        const s = MOTES * (1 + TRAIL) + i, a = Math.random() * Math.PI * 2, el = (Math.random() - 0.35) * Math.PI, sp = 2.2 + Math.random() * 3.2;
        this.pos[s * 3] = 0; this.pos[s * 3 + 1] = HOVER; this.pos[s * 3 + 2] = 0;
        this.bVel[i * 3] = Math.cos(a) * Math.cos(el) * sp; this.bVel[i * 3 + 1] = Math.sin(el) * sp + 1.5; this.bVel[i * 3 + 2] = Math.sin(a) * Math.cos(el) * sp;
        this.bLife[i] = BURST_LIFE * (0.6 + Math.random() * 0.4);
        this.size[s] = 0.03 + Math.random() * 0.04; this.alpha[s] = 1;
        const c = i % 5 === 0 ? this.sparkCol : this.orb; this.col[s * 3] = c.r; this.col[s * 3 + 1] = c.g; this.col[s * 3 + 2] = c.b;
      }
      (this.points.geometry.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    }
    const ts = tb - COLLAPSE_TIME;
    const ps = Math.min(1, ts / SHOCK_TIME);
    this.shock.scale.setScalar(SHOCK_R0 + (SHOCK_R1 - SHOCK_R0) * (1 - (1 - ps) * (1 - ps)));
    this.shockMat.opacity = 0.9 * (1 - ps);
    if (ps >= 1) this.shock.visible = false;
    const pf = Math.min(1, ts / FLASH_TIME);
    this.light.intensity = LIGHT * 3 * (1 - pf) + LIGHT * Math.max(0, 1 - ts / BURST_LIFE) * 0.4;
    this.poolMat.opacity = 0.9 * Math.max(0, 1 - ts / 0.5);
    let alive = false;
    for (let i = 0; i < BURST_MOTES; i++) {
      const s = MOTES * (1 + TRAIL) + i;
      if (this.bLife[i] <= 0) { this.alpha[s] = 0; continue; }
      alive = true;
      this.bLife[i] -= dt;
      this.bVel[i * 3 + 1] -= 9.8 * dt;
      this.bVel[i * 3] *= 0.985; this.bVel[i * 3 + 2] *= 0.985;
      this.pos[s * 3] += this.bVel[i * 3] * dt; this.pos[s * 3 + 1] += this.bVel[i * 3 + 1] * dt; this.pos[s * 3 + 2] += this.bVel[i * 3 + 2] * dt;
      if (this.pos[s * 3 + 1] < 0.01) { this.pos[s * 3 + 1] = 0.01; this.bVel[i * 3 + 1] *= -0.3; this.bVel[i * 3] *= 0.6; this.bVel[i * 3 + 2] *= 0.6; }
      this.alpha[s] = Math.min(1, this.bLife[i] / 0.35);
    }
    this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true;
    if (!alive && ps >= 1) this.dispose();
  }
}

const _q2 = new THREE.Quaternion(), _qIdentity = new THREE.Quaternion(), _xAxis = new THREE.Vector3(1, 0, 0);

/** the AR-15 was the first item; main.ts constructs it under this name */
export const WeaponPickup = ItemPickup;
export type WeaponPickup = ItemPickup;
