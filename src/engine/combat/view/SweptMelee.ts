import { app } from '../../app/runtime';
import { aimRay, fovForAspect } from '../blocks/melee';
import type { EquipmentRow, EquipContext } from '../Equipment';
import type { Targets, TargetHit } from '../types';
import type { SwordWorld, SwordRig, SwordArms, SwordFraming, SwordMoveSet, Move } from './melee';
import { SlashTrail } from './slashTrail';
import type { WeaponState, AimInfo } from '../Weapon';
import type { Game } from '../../core/Game';
import { worldTime } from '../../core/time';
import { Impacts } from '../../fx/Impacts';
import { ParticlePool, pointScale } from '../../fx/ParticlePool';
import { weaponActionGate } from '../../input/weaponActions';
import { lockOn, meleeLock, targetRadius, type AimTarget } from '../../player/AimTargets';
import { BladeGlow } from '../../player/bladeGlow';
import { CameraFX } from '../../player/CameraFX';
import { dodgeFx, dodgeEnv } from '../../player/dodge';
import { bladeBlocked, bladeContact, type Clang } from '../../player/MeleeSweep';
import type { Player } from '../../player/Player';
import { type DrawingBuffer, viewmodel } from '../../render/viewmodelFeel';
import type { SkyRig as Sky } from '../../world/skyRig';
import { Melee } from '../Melee';
import { SweptMeleeCore, sweptLunge, sweptMoveDamage } from '../sweptMeleeCore';
import type { MeleeProfile } from '../meleeProfile';

import * as THREE from 'three';

import { smoothstep } from '../../core/noise';

/** Optional swing, contact and cover reactions supplied by the owning recipe. */
export interface MeleeEvents {
  onSwing?: ((speed: number, heavy: boolean, dir: -1 | 1) => void) | undefined;
  onStrike?: ((kind: string, point: THREE.Vector3, strength: number, killed: boolean) => void) | undefined;
  onClang?: ((point: THREE.Vector3, strength: number, clang: Clang) => void) | undefined;
}
/** Row, moves, supplied rig and framing for a generic swept contact view. */
export interface SwordOptions {
  row: EquipmentRow;
  profile: MeleeProfile;
  inputContext: string;
  allowUnlocked?: boolean; blade?: 'wood' | 'iron';
  /** the viewmodel (required, SF54: Driftwood's wooden / iron sword `swordRig`, the sabre's, the jian's) + moves + numbers */
  rig?: SwordRig; moves?: SwordMoveSet; damage?: number; reach?: number;
  /** portrait phone: how far the hands are pulled in from the right (× portrait; default 0.32) — the sabre pulls further, clear of the Nalati discs */
  portraitPullX?: number;
  /** portrait screens: the hip FOV's base before Hor+ (ShardManifest.camera.portraitFov; default FOV_HIP, 72° → ~94° vertical at 9:19.5) */
  portraitFov?: number;
  /** the portrait framing, over the wooden sword's (a rig posed for portrait by its own rest key sets it neutral) */
  framing?: Partial<SwordFraming>;
  /** an animated rig drawn and swung in place of the rigid one (the rigid rig is then hidden; the moves stay the engine's) */
  arms?: SwordArms;
}

/** Starter move identities and reactions are explicit ports; the engine supplies no content defaults. */
export interface SweptMeleeDefaults {
  readonly moves: SwordMoveSet;
  readonly slash: Move;
  readonly finisher: Move;
  readonly heavy: Move;
  readonly events: MeleeEvents;
  readonly debris: (kind: string) => { surface: 'shell' | 'wood' | 'sand'; count: number; atFeet: boolean; sparks: boolean };
}
const clamp01 = (v: number) => (v < 0 ? 0 : Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

// ───────────────────────────── hit stars ─────────────────────────────

const STAR_COUNT = 24;
class Stars {
  private readonly pool: ParticlePool<'aAlpha' | 'aSize'>;
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  private uScale: THREE.IUniform<number> = { value: 400 };
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      vertexShader: `attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.05,-mv.z); gl_Position = projectionMatrix * mv; }`,
      // a four-point star: |x|^0.5 + |y|^0.5 ≤ 1 in point space
      fragmentShader: `varying float vA; void main(){ vec2 d = abs(gl_PointCoord - 0.5) * 2.0; float s = sqrt(d.x) + sqrt(d.y); if (s > 1.0 || vA <= 0.001) discard; float a = (1.0 - s) * vA; gl_FragColor = vec4(1.0, 0.93, 0.62, a * 1.4); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.pool = new ParticlePool({ capacity: STAR_COUNT, material: this.mat, renderOrder: 1001, attributes: { aAlpha: { itemSize: 1, dynamic: true }, aSize: { itemSize: 1, dynamic: true } } });
    this.points = this.pool.points;
  }
  burst(point: THREE.Vector3, dir: THREE.Vector3, n = 9) {
    const { vel, life } = this.pool, { aAlpha: alpha, aSize: size } = this.pool.data;
    for (let k = 0; k < n; k++) {
      const i = this.pool.claim();
      this.pool.place(i, point);
      const sp = 1.2 + app.rng.stream('cosmetic').next() * 1.6;
      vel[i * 3] = (-dir.x * 0.6 + (app.rng.stream('cosmetic').next() - 0.5) * 1.6) * sp; vel[i * 3 + 1] = (0.5 + app.rng.stream('cosmetic').next() * 0.9) * sp; vel[i * 3 + 2] = (-dir.z * 0.6 + (app.rng.stream('cosmetic').next() - 0.5) * 1.6) * sp;
      life[i] = 0.3 + app.rng.stream('cosmetic').next() * 0.2; alpha[i] = 1; size[i] = 0.05 + app.rng.stream('cosmetic').next() * 0.05;
    }
  }
  update(dt: number, renderer: DrawingBuffer, camera: THREE.PerspectiveCamera) {
    this.uScale.value = pointScale(renderer, camera);
    let any = false;
    const { pos, vel, life: lives } = this.pool, alpha = this.pool.data.aAlpha;
    for (let i = 0; i < STAR_COUNT; i++) {
      const life0 = lives[i] ?? 0;
      if (life0 <= 0) continue;
      any = true; const life = life0 - dt; lives[i] = life;
      const j = i * 3, vy = (vel[j + 1] ?? 0) - 6 * dt; vel[j + 1] = vy;
      pos[j] = (pos[j] ?? 0) + (vel[j] ?? 0) * dt; pos[j + 1] = (pos[j + 1] ?? 0) + vy * dt; pos[j + 2] = (pos[j + 2] ?? 0) + (vel[j + 2] ?? 0) * dt;
      alpha[i] = life > 0 ? Math.min(1, life * 5) : 0;
    }
    if (any) { this.pool.posAttr.needsUpdate = true; this.pool.attr.aAlpha.needsUpdate = true; this.pool.attr.aSize.needsUpdate = true; }
  }
}

// ───────────────────────────── the sword ─────────────────────────────

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3(), _push = new THREE.Vector3();
const _aimOrigin = new THREE.Vector3(), _aimRotation = new THREE.Quaternion();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _b = new THREE.Vector3(), _g0 = new THREE.Vector3(), _g1 = new THREE.Vector3(), _t0 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _hitPoint = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** the heavy's tip glint: one additive star quad (camera space — the model group is camera-parented, so it always faces the eye) that rides the blade tip through the chop, spinning, then winks out */
class Glint {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private uAlpha: THREE.IUniform<number> = { value: 0 }; private uRot: THREE.IUniform<number> = { value: 0 };
  alpha = 0;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: this.uAlpha, uRot: this.uRot },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // a spinning four-point star with a soft core: |x|^0.5 + |y|^0.5 ≤ 1 in rotated quad space, plus a radial glow
      fragmentShader: `uniform float uAlpha; uniform float uRot; varying vec2 vUv; void main(){
        vec2 p = (vUv - 0.5) * 2.0; float c = cos(uRot), s = sin(uRot); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        vec2 d = abs(p) * 0.85; float st = sqrt(d.x) + sqrt(d.y); float star = st < 1.0 ? pow(1.0 - st, 0.6) : 0.0;
        float glow = max(0.0, 1.0 - length(p) * 1.5); glow *= glow;
        float a = (star * 1.6 + glow * 1.3) * uAlpha; if (a <= 0.002) discard; gl_FragColor = vec4(1.0, 0.97, 0.82, a); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1002; this.mesh.visible = false;
  }
  set(pos: THREE.Vector3) { this.mesh.position.copy(pos); }
  update(dt: number, t: number, lit: boolean) {
    this.alpha = lit ? Math.min(1, this.alpha + dt * 12) : Math.max(0, this.alpha - dt * 7);
    this.mesh.visible = this.alpha > 0.002;
    if (!this.mesh.visible) return;
    this.uAlpha.value = this.alpha; this.uRot.value = t * 9;
    const pulse = 1 + 0.12 * Math.sin(t * 31);
    this.mesh.scale.setScalar(pulse * (0.7 + 0.3 * this.alpha));
  }
}

/** Swept contact family executes the supplied rig, moves and reactions without a model recipe of its own. */
export class SweptMelee extends Melee {
  private readonly defaults: SweptMeleeDefaults;
  override readonly reach: number;
  private portraitPullX: number;
  private portraitFov: number;
  readonly state: WeaponState = { ammo: undefined, magazine: 30, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** the heavy's charge held externally (the touch HEAVY disc, or dev `?ads=1`); OR'ed with the right mouse button. On = charging, off = release. */
  adsHeld = false;
  /** base damage per light hit: wooden 12, iron 28 (the finisher ×1.33, the heavy ×2) */
  get damage(): number { return this.attributes['damage'] ?? this.profile.damage; }
  set damage(value: number) { this.attributes['damage'] = value; }
  /** E314 the bear claw: the heavy's damage × this (src/shards/driftwood-isle/loot/perks.ts; 1 = as built) */
  get heavyMult(): number { return this.attributes['heavyDamageMul'] ?? 1; }
  set heavyMult(value: number) { this.attributes['heavyDamageMul'] = value; }
  /** E314 sea glass charm III: 0…1, the sea-glass glow round the blade (src/engine/player/bladeGlow.ts); 0 = none, no draw */
  bladeGlow = 0;
  private glow: BladeGlow | null = null;
  /** dev: showcase pose (model centred, slowly turning) */
  inspect = 0;
  /** portrait framing (0.6): shrink, extra drop / slide (m, camera space), the blade tipped forward (rad) and turned (rad) — dev-tunable */
  framing: SwordFraming = { shrink: 0.33, dx: -0.03, dy: -0.055, tilt: 0.36, yaw: -0.02 };
  /** dev: swing duration multiplier (1 = normal; 8 = slow motion for screenshots) */
  swingScale = 1;
  /** 0..1 weapon-swap blend (a Weapons manager drives it): 1 = dropped out of the frame; 0 = held */
  holster = 0;
  /** always null: a melee weapon shows no range readout — the aimed enemy's plate is its label (Combat.ts) */
  readonly aimInfo: AimInfo | null = null;

  /** the heavy's release (after onFire): a deeper whoosh — Audio.swordHeavy() */
  onHeavy?: () => void;
  /** a swing connected (after onHit): the move and whether it killed — for a subclass's own bookkeeping (the sabre's pass
   *  chain); the kit manager never touches it, unlike onHit */
  onMoveHitEvent?: (move: Move, killed: boolean) => void;

  readonly model = new THREE.Group();
  protected game: Game; protected sky: Sky; protected player: Player;
  private targets: Targets | undefined;
  private rig = new THREE.Group(); private armRig = new THREE.Group();
  /** SwordOptions.arms (null: the rigid rig) and the group it hangs in (the holster drop) */
  private arms: SwordArms | null = null; private armsHolder = new THREE.Group(); private armsLook = new THREE.Vector2();
  private tipY = 0; private baseY = 0; private tipX = 0;
  private mv: SwordMoveSet;

  // swing / combo / heavy clock (renderer-free, combat/sweptMeleeCore.ts; the headless runtimes run the same one)
  private readonly clock: SweptMeleeCore<Move>;
  private fromPos = new THREE.Vector3(); private fromQ = new THREE.Quaternion();   // where the sword was when this swing started
  private basePos = new THREE.Vector3(); private baseQ = new THREE.Quaternion(); // this frame's pose before sway / portrait
  private hitDone = false; private kicked = false; private clanged = false;
  private fx: CameraFX;
  private impacts: Impacts;
  private iron: boolean;
  private jolt = 0;
  private dodgeLagX = 0; private dodgeLagV = 0; private dodgeSeen = 0; // the T dodge's lateral blade spring (E63)
  // heavy
  private mouseHeld = false;
  private chargeBlend = 0; private sprintBlend = 0;
  private lookBlock = viewmodel(this.profile.feel.lag);
  private lookSpring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private lookDelta = new THREE.Vector2();
  private aimBlock: ReturnType<typeof aimRay>;
  private fov = this.profile.feel.fovHip; private baseFov = 0;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseQ = new THREE.Quaternion(); private poseInit = false;
  // lunge
  private active = false; private lungeTarget: AimTarget | null = null;
  // blade sweep (C1): what this swing has struck, and last frame's blade (camera-space unit dirs from the eye, grip + tip)
  private struck: (TargetHit['animal'] | null)[] = Array.from({ length: this.profile.sweep.maxHits }, () => null); private struckN = 0;
  private sweepGrip = new THREE.Vector3(); private sweepTip = new THREE.Vector3(); private sweepHave = false;

  // trail
  private trail!: THREE.Mesh; private trailMat!: THREE.ShaderMaterial;
  private ribbon!: SlashTrail;
  private trailStyle: Move['trail'];
  private trailColor: THREE.IUniform<THREE.Color> = { value: new THREE.Color(1, 1, 1) };
  private trailInner: THREE.IUniform<number> = { value: 0 };
  private stars = new Stars();
  private glint = new Glint();
  private time = 0;

  constructor(world: SwordWorld, targets: Targets | undefined, opts: SwordOptions, defaults: SweptMeleeDefaults) {
    const profile = opts.profile;
    super({ ...profile, ...opts.row }, app.combat);
    this.defaults = defaults;
    this.mv = defaults.moves;
    this.basePos.copy(defaults.moves.rest.pos); this.baseQ.copy(defaults.moves.rest.q);
    this.trailStyle = defaults.slash.trail;
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: opts.inputContext } };
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.targets = targets;
    this.aimBlock = aimRay(() => this.player.sampleAimCommand());
    this.blocks.aim = this.aimBlock; this.blocks.vm = this.lookBlock;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.damage = opts.damage ?? profile.damage;
    this.reach = opts.reach ?? profile.reach;
    this.portraitPullX = opts.portraitPullX ?? profile.portraitPullX;
    this.portraitFov = opts.portraitFov ?? profile.feel.portraitFov ?? profile.feel.fovHip;
    this.swingScale = profile.swingScale;
    this.framing = { ...profile.framing, ...opts.framing };
    const moves = opts.moves ?? profile.moves;
    if (moves) { this.mv = moves; this.basePos.copy(moves.rest.pos); this.baseQ.copy(moves.rest.q); }
    this.clock = new SweptMeleeCore<Move>(this.mv, this.profile, { queue: () => { app.input.queue('attack'); }, consume: () => app.input.consume('attack') },
      { start: (move, lunge) => { this.startSwing(move, lunge); }, charge: (phase) => { this.chargeEvent('heavy', phase); if (phase === 0) this.arms?.play('charge'); } });
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.impacts = Impacts.for(this.game); // contact debris (C4), in the scene from boot so its program is precompiled
    this.iron = opts.blade === 'iron';
    this.fx = CameraFX.for(this.game); // camera kick / FOV punch (C3); after bootstrap, so it layers on Player.update's camera
    this.buildViewmodel(opts.rig);
    if (opts.arms) this.useArms(opts.arms);
    this.buildTrail();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.stars.points);
    this.model.add(this.glint.mesh);

  }

  // ── input ──
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.bindInput(ctx);
    ctx.scope.onDispose(() => {
      this.model.removeFromParent(); this.stars.points.removeFromParent();
      this.stars.points.geometry.dispose();
      for (const material of Array.isArray(this.stars.points.material) ? this.stars.points.material : [this.stars.points.material]) material.dispose();
      this.trail.geometry.dispose(); this.trailMat.dispose();
      this.glint.mesh.geometry.dispose();
    });
  }
  private bindInput(ctx: EquipContext): void {
    const allowed = weaponActionGate(this, this.player);
    app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, allowed);
    app.input.bind('heavy', () => { this.mouseHeld = !this.mouseHeld; }, ctx.scope, allowed);
    app.input.onReset(() => { this.mouseHeld = false; }, ctx.scope);
  }

  /**
   * A light swing (LMB / F / touch tap). Idle → the next combo swing (1 again if the last swing ended more than
   * this.profile.comboGap s ago, or the combo is spent). Mid-swing → queues the next combo swing (one deep; not off the heavy).
   * Ignored while charging the heavy.
   */
  tryFire(): void {
    if (!this.enabled) return;
    this.clock.tryFire((input) => this.pickMove(input));
  }
  /** start one specific move (outside the combo — the sabre's mounted pass slash): false when a swing or charge is running.
   *  `lunge` false = no dash onto the target (in the saddle the horse does the moving). Ends the combo. */
  strikeMove(move: Move, lunge = true): boolean {
    if (!this.enabled) return false;
    return this.clock.strike(move, lunge);
  }
  protected override pickMove(input: 'attack' | 'heavy'): Move | null {
    return this.clock.pick(input);
  }
  protected override moveDamage(move: Move): number {
    return sweptMoveDamage(this.damage, move, move === this.mv.heavy, this.heavyMult);
  }
  /** the clock started `move` (its swing time is 0 and the queued tap consumed): the presentation and the lunge */
  private startSwing(move: Move, lunge: boolean): void {
    this.hitDone = false; this.kicked = false; this.clanged = false;
    this.struckN = 0; this.struck.fill(null); this.sweepHave = false;
    this.fromPos.copy(this.basePos); this.fromQ.copy(this.baseQ);
    this.ribbon.reset(); this.trail.visible = false;
    this.trailStyle = move.trail; this.trailColor.value.copy(move.trail.color);
    // lunge onto the locked animal (a chained combo swing re-locks, so a fleeing target is chased swing by swing)
    const heavy = move === this.mv.heavy;
    const lock = lunge ? this.findLunge(heavy ? this.profile.lunge.heavyRange : this.profile.lunge.range) : null;
    this.lungeTarget = lock;
    if (lock) {
      // the dash onto it (sweptLunge, the law the headless runtimes hand to SimHost.dashTo)
      const p = this.player.position, dash = sweptLunge(this.profile.lunge, heavy, lock.position.x - p.x, lock.position.z - p.z, targetRadius(lock));
      if (dash !== null) this.player.dashTo(lock.position.x, lock.position.z, dash.stopAt, dash.time);
    }
    this.arms?.play(move.name);
    this.onSwingStart(move);
    this.onFire?.();
    if (heavy) this.onHeavy?.();
    this.defaults.events.onSwing?.(heavy ? 1 : move === this.defaults.finisher ? 0.85 : 0.7, heavy, move.sweep > 0 ? -1 : 1);
  }
  /** the animal a swing would lunge onto: alive, within `range` m (feet → body edge), inside ±this.profile.lunge.cone of the view, near the
   *  feet's height — the smallest angle wins, distance breaking near-ties */
  private findLunge(range: number): AimTarget | null {
    const p = this.player.position, yaw = this.player.yaw;
    // locked on (E50 §2.4): only ever the locked enemy — no cone check (the view is on it), and never a different one
    if (lockOn.state === 'locked') {
      const t = lockOn.target;
      if (t === null || !t.alive || t.hidden) return null;
      return Math.hypot(t.position.x - p.x, t.position.z - p.z) - targetRadius(t) <= range ? t : null;
    }
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best: AimTarget | null = null, bestScore = Infinity;
    for (const t of app.aimTargets) {
      if (!t.alive || t.hidden || Math.abs(t.position.y - p.y) > 2) continue;
      const dx = t.position.x - p.x, dz = t.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.01 || d - targetRadius(t) > range) continue;
      const angle = Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1));
      if (angle > this.profile.lunge.cone) continue;
      const score = angle / this.profile.lunge.cone + 0.3 * d / range;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  /** no ammo to add / nothing to reload */
  override addBolts(_n: number): void { /* melee */ }
  override reload(): void { /* melee */ }
  /** the aim line: the camera forward from the eye (what the crosshair shows) */
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }
  /** shown + held (true) or holstered (false: hidden, input off) */
  override setActive(on: boolean): void {
    this.model.visible = on;
    if (!on) { this.enabled = false; this.clock.stop(); this.ribbon.reset(); this.trail.visible = false; }
  }
  /** true while a swing is running (dev / tests) */
  get swinging(): boolean { return this.clock.move !== null; }
  /** the running swing's name ('slash' | 'backhand' | 'finisher' | 'heavy'), or null */
  get swingName(): Move['name'] | null { return this.clock.move?.name ?? null; }
  /** true while the running swing is the heavy */
  get heavySwing(): boolean { return this.clock.move === this.mv.heavy; }
  /** true while the heavy is being charged (RMB / HEAVY disc toggled on) */
  get chargingHeavy(): boolean { return this.clock.chargingHeavy; }
  /** 0..1 heavy charge (1 = ready to release) */
  override get charge(): number { return this.clock.charge; }
  /** which light swing the next tap throws (1..3) */
  get comboStep(): number { return this.clock.comboStep; }

  // ── viewmodel ──
  private buildViewmodel(custom: SwordRig | undefined): void {
    if (custom === undefined) throw new Error('Swept contact family: no rig supplied');
    const { sword, arms, tipY, baseY } = custom;
    this.tipY = tipY; this.baseY = baseY; this.tipX = custom.tipX ?? 0;
    const mat: THREE.Material = custom.material;
    mat.transparent = true; mat.depthWrite = true; // transparent queue, after the depth clear (see below)
    for (const [g, rig] of [[sword, this.rig], [arms, this.armRig]] as [THREE.BufferGeometry, THREE.Group][]) {
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      rig.add(mesh);
    }
    for (const x of custom.extras ?? []) {
      x.material.transparent = true; x.material.depthWrite = true;
      const mesh = new THREE.Mesh(x.geometry, x.material);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      this.rig.add(mesh);
    }
    this.model.add(this.rig, this.armRig);
    if (custom.left) {
      const l = custom.left;
      l.material.transparent = true; l.material.depthWrite = true;
      const mesh = new THREE.Mesh(l.geometry, l.material);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      mesh.position.copy(l.pos); mesh.quaternion.copy(l.q);
      this.model.add(mesh);
    }
    // The engine's shared transparent pass clears depth before any viewmodel draws.
  }

  /**
   * the arc trail (C4): a ribbon of the last this.profile.trail.samples blade positions (the outer part of the blade, per move), each
   * gap between two samples subdivided this.profile.trail.subdivisions times along a Catmull-Rom curve so a fast slash reads as a smooth arc,
   * not a polyline; additive, one draw call. Alpha by age per vertex; across the ribbon (`aEdge` 0 inner → 1 tip) the
   * fragment feathers the inner edge to the move's `inner` alpha and lays a bright core line along the tip.
   */
  /** SwordOptions.arms: the rig's root in the viewmodel group, drawn after the depth clear (renderOrder ≥ 1000, the
   *  transparent queue, as the rigid rig); the rigid rig hidden */
  private useArms(arms: SwordArms): void {
    this.arms = arms;
    arms.setup?.(this.sky);
    this.rig.visible = false; this.armRig.visible = false;
    arms.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.renderOrder = 1002 + o.renderOrder; o.frustumCulled = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof THREE.Material) { m.transparent = true; m.depthWrite = true; }
    });
    this.armsHolder.add(arms.root);
    this.model.add(this.armsHolder);
  }

  private buildTrail(): void {
    this.ribbon = new SlashTrail({ samples: this.profile.trail.samples, subdivisions: this.profile.trail.subdivisions, movementSq: 1e-4, channel: 'alpha' });
    const g = this.ribbon.geometry;
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { uColor: this.trailColor, uInner: this.trailInner },
      vertexShader: `attribute float aAlpha; attribute float aEdge; varying float vA; varying float vE; void main(){ vA = aAlpha; vE = aEdge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uInner; varying float vA; varying float vE; void main(){
        float body = mix(uInner, 1.0, smoothstep(0.0, 0.85, vE));
        float core = smoothstep(0.78, 0.96, vE) * (1.0 - smoothstep(0.985, 1.0, vE));
        gl_FragColor = vec4(uColor * (1.0 + core * 0.8), vA * (body * (1.0 - core * 0.3) + core * 0.9)); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    this.trail = new THREE.Mesh(g, this.trailMat);
    this.trail.frustumCulled = false; this.trail.renderOrder = 1001; this.trail.visible = false;
    this.model.add(this.trail); // camera space, like the rig — the ribbon is the sword's own motion, not the world's
  }
  private trailSample(): void {
    // the ribbon spans the blade from the move's `from` fraction to the tip, in the model's (camera) space
    const from = this.trailStyle.from;
    if (this.arms) { // an animated rig's blade (engineTrail): the holder's drop added, as bladeDirs
      this.arms.blade(_v1, _v2);
      _v1.lerp(_v2, from).add(this.armsHolder.position);
      _v2.add(this.armsHolder.position);
    } else {
      this.rig.updateMatrix();
      _v1.set(this.tipX * from * from, this.baseY + (this.tipY - this.baseY) * from, 0).applyMatrix4(this.rig.matrix); // a curved blade: the offset grows ~ quadratically
      _v2.set(this.tipX, this.tipY + 0.03, 0).applyMatrix4(this.rig.matrix);
    }
    this.ribbon.sample(_v1, _v2, this.time);
  }
  private trailRebuild(): void {
    this.trailInner.value = this.trailStyle.inner;
    this.trail.visible = this.ribbon.rebuild(this.time, this.trailStyle.life * this.swingScale, this.trailStyle.alpha);
  }

  // ── melee hit test: the blade swept from last frame's pose to this one (see the header) ──
  /** this frame's blade from the swing pose (basePos / baseQ, scale 1): unit dirs from the eye through the grip and tip, camera space */
  private bladeDirs(grip: THREE.Vector3, tip: THREE.Vector3): void {
    if (this.arms) { this.arms.blade(grip, tip); grip.add(this.armsHolder.position).normalize(); tip.add(this.armsHolder.position).normalize(); return; }
    grip.copy(this.basePos).normalize();
    tip.set(this.tipX, this.tipY, 0).applyQuaternion(this.baseQ).add(this.basePos).normalize();
  }
  private sweepHit(move: Move, active: boolean): void {
    this.bladeDirs(_g1, _t1);
    if (active && !this.clanged) this.clangTest(move);
    if (!active || this.targets === undefined || !this.sweepHave || !this.anyInReach()) { this.sweepGrip.copy(_g1); this.sweepTip.copy(_t1); this.sweepHave = true; return; }
    const physics = app.physics; this.aimPose(_aimOrigin, _aimRotation);
    const ang = Math.max(this.sweepGrip.angleTo(_g1), this.sweepTip.angleTo(_t1));
    const subs = Math.min(this.profile.sweep.maxSamples, Math.max(1, Math.ceil(ang / this.profile.sweep.step)));
    for (let s = 1; s <= subs && this.struckN < this.profile.sweep.maxHits; s++) {
      const f = s / subs;
      _g0.copy(this.sweepGrip).lerp(_g1, f).normalize(); _t0.copy(this.sweepTip).lerp(_t1, f).normalize();
      for (let k = 0; k < this.profile.sweep.rays * (1 + this.profile.sweep.extensions.length); k++) {
        const j = k % this.profile.sweep.rays, ext = (k - j) / this.profile.sweep.rays;
        _b.copy(_g0).lerp(_t0, j / (this.profile.sweep.rays - 1)).normalize();
        if (ext === 0) _dir.copy(_b);
        else { // under the blade: the blade point's dir pitched further down about the camera's right axis
          const a = this.profile.sweep.extensions[ext - 1] ?? 0, c = Math.cos(a), sn = Math.sin(a);
          _dir.set(_b.x, _b.y * c + _b.z * sn, -_b.y * sn + _b.z * c);
        }
        _dir.applyQuaternion(_aimRotation);
        const hit = this.targets.raycast(_aimOrigin, _dir, move.reach ?? this.reach);
        if (hit === null || !hit.animal.alive || this.struck.includes(hit.animal)) continue;
        if (bladeBlocked(physics, _aimOrigin, hit.point, this.player.motor.collider)) continue;
        this.struck[this.struckN++] = hit.animal;
        this.strike(move, hit);
        if (this.struckN >= this.profile.sweep.maxHits) break;
      }
    }
    this.sweepGrip.copy(_g1); this.sweepTip.copy(_t1);
  }
  /**
   * the blade tip meeting a wall / trunk / rock along the tip ray (MeleeSweep.bladeContact → query.castRay), once per
   * swing: a clang, debris by the struck material (stone → sparks, wood → splinters), a short stop
   */
  private clangTest(move: Move): void {
    this.aimPose(_aimOrigin, _aimRotation);
    _dir.copy(_t1).applyQuaternion(_aimRotation);
    const contact = bladeContact(app.physics, _aimOrigin, _dir, (move.reach ?? this.reach) * 0.9, this.player.motor.collider);
    if (contact === null) return;
    this.clanged = true;
    const { hit, clang } = contact;
    const point = _hitPoint.set(hit.point.x, hit.point.y, hit.point.z);
    const k = move === this.defaults.heavy ? 1 : move === this.defaults.finisher ? 0.75 : 0.5;
    _v3.set(hit.normal.x, hit.normal.y, hit.normal.z).sub(_dir).normalize(); // off the face, back toward the blade
    if (clang === 'stone') this.impacts.burst('sparks', point, _v3, Math.round((this.iron ? 10 : 5) + 8 * k));
    else {
      this.impacts.burst('wood', point, _v3, Math.round(6 + 6 * k));
      if (this.iron) this.impacts.burst('sparks', point, _v3, Math.round(6 + 8 * k));
    }
    if (!this.hitDone) { this.game.hitStop(0.045 * this.swingScale); this.jolt = 0.8; this.fx.kick(move.kick.pitch * 0.3, -move.kick.roll * 0.4); }
    this.defaults.events.onClang?.(point, k, clang);
  }
  /** a live animal's body is within REACH (+ its radius, + a metre of slack) of the eye */
  private anyInReach(): boolean {
    this.aimPose(_aimOrigin, _aimRotation); const e = _aimOrigin;
    for (const t of app.aimTargets) {
      if (!t.alive || t.hidden) continue;
      const r = this.reach + 0.6 + targetRadius(t) + 1; // + 0.6: a move may reach further than the rig (the sabre's pass)
      if (t.position.distanceToSquared(e) < r * r) return true;
    }
    return false;
  }
  private strike(move: Move, hit: TargetHit): void {
    this.aimPose(_aimOrigin, _aimRotation);
    this.aimRay(_aimOrigin, _fwd);
    // strike direction = the sweep (across the forward, the move's way), not the ray: the flinch reads as a side-on blow;
    // an overhead chop (sweep ≈ 0) drives forward and down
    _v2.copy(_fwd).applyAxisAngle(Y_AXIS, Math.PI / 2);                                       // the player's left
    _v1.copy(_fwd).multiplyScalar(0.7).addScaledVector(_v2, 0.7 * move.sweep).normalize();
    if (Math.abs(move.sweep) < 0.6) _v1.y -= 0.35 * (1 - Math.abs(move.sweep)); _v1.normalize();
    const dmg = Math.round(this.moveDamage(move));
    const point = _hitPoint.copy(hit.point); // the raycast result object is reused by the next ray
    const animal = hit.animal;
    const result = this.contact(hit.animal, dmg, point, _v1, _aimOrigin, `move.${move.name}`, true);
    if (!result) return;
    const killed = result.killed;
    animal.hitFlash?.(move === this.mv.heavy ? 1 : 0.8); // the white hit flash (C5, Animal.ts)
    // knockback: away from the player, biased the way the sweep travels (Animal.stagger flattens it)
    _push.set(_fwd.x, 0, _fwd.z).normalize().multiplyScalar(0.8).addScaledVector(_v2, 0.5 * move.sweep);
    if (!killed) animal.stagger?.(_push, move.stagger);
    // hit-stop (C2): the first contact of a swing stops the WORLD (Game.hitStop — the swing, the target, the player) for the
    // move's 60 / 90 / 140 ms; the stars, trail fade and camera kick run on worldTime.realDt through it
    if (!this.hitDone) { this.hitDone = true; this.game.hitStop(move.hitStop * this.swingScale); this.jolt = move === this.mv.heavy ? 1.6 : 1; this.fx.kick(move.kick.pitch * 0.5, move.kick.roll * 0.5); }
    this.stars.burst(point, _fwd, move === this.mv.heavy ? 14 : 9);
    // contact debris by what was struck (C4): shell shards off a crab, splinters off the sailor, a sand puff at anything
    // else's feet; the iron blade throws sparks off shell and timber
    const heavyK = move === this.mv.heavy ? 1.6 : 1;
    const debris = this.defaults.debris(animal.kind);
    const debrisPoint = debris.atFeet ? _v3.set(point.x, animal.position.y + 0.05, point.z) : point;
    this.impacts.burst(debris.surface, debrisPoint, _push, Math.round(debris.count * heavyK));
    if (this.iron && debris.sparks) this.impacts.burst('sparks', point, _push, Math.round(10 * heavyK));
    this.defaults.events.onStrike?.(animal.kind, point, move === this.mv.heavy ? 1 : move === this.defaults.finisher ? 0.75 : 0.5, killed);
    this.onHit?.(animal.kind, false, killed);
    this.onImpact?.('flesh', point);
    this.onMoveHitEvent?.(move, killed);
    this.onMoveHit(move, hit, killed);
  }

  /** evaluate a move at `t` s into it → position + quaternion (camera space, scale 1): from-pose → cocked → mid → follow-through → REST */
  private evalSwing(move: Move, t: number, outPos: THREE.Vector3, outQ: THREE.Quaternion): void {
    const k = move.keys;
    let aPos: THREE.Vector3, aQ: THREE.Quaternion, bPos: THREE.Vector3, bQ: THREE.Quaternion, t0: number, t1: number, f: number;
    if (t < k[0].t) { aPos = this.fromPos; aQ = this.fromQ; bPos = k[0].pos; bQ = k[0].q; t0 = 0; t1 = k[0].t; f = easeIn(clamp01((t - t0) / (t1 - t0))); }
    else if (t < k[1].t) { aPos = k[0].pos; aQ = k[0].q; bPos = k[1].pos; bQ = k[1].q; t0 = k[0].t; t1 = k[1].t; f = easeOut(clamp01((t - t0) / (t1 - t0))); } // snap into the slash
    else if (t < k[2].t) { aPos = k[1].pos; aQ = k[1].q; bPos = k[2].pos; bQ = k[2].q; t0 = k[1].t; t1 = k[2].t; f = clamp01((t - t0) / (t1 - t0)); }
    else { aPos = k[2].pos; aQ = k[2].q; bPos = this.mv.rest.pos; bQ = this.mv.rest.q; t0 = k[2].t; t1 = move.total; f = smoothstep(0, 1, clamp01((t - t0) / (t1 - t0))); } // settle out of it
    outPos.copy(aPos).lerp(bPos, f);
    outQ.slerpQuaternions(aQ, bQ, f);
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;

    // FOV (Hor+ on portrait; the sword never zooms) + the dodge / lunge kick while in hand (Player.fovKick — transient, so
    // the shadow cascades are only refit for a base change, not every kicked frame)
    const baseFov = fovForAspect(cam.aspect < 1 ? this.portraitFov : this.profile.feel.fovHip, cam.aspect);
    const targetFov = baseFov + (this.model.visible ? p.fovKick + this.fx.fovOffset : 0);
    if (Math.abs(targetFov - this.fov) > 0.01) {
      const refit = Math.abs(baseFov - this.baseFov) > 0.01; this.baseFov = baseFov;
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix();
      if (refit) this.sky.csm.updateFrustums();
    }

    // heavy: the hold (RMB / touch HEAVY latch) — edge on = start charging (after the running swing, if any), edge off = release;
    // then the swing clock (a hit-stop slows it with the whole world: dt is scaled, Game.hitStop): a queued combo swing
    // chains the moment the active window closes (combat/sweptMeleeCore.ts, with the cooldown)
    if (!this.enabled) this.mouseHeld = false; // pause / holster drop the RMB toggle
    const held = (this.mouseHeld || this.adsHeld) && this.enabled;
    const { move, active } = this.clock.step(dt, t, this.swingScale, held, (input) => this.pickMove(input));
    // the camera leans along the swing as the blade comes through (C3), the heavy punches the FOV in
    if (move && active && !this.kicked && this.model.visible) { this.kicked = true; this.fx.kick(move.kick.pitch, move.kick.roll); if (move.kick.fov !== undefined) this.fx.fovPunch(move.kick.fov); }
    // the melee lock (HUD brackets, touch lunge camera turn): the lunge's target while a swing runs, else what a swing would take
    // now. Every kit weapon ticks, so only the one in hand (its viewmodel shown — the kit's setActive) writes it, and the one
    // that just left the hand clears it once.
    const inHand = this.model.visible;
    if (inHand) {
      if (!move) this.lungeTarget = null;
      else if (this.lungeTarget && !this.lungeTarget.alive) this.lungeTarget = null;
      meleeLock.target = this.lungeTarget ?? (this.enabled ? this.findLunge(this.clock.chargingHeavy ? this.profile.lunge.heavyRange : this.profile.lunge.range) : null);
      meleeLock.lunging = this.lungeTarget !== null && this.player.dashing;
      this.player.swinging = move !== null;
    } else if (this.active) { meleeLock.target = null; meleeLock.lunging = false; this.player.swinging = false; this.lungeTarget = null; }
    this.active = inHand;
    this.jolt *= Math.exp(-dt * 14);

    // charge pose blend (the blade rises over the shoulder), sprint
    const charging = this.clock.chargingHeavy;
    this.state.ads = charging;
    { const step = dt / this.profile.chargeBlend; this.chargeBlend = clamp01(this.chargeBlend + THREE.MathUtils.clamp((charging ? 1 : 0) - this.chargeBlend, -step, step)); }
    this.sprintBlend += ((p.sprinting && !move && !charging ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);

    // look lag (spring, substepped like the crossbow)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lookSpring.yaw = this.lagYaw; this.lookSpring.pitch = this.lagPitch;
    this.lookSpring.yawVelocity = this.lagYawVel; this.lookSpring.pitchVelocity = this.lagPitchVel;
    this.lookBlock.step(this.lookSpring, this.lookDelta.set(dYaw, dPitch), dt);
    this.lagYaw = this.lookSpring.yaw; this.lagPitch = this.lookSpring.pitch;
    this.lagYawVel = this.lookSpring.yawVelocity; this.lagPitchVel = this.lookSpring.pitchVelocity;

    // an animated rig: its clips run on the same (world-scaled) clock, before the hit sweep reads its blade
    if (this.arms) {
      this.armsLook.set(dt > 0 ? dYaw / dt : 0, dt > 0 ? dPitch / dt : 0);
      const h = smoothstep(0, 1, this.holster);
      this.armsHolder.position.set(0, -h * 0.45, h * 0.1);
      this.arms.update(dt, { speed: p.speedFactor, walkPhase: p.bobTime, lookVel: this.armsLook, camera: cam, renderer: this.game.renderer, holster: h });
    }

    // base pose: rest, or the swing, blended toward the charge / sprint poses
    const pos = _v1, q = _q;
    if (move) this.evalSwing(move, this.clock.swingTime, pos, q);
    else { pos.copy(this.mv.rest.pos); q.copy(this.mv.rest.q); }
    const c = smoothstep(0, 1, this.chargeBlend), sp = this.sprintBlend;
    if (c > 0) {
      pos.lerp(this.mv.charge.pos, c); q.slerp(this.mv.charge.q, c);
      // charged: a taut tremble in the raised blade, and a small lift as it comes ready
      const ready = this.charge;
      pos.x += Math.sin(t * 43) * 0.0025 * ready * c; pos.y += (Math.sin(t * 37) * 0.002 + 0.02 * ready) * c;
    }
    if (sp > 0) { pos.lerp(this.mv.sprint.pos, sp); q.slerp(this.mv.sprint.q, sp); }
    this.basePos.copy(pos); this.baseQ.copy(q);
    if (move) this.sweepHit(move, active); // the blade sweep hit test, on this frame's swing pose (before sway / portrait framing)

    // idle sway / walk bob (counter-phase to the camera bob) / look lag / hit jolt — full at the hip, 30 % in the charge
    const m = 1 - c * 0.7, sf = p.speedFactor;
    const swX = Math.sin(t * this.profile.feel.sway.fx) * this.profile.feel.sway.ax, swY = Math.sin(t * this.profile.feel.sway.fy) * this.profile.feel.sway.ay;
    const bobX = Math.cos(p.bobTime) * this.profile.feel.bob.x * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * this.profile.feel.bob.y * sf;
    pos.x += (swX + bobX + this.lagYaw * this.profile.feel.lag.posYaw) * m; pos.y += (swY + bobY + this.lagPitch * this.profile.feel.lag.posPitch) * m; pos.z += this.jolt * 0.05;
    _e.set((Math.sin(p.bobTime * 2) * this.profile.feel.bob.rx * sf + this.lagPitch + this.jolt * 0.08) * m, this.lagYaw * m, (Math.sin(t * 0.5) * 0.008 + Math.cos(p.bobTime) * this.profile.feel.bob.rz * sf) * m, 'YXZ');
    q.premultiply(_q2.setFromEuler(_e));
    // the dodge (E63): the blade is flung against the dodge and whips back; a backstep pulls it straight back
    if (dodgeFx.id !== this.dodgeSeen) { this.dodgeSeen = dodgeFx.id; if (!dodgeFx.back) this.dodgeLagV = -this.profile.dodgeKick.kick * dodgeFx.side; }
    { const h = Math.min(dt, 1 / 30); this.dodgeLagV += (-this.profile.dodgeKick.k * this.dodgeLagX - this.profile.dodgeKick.c * this.dodgeLagV) * h; this.dodgeLagX += this.dodgeLagV * h; }
    if (Math.abs(this.dodgeLagX) > 1e-4) {
      pos.x += this.dodgeLagX; pos.y -= 0.35 * Math.abs(this.dodgeLagX);
      q.premultiply(_q2.setFromEuler(_e.set(0, 1.2 * this.dodgeLagX, 3.5 * this.dodgeLagX, 'YXZ')));
    }
    if (dodgeFx.t >= 0 && dodgeFx.back) pos.z += 0.06 * dodgeEnv(dodgeFx.t);

    // portrait phone: the wider FOV + narrow frame put the hands mid-screen — hold the sword lower, further out, smaller,
    // and (0.6, the mockup art/driftwood-fp-sword-wooden.png) short and low-right: the whole pose drops and slides right and
    // the blade tips forward about the hands, so at rest its tip sits below-right of the crosshair instead of on it
    this.poseExtra(pos, q, dt);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const fr = this.framing;
    const scale = 1 - portrait * fr.shrink;
    pos.x *= 1 - portrait * this.portraitPullX; pos.y *= 1 + portrait * 0.1; pos.z *= 1 + portrait * 0.45;
    pos.x += portrait * fr.dx; pos.y += portrait * fr.dy;
    if (portrait > 0) q.premultiply(_q2.setFromEuler(_e.set(-portrait * fr.tilt, portrait * fr.yaw, 0, 'YXZ')));
    if (this.holster > 0) { const h = smoothstep(0, 1, this.holster); pos.y -= h * 0.45; pos.z += h * 0.1; q.premultiply(_q2.setFromEuler(_e.set(-h * 0.6, 0, h * 0.3, 'YXZ'))); } // weapon swap: drop out of the frame
    if (this.inspect) { pos.set(0.0, -0.05, -0.75); q.setFromEuler(_e.set(0.2, Math.sin(t * 0.3) * 0.8, 0.9, 'YXZ')); }
    this.rig.scale.setScalar(scale); this.armRig.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 30) : 1; this.poseInit = true;
    this.posePos.lerp(pos, sm); this.poseQ.slerp(q, sm);
    this.rig.position.copy(this.posePos); this.rig.quaternion.copy(this.poseQ);
    // forearms: pinned to the hands, but only part of the way round with the sword (the wrists bend, the elbows stay put)
    this.armRig.position.copy(this.posePos);
    this.armRig.quaternion.copy(this.mv.rest.q).slerp(this.poseQ, this.profile.armFollow);

    // trail: sample through the slash, then fade (an animated rig draws its own, unless it asks for the engine's)
    const ownTrail = this.arms !== null && this.arms.engineTrail !== true;
    if (active && !ownTrail) this.trailSample();
    if (this.ribbon.count > 0) {
      this.trailRebuild();
      if (t - this.ribbon.newest > this.trailStyle.life * this.swingScale) this.ribbon.reset(); // every sample has faded: drop the ribbon
    }
    // the heavy's tip glint: on through the chop's active window, then winks out
    const glintOn = move === this.mv.heavy && active && !ownTrail;
    if (glintOn && this.arms) { this.arms.blade(_v1, _v2); this.glint.set(_v2.add(this.armsHolder.position)); }
    else if (glintOn) { this.rig.updateMatrix(); this.glint.set(_v2.set(this.tipX, this.tipY + 0.02, 0).applyMatrix4(this.rig.matrix)); }
    this.glint.update(worldTime.realDt, t, glintOn);
    // E314 charm III: the halo rides this frame's blade (either rig), made the first time it is on; a rig that can light its
    // own blade's edges (the castaway arms) does, breathing with the halo
    if (this.bladeGlow > 0.005) {
      this.glow ??= new BladeGlow(this.model);
      if (this.arms) { this.arms.blade(_v1, _v2); _v1.add(this.armsHolder.position); _v2.add(this.armsHolder.position); }
      else { this.rig.updateMatrix(); _v1.set(0, this.baseY, 0).applyMatrix4(this.rig.matrix); _v2.set(this.tipX, this.tipY, 0).applyMatrix4(this.rig.matrix); }
      this.glow.set(_v1, _v2, this.bladeGlow, t);
      this.arms?.glow?.(this.bladeGlow * this.glow.breath);
    } else { this.glow?.hide(); this.arms?.glow?.(0); }

    // no aim readout ("BOAR · 15 M") on a melee weapon: the aimed enemy's name plate + health bar (Combat.ts) is its one label
    // (0.6: the plate and the readout showed at once); aimInfo stays null
    this.stars.update(worldTime.realDt, this.game.renderer, cam); // particles keep flying through a hit-stop
  }
}
