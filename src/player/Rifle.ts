import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { heightAt } from '../world/Heightfield';
import { getSetting } from '../ui/Settings';
import {
  Puffs, fixIBL, fovForAspect, FOV_HIP, FOV_ADS, makeNoise, makeSteel, dataTexture, normalFromHeight, box, cyl, stripExtra, sstep, clamp01,
  TRACER_RED, TRACER_ORDER, type TexSet, type Targets, type ImpactSurface, type CrossbowWorld, type CrossbowOptions,
} from './Crossbow';
import type { KitWeapon, WeaponState, AimInfo } from './Weapons';

/**
 * Rifle — AR-15 style semi-automatic carbine, the crossbow's stablemate (same world hooks, same `Targets`, the
 * `Weapon` interface from Weapons.ts). Procedural viewmodel from primitives: flat-top upper + lower receiver, free-float
 * handguard under a full-length Picatinny rail, 14.5" barrel with an A2 flash hider, gas block with a fixed front post
 * between ears, flip-up rear ghost ring, charging handle, forward assist, dust cover, 30-round PMAG, pistol grip,
 * collapsible stock on a buffer tube. Dark anodised aluminium + black polymer + steel, all through `sky.setupMaterial`
 * with IDENTICAL map slots and one program cache key ('rifle') so the whole rifle is one lit program.
 *
 *   const rifle = new Rifle({ game, sky, player, forest }, targets, { allowUnlocked });
 *   weapons = new Weapons(crossbow, rifle);   // the manager calls setActive / update / drives `holster`
 *
 * Semi-auto: one round per click / tap / `F` (FIRE_INTERVAL min), 30-round magazine + 90 in reserve, RELOAD_TIME s
 * reload on `R` or automatically when the trigger is pulled on an empty mag. HITSCAN: `Targets.raycast` for animals,
 * trunks and terrain marched along `aimRay()` (the camera forward — the same aim line as the crossbow), damage
 * `damageFor(headshot, dist) * DAMAGE_SCALE` per round. Muzzle flash (two additive quads for 2 frames + a point light
 * for FLASH_LIGHT_TIME), pooled brass, camera kick (KICK_PITCH per shot, recovered over ~0.2 s), a short red hitscan
 * tracer (TRACER_TIME) when the 'tracers' setting is on, impact puffs (Puffs from Crossbow.ts) and `onImpact` /
 * `onHit` like the crossbow so the audio + Combat feedback need no weapon-specific wiring.
 *
 * ADS = shouldered iron sights: model rotation 0 (bore parallel to the camera forward), the sight line SIGHT_Y above
 * the bore is put on the eye, the rear aperture as close as the near plane allows (near + ADS_NEAR_MARGIN): the front
 * post then sits centred in the ghost ring, both on the crosshair, and a hit lands where the post is. FOV 72 → 58
 * (1.3× zoom, the crossbow's numbers, Hor+ on portrait through fovForAspect).
 */

const MAGAZINE = 30, RESERVE_START = 90;
const FIRE_INTERVAL = 0.09;   // s: semi-auto rate cap
const RELOAD_TIME = 1.6;      // s
const AUTO_RELOAD_DELAY = 0.35; // s after the empty click before the auto reload starts
const DAMAGE_SCALE = 0.55;    // × the bolt's damageFor: many light hits vs one heavy bolt
const HITSCAN_RANGE = 300;    // m
const KICK_PITCH = THREE.MathUtils.degToRad(0.35);
const SPREAD_ADS = 0.12, SPREAD_HIP = 1.1, BLOOM_PER_SHOT = 0.35, BLOOM_MAX = 1.6; // degrees
const FLASH_FRAMES = 2, FLASH_LIGHT_TIME = 0.05, FLASH_LIGHT = 30;
const BRASS_COUNT = 3, BRASS_LIFE = 1.4;
const TRACER_COUNT = 3, TRACER_TIME = 0.09, TRACER_WIDTH = 3;
const ADS_BLEND_TIME = 0.16, ADS_MOTION = 0.3, ADS_NEAR_MARGIN = 0.03;
/** sight line height over the bore (m): the front post tip and the rear aperture centre both sit here */
const SIGHT_Y = 0.064;
const REAR_Z = 0.10, FRONT_Z = -0.455, MUZZLE_Z = -0.645, PORT = new THREE.Vector3(0.03, 0.008, 0.0);
const TRUNK_PAD = 0.15; // Forest pads every trunk's collision radius by this much (see Crossbow.ts)
const SIGHT_CYAN = 0x8fe3ff;

// ───────────────────────────── textures ─────────────────────────────

/** Type III hard-coat anodised aluminium: near-black, a fine machining grain along U, faint mottle, bright wear on the edges of the pattern. */
function makeAnodised(seed: number): TexSet {
  const S = 512;
  const { fbm, hash } = makeNoise(seed);
  const col = new Uint8Array(S * S * 4), arm = new Uint8Array(S * S * 4), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    const grain = fbm(u * 260, v * 3, 2), mottle = fbm(u * 5, v * 5, 4), scuff = fbm(u * 14 + 3, v * 14, 3);
    const wear = sstep(0.68, 0.9, scuff) * 0.35; // silver showing through where the coating is rubbed
    const lum = 0.22 + (grain - 0.5) * 0.08 + (mottle - 0.5) * 0.07 + wear * 0.5 + (hash(x, y) - 0.5) * 0.02;
    col[i] = clamp01(lum * 0.96) * 255; col[i + 1] = clamp01(lum * 0.98) * 255; col[i + 2] = clamp01(lum * 1.04) * 255; col[i + 3] = 255;
    const rough = clamp01(0.5 + (mottle - 0.5) * 0.14 + (grain - 0.5) * 0.08 - wear * 0.3);
    arm[i] = 255; arm[i + 1] = rough * 255; arm[i + 2] = (0.85 + wear * 0.15) * 255; arm[i + 3] = 255;
    hgt[y * S + x] = grain * 0.25 + mottle * 0.1;
  }
  return { map: dataTexture(col, S, S, true), normalMap: normalFromHeight(hgt, S, S, 0.9), armMap: dataTexture(arm, S, S, false) };
}

/** Glass-filled nylon (grip, stock, magazine): charcoal, a coarse stipple, faint mould lines. */
function makePolymer(seed: number): TexSet {
  const S = 256;
  const { fbm, hash } = makeNoise(seed);
  const col = new Uint8Array(S * S * 4), arm = new Uint8Array(S * S * 4), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    const stipple = fbm(u * 90, v * 90, 2), big = fbm(u * 6, v * 6, 3), h = hash(x, y);
    const line = Math.abs(v - 0.5) < 0.004 ? 0.12 : 0; // mould parting line
    const lum = 0.13 + (stipple - 0.5) * 0.06 + (big - 0.5) * 0.04 + (h - 0.5) * 0.02 + line;
    col[i] = clamp01(lum) * 255; col[i + 1] = clamp01(lum * 1.02) * 255; col[i + 2] = clamp01(lum * 1.05) * 255; col[i + 3] = 255;
    arm[i] = 255; arm[i + 1] = clamp01(0.78 + (stipple - 0.5) * 0.2 - line) * 255; arm[i + 2] = 0; arm[i + 3] = 255;
    hgt[y * S + x] = stipple * 0.6 + h * 0.1 + line;
  }
  return { map: dataTexture(col, S, S, true), normalMap: normalFromHeight(hgt, S, S, 2.2), armMap: dataTexture(arm, S, S, false) };
}

/** muzzle flash sprite: a hot white core, orange petals, alpha in the luminance (additive) */
function makeFlashTexture(): THREE.CanvasTexture {
  const S = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  const c = S / 2;
  // petals
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3, len = S * (0.32 + (k % 3) * 0.08), w = S * 0.07;
    ctx.save(); ctx.translate(c, c); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255,220,150,0.9)'); g.addColorStop(0.5, 'rgba(255,150,60,0.55)'); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -w); ctx.quadraticCurveTo(len * 0.6, -w * 0.4, len, 0); ctx.quadraticCurveTo(len * 0.6, w * 0.4, 0, w); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const core = ctx.createRadialGradient(c, c, 0, c, c, S * 0.3);
  core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(0.35, 'rgba(255,230,170,0.9)'); core.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = core; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ───────────────────────────── hitscan tracer ─────────────────────────────

/** one straight red line, muzzle → impact, alive TRACER_TIME s */
class HitLine {
  readonly line: LineSegments2; readonly mat: LineMaterial;
  private geo: LineSegmentsGeometry; private buf = new Float32Array(6);
  t0 = -1;
  constructor(scene: THREE.Scene) {
    this.geo = new LineSegmentsGeometry(); this.geo.setPositions(this.buf);
    this.mat = new LineMaterial({ linewidth: TRACER_WIDTH, transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mat.color = TRACER_RED.clone();
    this.line = new LineSegments2(this.geo, this.mat);
    this.line.frustumCulled = false; this.line.renderOrder = TRACER_ORDER; this.line.visible = false;
    scene.add(this.line);
  }
  show(a: THREE.Vector3, b: THREE.Vector3, t: number) {
    this.buf[0] = a.x; this.buf[1] = a.y; this.buf[2] = a.z; this.buf[3] = b.x; this.buf[4] = b.y; this.buf[5] = b.z;
    this.geo.setPositions(this.buf);
    this.mat.opacity = 1; this.line.visible = true; this.t0 = t;
  }
  update(t: number, res: THREE.Vector2, life: number) {
    if (this.t0 < 0) return;
    this.mat.resolution.copy(res);
    const a = 1 - (t - this.t0) / life;
    if (a <= 0) { this.t0 = -1; this.line.visible = false; return; }
    this.mat.opacity = a;
  }
}

interface Brass { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; down: boolean }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Rifle implements KitWeapon {
  readonly id = 'rifle' as const;
  readonly name = 'AR-15';
  readonly ammoLabel = 'Rounds';
  readonly segments = 6;
  readonly state: WeaponState & { ammo: number } = { ammo: MAGAZINE, magazine: MAGAZINE, reserve: RESERVE_START, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  adsHeld = false;
  holster = 0;
  aimInfo: AimInfo | null = null;
  private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };

  onFire?: () => void;
  onHit?: (kind: string, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  readonly model = new THREE.Group();
  private game: CrossbowWorld['game']; private sky: CrossbowWorld['sky']; private player: CrossbowWorld['player']; private forest: CrossbowWorld['forest'];
  private targets?: Targets;
  private active = true;

  // animated parts
  private mag!: THREE.Mesh; private magRest = new THREE.Vector3(); private handle!: THREE.Mesh; private bolt!: THREE.Mesh;
  private flash = new THREE.Group(); private flashQuads: THREE.Mesh[] = []; private flashLight!: THREE.PointLight; private flashFrames = 0; private flashLightT = 0;
  private rearGlow!: THREE.Material;
  /** geometry + material pairs for `displayModel()` (the cabin pickup) */
  private displayParts: { geo: THREE.BufferGeometry; mat: THREE.Material; pos?: THREE.Vector3 }[] = [];
  private brass: Brass[] = [];
  private brassMat!: THREE.MeshStandardMaterial;
  private tracers: HitLine[] = []; private tracerRes = new THREE.Vector2();
  private puffs = new Puffs();

  // animation state
  private cooldown = 0; private sinceEmpty = 99; private reloadT = 0;
  private recoil = 0; private kickPending = 0; private kickApplied = 0; private bloom = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private reloadTilt = 0;
  private time = 0;
  /** tracer line life (s) — a dev knob for screenshots */
  tracerLife = TRACER_TIME;
  /** hip pose (lower-right); a dev knob: `__weapons.get('rifle').hip.py = …` */
  readonly hip = { px: 0.13, py: -0.115, pz: -0.38, rx: 0.03, ry: 0.08, rz: 0.03, scale: 1.0 };
  /** the solved shouldered pose (dev / verification: `__weapons.get('rifle').adsPose`) */
  readonly adsPose = { px: 0, py: 0, pz: 0, scale: 1, rearDepth: 0, frontDepth: 0, muzzleDepth: 0 };

  constructor(world: CrossbowWorld, targets?: Targets, opts: CrossbowOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player; this.forest = world.forest;
    this.targets = targets;
    this.allowUnlocked = !!opts.allowUnlocked;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel();
    this.buildEffects();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.puffs.points);
    this.bindInput();
  }

  // ── input ──
  inputAllowed() { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput() {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) this.mouseAds = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) this.mouseAds = false; });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat) return;
      if (e.code === 'KeyF') this.tryFire();
      if (e.code === 'KeyR') this.reload();
    });
    window.addEventListener('blur', () => { this.mouseAds = false; });
  }

  setActive(on: boolean) {
    this.active = on;
    this.model.visible = on;
    if (!on) { this.enabled = false; this.mouseAds = false; }
  }

  /** Pull the trigger: one round if the mag has one, else a dry click and (after a beat) a reload. */
  tryFire() {
    if (this.state.reloading || this.cooldown > 0) return;
    if (this.state.ammo <= 0) { this.onDry?.(); this.sinceEmpty = 0; if (this.state.reserve > 0) this.reload(); return; }
    this.fire();
  }

  reload() {
    if (this.state.reloading || this.state.ammo >= MAGAZINE || this.state.reserve <= 0) return;
    this.state.reloading = true; this.reloadT = 0; this.state.reloadProgress = 0;
    this.onReloadStart?.();
  }

  addRounds(n: number) { this.state.reserve += n; }

  private fire() {
    const s = this.state;
    s.ammo--; s.loaded = s.ammo > 0;
    this.cooldown = FIRE_INTERVAL;
    this.recoil = 1; this.kickPending = KICK_PITCH;
    this.flashFrames = FLASH_FRAMES; this.flashLightT = FLASH_LIGHT_TIME;
    for (const q of this.flashQuads) { q.rotation.z = Math.random() * Math.PI * 2; q.scale.setScalar(0.8 + Math.random() * 0.5); }
    this.flash.visible = true; this.flashLight.intensity = FLASH_LIGHT;
    this.onFire?.(); // before the hit resolves: Combat registers the aimed shot, the damage float then closes it
    this.hitscan();
    this.ejectBrass();
    this.bloom = Math.min(BLOOM_MAX, this.bloom + BLOOM_PER_SHOT);
  }

  /** The aim line is the camera forward, hip or sighted (the crosshair / the ring's centre). */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3) {
    const cam = this.game.camera;
    cam.getWorldDirection(dir);
    origin.copy(cam.position);
    return dir;
  }

  private hitscan() {
    this.aimRay(_o, _d);
    const a = sstep(0, 1, this.adsBlend);
    const spread = THREE.MathUtils.degToRad(SPREAD_ADS + (1 - a) * SPREAD_HIP + this.bloom * (1 - a * 0.7));
    _v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(_d).normalize();
    _d.addScaledVector(_v1, Math.tan(spread * Math.random())).normalize();
    let dist = HITSCAN_RANGE, surface: ImpactSurface | null = null;
    const hit = this.targets?.raycast(_o, _d, HITSCAN_RANGE) ?? null;
    if (hit) { dist = hit.distance; surface = 'flesh'; }
    // trunks: the padded collision radius over the whole trunk, then refined onto the real bark like the crossbow
    const step = 6;
    for (let t0 = 0; t0 < dist; t0 += step) {
      const len = Math.min(step, dist - t0);
      _v2.copy(_o).addScaledVector(_d, t0 + len * 0.5);
      let best = -1;
      for (const tr of this.forest.nearby(_v2.x, _v2.z, len * 0.5)) {
        _v3.copy(_o).addScaledVector(_d, t0);
        const tf = this.segmentCylinder(_v3, _d, len, tr.x, tr.z, tr.r, tr.y, tr.y + tr.height);
        if (tf < 0) continue;
        const tb = this.segmentCylinder(_v3, _d, len + TRUNK_PAD * 4, tr.x, tr.z, Math.max(0.05, tr.r - TRUNK_PAD), tr.y, tr.y + tr.height);
        const d = t0 + (tb >= 0 ? tb : tf);
        if (best < 0 || d < best) best = d;
      }
      if (best >= 0 && best < dist) { dist = best; surface = 'wood'; break; }
    }
    // terrain: march, then bisect the crossing
    if (_d.y < 0.2) {
      let prev = 0;
      for (let t0 = 1; t0 <= dist; t0 = Math.min(dist, t0 + 1)) {
        _v2.copy(_o).addScaledVector(_d, t0);
        if (_v2.y < heightAt(_v2.x, _v2.z)) {
          let lo = prev, hi = t0;
          for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; _v2.copy(_o).addScaledVector(_d, mid); if (_v2.y < heightAt(_v2.x, _v2.z)) hi = mid; else lo = mid; }
          dist = lo; surface = 'ground'; break;
        }
        prev = t0;
        if (t0 >= dist) break;
      }
    }
    const point = _v2.copy(_o).addScaledVector(_d, dist);
    if (surface === 'flesh' && hit) {
      point.copy(hit.point);
      const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.distance) * DAMAGE_SCALE, hit.point, _d);
      this.onHit?.(hit.animal.kind, hit.headshot, killed);
    }
    if (getSetting('tracers')) {
      const tr = this.tracers.reduce((acc, x) => (x.t0 < acc.t0 ? x : acc));
      this.model.updateMatrixWorld();
      this.model.localToWorld(_v3.set(0, 0.004, MUZZLE_Z));
      tr.show(_v3, point, this.time);
    }
    if (surface) {
      this.puffs.emit(point, _d, surface);
      this.onImpact?.(surface, point);
    }
  }

  /** distance along the segment where it enters a cylinder whose radius tapers to 20 % at yTop, or -1 (Crossbow.ts) */
  private segmentCylinder(o: THREE.Vector3, d: THREE.Vector3, len: number, cx: number, cz: number, r: number, yBot: number, yTop: number): number {
    const ox = o.x - cx, oz = o.z - cz;
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-8) return -1;
    const bq = 2 * (ox * d.x + oz * d.z);
    let rr = r;
    for (let pass = 0; pass < 2; pass++) {
      const c = ox * ox + oz * oz - rr * rr;
      const disc = bq * bq - 4 * a * c;
      if (disc < 0) return -1;
      const t = (-bq - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t > len) return -1;
      const y = o.y + d.y * t;
      if (y < yBot || y > yTop) return -1;
      if (pass === 1) return t;
      rr = r * (1 - 0.8 * clamp01((y - yBot) / (yTop - yBot)));
    }
    return -1;
  }

  // ── viewmodel ──
  private buildViewmodel() {
    const alu = makeAnodised(53), poly = makePolymer(59), steel = makeSteel(61);
    alu.map.repeat.set(3, 1); alu.normalMap.repeat.set(3, 1); alu.armMap.repeat.set(3, 1);
    steel.map.repeat.set(2, 2); steel.normalMap.repeat.set(2, 2); steel.armMap.repeat.set(2, 2);
    // one program: every material is MeshStandard with the same five map slots (ARM feeds ao/rough/metal) and the 'rifle' cache key
    const std = (t: TexSet, extra: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, aoMap: t.armMap, roughnessMap: t.armMap, metalnessMap: t.armMap, roughness: 1, metalness: 1, ...extra });
    const aluMat = std(alu, { normalScale: new THREE.Vector2(0.6, 0.6), color: new THREE.Color(0.9, 0.9, 0.92), envMapIntensity: 0.55 });
    const polyMat = std(poly, { normalScale: new THREE.Vector2(0.8, 0.8), color: new THREE.Color(0.95, 0.95, 0.95), envMapIntensity: 0.35 });
    const steelMat = std(steel, { normalScale: new THREE.Vector2(0.5, 0.5), color: new THREE.Color(0.4, 0.4, 0.42), roughness: 1.2, envMapIntensity: 0.7 });
    this.brassMat = std(steel, { normalScale: new THREE.Vector2(0.3, 0.3), color: new THREE.Color(0.95, 0.68, 0.32), roughness: 0.9, envMapIntensity: 1.0 });
    ([['rifle-alu', aluMat], ['rifle-poly', polyMat], ['rifle-steel', steelMat], ['rifle-brass', this.brassMat]] as [string, THREE.Material][]).forEach(([n, m]) => { m.name = n; fixIBL(m, 'rifle'); this.sky.setupMaterial(m); });

    // model space: -Z forward (bore), +Y up, bore axis at y = 0; receiver z -0.10 … +0.13, muzzle at MUZZLE_Z
    const A: THREE.BufferGeometry[] = [], P: THREE.BufferGeometry[] = [], S: THREE.BufferGeometry[] = [];
    // ── upper receiver + rail ──
    A.push(box(0.05, 0.055, 0.22, 0, 0.0075, 0.01));
    A.push(box(0.021, 0.008, 0.56, 0, 0.039, -0.16)); // full-length Picatinny rail base
    for (let z = -0.43; z < 0.11; z += 0.023) A.push(box(0.021, 0.004, 0.011, 0, 0.045, z)); // rail teeth
    A.push(box(0.02, 0.012, 0.03, 0, 0.026, 0.115)); // rear of the upper, over the charging handle
    // ── handguard: octagonal free-float tube with M-LOK slots (polymer inserts) ──
    A.push(cyl(0.024, 0.024, 0.33, 8, 0, 0, -0.265, Math.PI / 2, 0, 0));
    for (let z = -0.16; z > -0.40; z -= 0.045) { P.push(box(0.004, 0.024, 0.032, -0.0235, 0, z)); P.push(box(0.004, 0.024, 0.032, 0.0235, 0, z)); P.push(box(0.024, 0.004, 0.032, 0, -0.0235, z)); }
    A.push(cyl(0.028, 0.028, 0.03, 12, 0, 0, -0.10, Math.PI / 2, 0, 0)); // barrel nut
    // ── barrel, gas block, flash hider ──
    S.push(cyl(0.0095, 0.0095, 0.19, 10, 0, 0, -0.525, Math.PI / 2, 0, 0));
    A.push(box(0.024, 0.03, 0.03, 0, 0.018, FRONT_Z)); // gas block
    S.push(cyl(0.0125, 0.0125, 0.055, 10, 0, 0, MUZZLE_Z + 0.0275, Math.PI / 2, 0, 0)); // A2 birdcage
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.6; P.push(box(0.003, 0.004, 0.03, Math.cos(a) * 0.0125, Math.sin(a) * 0.0125, MUZZLE_Z + 0.022, 0, 0, a)); } // hider slots
    // ── front sight: tower + post between ears (post tip exactly on the sight line) ──
    A.push(box(0.012, 0.02, 0.018, 0, 0.043, FRONT_Z));
    for (const sx of [-1, 1]) A.push(box(0.003, 0.03, 0.012, sx * 0.0095, 0.062, FRONT_Z));
    S.push(box(0.0035, SIGHT_Y - 0.047, 0.0035, 0, (SIGHT_Y + 0.047) / 2, FRONT_Z)); // the post: 0.047 → SIGHT_Y
    // ── lower receiver, mag well, trigger guard + trigger, selector, mag release ──
    A.push(box(0.048, 0.055, 0.19, 0, -0.0475, 0.035));
    A.push(box(0.032, 0.035, 0.078, 0, -0.0925, -0.045));
    A.push(box(0.008, 0.003, 0.065, 0, -0.108, 0.03)); // trigger guard bar
    A.push(box(0.008, 0.02, 0.003, 0, -0.098, -0.002)); A.push(box(0.008, 0.02, 0.003, 0, -0.098, 0.062)); // guard ends
    S.push(box(0.005, 0.022, 0.004, 0, -0.088, 0.024, 0.25, 0, 0)); // trigger
    A.push(box(0.004, 0.006, 0.03, -0.026, -0.028, 0.06)); // selector (left)
    A.push(cyl(0.005, 0.005, 0.006, 8, 0.026, -0.045, -0.005, 0, 0, Math.PI / 2)); // mag release (right)
    // ── right side: dust cover, brass deflector, forward assist ──
    A.push(box(0.003, 0.02, 0.06, 0.0265, 0.005, -0.012));
    A.push(box(0.012, 0.028, 0.02, 0.03, 0.006, 0.03));
    S.push(cyl(0.007, 0.007, 0.018, 8, 0.031, 0.002, 0.07, 0, 0, Math.PI / 2));
    // ── buffer tube, castle nut, stock (polymer) ──
    A.push(cyl(0.016, 0.016, 0.2, 10, 0, 0.006, 0.23, Math.PI / 2, 0, 0));
    A.push(cyl(0.02, 0.02, 0.01, 10, 0, 0.006, 0.135, Math.PI / 2, 0, 0));
    P.push(box(0.04, 0.045, 0.14, 0, -0.004, 0.30));
    P.push(box(0.036, 0.018, 0.12, 0, 0.026, 0.30)); // cheek riser
    P.push(box(0.036, 0.05, 0.05, 0, -0.045, 0.345)); // toe
    P.push(box(0.042, 0.11, 0.018, 0, -0.02, 0.37)); // butt pad
    // ── pistol grip (polymer), raked back ──
    P.push(box(0.028, 0.1, 0.038, 0, -0.125, 0.13, -0.35, 0, 0));
    // ── charging handle (steel, animated), bolt carrier glimpse behind the dust cover ──
    const handleGeo = mergeGeometries([stripExtra(box(0.05, 0.008, 0.02, 0, 0.022, 0.135)), stripExtra(box(0.012, 0.008, 0.11, 0, 0.022, 0.07))], false)!;
    this.handle = new THREE.Mesh(handleGeo, steelMat);
    this.bolt = new THREE.Mesh(box(0.014, 0.014, 0.06, 0.022, 0.005, -0.012), steelMat);
    // ── magazine (polymer, animated on reload) ──
    const magGeo = mergeGeometries([stripExtra(box(0.024, 0.19, 0.07, 0, -0.095, 0, 0.12, 0, 0)), stripExtra(box(0.027, 0.01, 0.075, 0, -0.19, -0.022, 0.12, 0, 0))], false)!;
    this.mag = new THREE.Mesh(magGeo, polyMat);
    this.magRest.set(0, -0.105, -0.045);
    this.mag.position.copy(this.magRest);
    // ── rear sight: flip-up base + ghost ring on the sight line, protective ears ──
    A.push(box(0.024, 0.012, 0.03, 0, 0.049, REAR_Z));
    for (const sx of [-1, 1]) A.push(box(0.003, 0.024, 0.006, sx * 0.011, 0.066, REAR_Z));
    A.push(box(0.004, 0.012, 0.004, 0, 0.058, REAR_Z));
    const ring = new THREE.TorusGeometry(0.0062, 0.0013, 6, 22); ring.translate(0, SIGHT_Y, REAR_Z); A.push(ring);
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(SIGHT_CYAN), toneMapped: false, fog: false, opacity: 0.85 });
    this.rearGlow = glow;
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.0049, 0.00025, 4, 22), glow); glowRing.position.set(0, SIGHT_Y, REAR_Z);
    glowRing.visible = false;

    const meshA = new THREE.Mesh(mergeGeometries(A.map(stripExtra), false)!, aluMat);
    const meshP = new THREE.Mesh(mergeGeometries(P.map(stripExtra), false)!, polyMat);
    const meshS = new THREE.Mesh(mergeGeometries(S.map(stripExtra), false)!, steelMat);
    this.model.add(meshA, meshP, meshS, this.handle, this.bolt, this.mag, glowRing);
    this.displayParts.push({ geo: meshA.geometry, mat: aluMat }, { geo: meshP.geometry, mat: polyMat }, { geo: meshS.geometry, mat: steelMat }, { geo: handleGeo, mat: steelMat }, { geo: magGeo, mat: polyMat, pos: this.magRest.clone() });
    (this.model as THREE.Group & { glowRing: THREE.Mesh }).glowRing = glowRing;

    // ── muzzle flash: two additive quads (one facing, one along the bore) + a point light, shown FLASH_FRAMES frames ──
    const flashTex = makeFlashTexture();
    const flashMat = new THREE.MeshBasicMaterial({ map: flashTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const fq = new THREE.PlaneGeometry(0.22, 0.22);
    const q1 = new THREE.Mesh(fq, flashMat); const q2 = new THREE.Mesh(fq, flashMat); q2.rotation.y = Math.PI / 2; q2.position.z = -0.06; q2.scale.set(1.4, 0.6, 1);
    this.flashQuads.push(q1, q2);
    this.flash.add(q1, q2);
    this.flash.position.set(0, 0.002, MUZZLE_Z - 0.02);
    this.flash.visible = false;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 8, 2);
    this.flashLight.position.set(0, 0.03, MUZZLE_Z + 0.1);
    this.model.add(this.flash, this.flashLight);

    // depth clear + render after the world, exactly like the crossbow (see Crossbow.ts buildViewmodel)
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = o !== clearer;
      if (o === clearer) return;
      m.renderOrder = this.flashQuads.includes(m) ? 1001 : 1000;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; if (mat !== flashMat) mat.depthWrite = true; }
    });
  }

  /** A world-space copy of the rifle for the cabin pickup (WeaponPickup.ts): the same geometry + materials (one program),
   *  no depth clearer / flash / light, normal render order, casts a shadow. ~0.95 m long, bore along -Z, origin at the receiver. */
  displayModel(): THREE.Group {
    const g = new THREE.Group();
    for (const { geo, mat, pos } of this.displayParts) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      if (pos) m.position.copy(pos);
      g.add(m);
    }
    return g;
  }

  private buildEffects() {
    const caseGeo = new THREE.CylinderGeometry(0.0047, 0.0047, 0.045, 8); caseGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < BRASS_COUNT; i++) {
      const mesh = new THREE.Mesh(caseGeo, this.brassMat);
      mesh.visible = false; mesh.frustumCulled = false;
      this.game.scene.add(mesh);
      this.brass.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, down: false });
    }
    for (let i = 0; i < TRACER_COUNT; i++) this.tracers.push(new HitLine(this.game.scene));
  }

  private ejectBrass() {
    let b = this.brass.find((x) => x.life <= 0) ?? this.brass.reduce((a, x) => (x.life < a.life ? x : a));
    const cam = this.game.camera;
    this.model.updateMatrixWorld();
    this.model.localToWorld(b.mesh.position.copy(PORT));
    _v1.set(1, 0, 0).applyQuaternion(cam.quaternion); // camera right
    _v2.set(0, 1, 0).applyQuaternion(cam.quaternion);
    cam.getWorldDirection(_v3);
    b.vel.copy(_v1).multiplyScalar(2.2 + Math.random() * 0.8).addScaledVector(_v2, 1.6 + Math.random() * 0.6).addScaledVector(_v3, -0.4 + Math.random() * 0.3);
    b.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    b.mesh.quaternion.copy(cam.quaternion).multiply(_q.setFromAxisAngle(_v1.set(0, 1, 0), Math.PI / 2));
    b.life = BRASS_LIFE; b.down = false; b.mesh.visible = true;
  }

  private stepBrass(dt: number) {
    for (const b of this.brass) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) { b.mesh.visible = false; continue; }
      if (b.down) continue;
      b.vel.y -= 9.8 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.spin.x * dt; b.mesh.rotation.y += b.spin.y * dt; b.mesh.rotation.z += b.spin.z * dt;
      const g = heightAt(b.mesh.position.x, b.mesh.position.z) + 0.005;
      if (b.mesh.position.y < g) { b.mesh.position.y = g; b.down = true; b.mesh.rotation.set(0, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 0.3); }
    }
  }

  /** Shouldered pose: rotation 0, sight line on the eye, rear aperture at near + margin. Depends on the scale only. */
  private solveAds(scale: number) {
    const o = this.adsPose, cam = this.game.camera;
    if (o.scale === scale && o.rearDepth > 0) return o;
    o.scale = scale;
    o.rearDepth = cam.near + ADS_NEAR_MARGIN;
    o.px = 0; o.py = -SIGHT_Y * scale; o.pz = -o.rearDepth - REAR_Z * scale;
    o.frontDepth = -(o.pz + FRONT_Z * scale); o.muzzleDepth = -(o.pz + MUZZLE_Z * scale);
    return o;
  }

  // ── per-frame ──
  update(dt: number, t: number) {
    this.time = t;
    const p = this.player, cam = this.game.camera, s = this.state;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceEmpty += dt;
    this.bloom = Math.max(0, this.bloom - dt * 2.4);

    // auto reload: the mag ran dry on a trigger pull
    if (!s.reloading && s.ammo <= 0 && s.reserve > 0 && this.sinceEmpty > AUTO_RELOAD_DELAY && this.active && this.enabled) this.reload();
    if (s.reloading) {
      this.reloadT += dt;
      const pr = Math.min(1, this.reloadT / RELOAD_TIME);
      s.reloadProgress = pr;
      if (pr >= 1) {
        const take = Math.min(MAGAZINE - s.ammo, s.reserve);
        s.ammo += take; s.reserve -= take; s.loaded = s.ammo > 0;
        s.reloading = false; s.reloadProgress = 0;
        this.onReloadEnd?.();
      }
    }
    // magazine: drops out (0–30 %), gone (30–60 %), the fresh one comes up (60–85 %); charging handle racks at 88–100 %
    {
      const pr = s.reloading ? s.reloadProgress : 0;
      const out = s.reloading ? (pr < 0.3 ? sstep(0.05, 0.3, pr) : pr < 0.6 ? 1 : 1 - sstep(0.6, 0.85, pr)) : 0;
      this.mag.position.set(this.magRest.x, this.magRest.y - out * 0.16, this.magRest.z - out * 0.03);
      this.mag.rotation.x = out * 0.3;
      this.mag.visible = out < 0.999;
      const rack = s.reloading ? Math.sin(sstep(0.88, 1, pr) * Math.PI) : 0;
      this.handle.position.z = rack * 0.05; this.bolt.position.z = rack * 0.05;
    }

    // muzzle flash: FLASH_FRAMES frames of quads, the light for FLASH_LIGHT_TIME
    if (this.flashFrames > 0 && --this.flashFrames === 0) this.flash.visible = false;
    if (this.flashLightT > 0) { this.flashLightT -= dt; if (this.flashLightT <= 0) this.flashLight.intensity = 0; else this.flashLight.intensity = FLASH_LIGHT * clamp01(this.flashLightT / FLASH_LIGHT_TIME); }

    // ADS + FOV (only the held weapon owns the camera FOV)
    s.ads = (this.mouseAds || this.adsHeld) && this.enabled && !s.reloading && !p.sprinting;
    { const step = dt / ADS_BLEND_TIME; this.adsBlend = clamp01(this.adsBlend + THREE.MathUtils.clamp((s.ads ? 1 : 0) - this.adsBlend, -step, step)); }
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (this.active && Math.abs(targetFov - this.fov) > 0.01) {
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums();
    }

    // recoil + camera kick (up on fire, recovered over ~0.2 s)
    this.recoil *= Math.exp(-dt * 14);
    if (this.kickPending > 0) { const a = Math.min(this.kickPending, KICK_PITCH * dt * 60); p.pitch += a; this.kickApplied += a; this.kickPending -= a; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 9); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring, substepped — see Crossbow.ts)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload ↔ holster
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = s.reloading ? Math.sin(Math.min(1, s.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), rt = this.reloadTilt;
    const port = portrait, scale = this.hip.scale * (1 - port * 0.12); // portrait phone: a touch smaller, held a little further out
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.014 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.011 * sf, bobRz = Math.cos(p.bobTime) * 0.018 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.009 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil;
    // hip: lower-right, muzzle a touch in toward the centre
    let { px, py, pz, rx, ry, rz } = this.hip;
    px += sp * -0.06; py += sp * -0.08; pz += sp * 0.05; rx += sp * 0.30; ry += sp * 0.5; rz += sp * -0.12;
    px += rt * -0.05; py += rt * -0.04; pz += rt * 0.03; rx += rt * 0.22; ry += rt * -0.2; rz += rt * 0.35;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.045; py += rc * 0.008; rx += rc * 0.06; rz += rc * -0.015; // kick back + muzzle up
    px *= 1 - port * 0.35; py *= 1 + port * 0.25; pz *= 1 + port * 0.35;
    if (a > 0) {
      const ads = this.solveAds(scale), m = ADS_MOTION;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.004, az = ads.pz + rc * 0.02;
      const arx = (bobRx + lagRx) * m + rc * 0.035, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.01;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }
    const glowRing = (this.model as THREE.Group & { glowRing: THREE.Mesh }).glowRing;
    glowRing.visible = a > 0.001; (this.rearGlow as THREE.MeshBasicMaterial).opacity = a * 0.85;
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.3; pz += h * 0.06; rx -= h * 0.5; rz += h * 0.2; }
    this.model.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 16) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);

    // aim readout (held weapon only)
    if (this.active && this.targets && (++this.aimFrame & 3) === 0) {
      this.aimRay(_o, _d);
      const hit = this.targets.raycast(_o, _d, 120);
      if (hit && hit.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBrass(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, this.tracerRes, this.tracerLife);
  }
}
