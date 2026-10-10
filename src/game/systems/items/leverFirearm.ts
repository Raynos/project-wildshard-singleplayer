import { app } from '@wildshard/engine/app/runtime';
import { ads as blendAds } from '@wildshard/engine/combat/blocks/ads';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { Firearm } from '@wildshard/engine/combat/Firearm';
import type { Targets } from '@wildshard/engine/combat/types';
import { stepBrass, brassFloor } from '@wildshard/engine/combat/view/brass';
import { makeFlashTexture, HitLine } from '@wildshard/engine/combat/view/firearmFx';
import { hitscan, type HitscanProfile } from '@wildshard/engine/combat/view/hitscan';
import { Puffs, whiteColors, fovForAspect, FOV_HIP, FOV_ADS, isMesh, worldHit, fixIBL, VIEWMODEL_GROUP, type RangedOptions, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import type { WeaponState, AimInfo } from '@wildshard/engine/combat/Weapon';
import { SHADOW_LAYER } from '@wildshard/engine/core/shadowLayer';
import { mergeOrNull } from '@wildshard/engine/models/weld';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { weaponActionGate } from '@wildshard/engine/input/weaponActions';
import { sstep, clamp01 } from '@wildshard/engine/player/viewmodelTextures';
import { getSetting } from '@wildshard/engine/ui/Settings';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';

/**
 * The lever firearm family (SHARD-PLATFORM SF36): a lever-action hitscan rifle whose model, hands and action are the
 * shard's and whose numbers and view are rows. A shot fires the chambered round (hitscan along `aimRay()`, the camera
 * forward) and drops the hammer; the shard's action then throws the lever (the loop swings down, the bolt runs back and
 * cocks the hammer, the case spins out of `view.port`, the lever closes and chambers the next round). `R` (or a trigger on
 * an empty gun) reloads through the gate one round at a time (the cartridge in hand, the right hand thumbing it); a
 * trigger mid-reload stops it after the round in hand. Muzzle flash (two additive quads plus a pooled point light), pooled
 * brass, camera kick, a short tracer when the 'tracers' setting is on, impact puffs and `onFire` / `onHit` / `onImpact` /
 * `onCycle` / `onRoundIn` / `onReloadStart` / `onReloadEnd` so audio and combat feedback need no weapon-specific wiring.
 *
 * ADS = iron sights at a real eye relief: model rotation 0, the eye on the comb (`view.sight.eyeZ`) on the sight line; FOV
 * hip → ADS through `fovForAspect`; the cycle pulls the rifle off the eye.
 *
 *   export const LeverRifle = leverFirearmType({ profile: LEVER_PROFILE, build, cartridge, action, hands, view: LEVER_VIEW });
 *   const rifle = new LeverRifle(world, targets, { row: LEVER, allowUnlocked, woodFrom });
 */

/** The numbers the family reads: the hitscan's and the sights' blend (a `FirearmProfile` row satisfies it). */
export interface LeverFirearmProfile extends HitscanProfile { ads: { blend: number } }

/** The lever's cycle: idle (ready), the recoil beat before the throw, the throw, a reload through the gate. */
export type LeverPhase = 'idle' | 'beat' | 'cycle' | 'reload';
/** The action as its pure helpers see it: the tube, the chamber and the reserve. */
export interface LeverActionState { tube: number; chambered: boolean; reserve: number }
/** What the action tells its owner as it runs. */
export interface LeverFirearmHooks {
  cycle: () => void; eject: () => void; chambered: () => void; reloadStart: () => void; round: () => void; reloadEnd: () => void;
}
/** The shard's lever action (renderer-free; its headless rifle runs the same one): the tube, the chamber, the cycle, the gate. */
export interface LeverFirearmAction {
  readonly action: LeverActionState; readonly rounds: number; readonly chambered: boolean; readonly tube: number;
  readonly phase: LeverPhase; readonly phaseT: number; readonly cycleU: number; readonly hammerCocked: boolean;
  readonly wantsAutoReload: boolean; readonly fed: number; readonly planned: number; readonly reloadProgress: number;
  readonly dropHammer: () => void; readonly throwLever: () => void; readonly triggerWhileReloading: () => void;
  readonly beginReload: () => boolean; readonly step: (dt: number, autoDue: boolean, hooks: LeverFirearmHooks) => void;
}

/** A build's parts in model space (−Z along the bore, +Y up, the bore axis at y 0; the lever / hammer about their pivots). */
export interface LeverFirearmParts {
  readonly wood: THREE.BufferGeometry; readonly stock: THREE.BufferGeometry; readonly steel: THREE.BufferGeometry;
  readonly lever: THREE.BufferGeometry; readonly hammer: THREE.BufferGeometry; readonly bolt: THREE.BufferGeometry;
  readonly leverPivot: THREE.Vector3; readonly gate: THREE.Vector3;
}
/** A build: its three materials (the viewmodels' shared lit program), its parts and the front sight's bead. */
export interface LeverFirearmBuild {
  readonly brassMat: THREE.MeshPhysicalMaterial; readonly woodMat: THREE.MeshPhysicalMaterial; readonly steelMat: THREE.MeshPhysicalMaterial;
  readonly parts: LeverFirearmParts; readonly beadGeo: THREE.BufferGeometry;
}

/** A hand grip: the fist's point, its axis and its palm normal (model space). */
export interface LeverGrip { readonly at: THREE.Vector3; readonly axis: THREE.Vector3; readonly palm: THREE.Vector3 }
/** The shard's hands on the model: the right re-posed every frame, measured for the cost readout, disposed on a rebuild. */
export interface LeverFirearmHands {
  readonly group: THREE.Object3D; readonly right: THREE.Object3D;
  readonly placeRight: (grip: LeverGrip) => void;
  readonly cost: { draws: number; tris: number; verts: number; bytes: number };
  readonly dispose: () => void;
}
/** A pair of hands as built: the hands, the right's rest grip (on the wrist, fingers in the loop) and its grip at the
 *  gate (relative to the cartridge's base). */
export interface LeverFirearmHandsBuilt { readonly hands: LeverFirearmHands; readonly rest: LeverGrip; readonly gate: LeverGrip }
/** The shard's hands: the maker (called once with the scene's sky; each call of what it returns builds a pair), a blank
 *  grip and the grip blend. */
export interface LeverFirearmHandsKit {
  readonly make: (sky: Sky) => (model: THREE.Group) => LeverFirearmHandsBuilt;
  readonly grip: () => LeverGrip;
  readonly blend: (a: LeverGrip, b: LeverGrip, t: number, out: LeverGrip) => LeverGrip;
}

/** The family's view as rows (metres, seconds, radians). */
export interface LeverFirearmView {
  /** rounds in the gun when full, and the reserve it starts with */
  readonly magazine: number; readonly reserve: number;
  /** the camera kick per shot (rad) */
  readonly kick: number;
  /** the muzzle flash: quads shown `frames` frames, the light `lightTime` s at `light` intensity */
  readonly flash: { readonly frames: number; readonly lightTime: number; readonly light: number };
  readonly brass: { readonly count: number; readonly life: number };
  readonly tracer: { readonly count: number; readonly time: number };
  /** how much of the hip's motion the sights keep */
  readonly adsMotion: number;
  /** the lever's throw (rad), the bolt's travel (m), the hammer down / cocked (rad), how much of the throw the hand turns with */
  readonly lever: { readonly open: number; readonly boltTravel: number; readonly hammerDown: number; readonly hammerCocked: number; readonly handTurn: number };
  /** the sight line over the bore, the eye on the comb, the rear and front sights and the muzzle (model z) */
  readonly sight: { readonly y: number; readonly eyeZ: number; readonly rearZ: number; readonly frontZ: number; readonly muzzleZ: number };
  readonly hammerPivot: readonly [number, number, number];
  /** the ejection port, where the case leaves */
  readonly port: readonly [number, number, number];
  /** the action's clock: the dry pull's auto-reload delay, the loading roll in / out, one round through the gate */
  readonly timing: { readonly autoReloadDelay: number; readonly reloadIn: number; readonly reloadOut: number; readonly roundTime: number };
  /** the hip pose (lower right) and the model's scale */
  readonly hip: { readonly px: number; readonly py: number; readonly pz: number; readonly rx: number; readonly ry: number; readonly rz: number; readonly scale: number };
  /** the lever thrown, added to the hip pose at full throw */
  readonly cyclePose: { readonly px: number; readonly py: number; readonly pz: number; readonly rx: number; readonly ry: number; readonly rz: number };
}

export interface LeverFirearmOptions<P extends LeverFirearmProfile> extends RangedOptions {
  profile: P;
  /** the rifle's model, built at the viewmodel's build from the scene's sky */
  build: (sky: Sky) => LeverFirearmBuild;
  /** a cartridge (tip at −Z); `live` has the bullet, an empty is the case alone */
  cartridge: (live: boolean) => THREE.BufferGeometry;
  /** the shard's action on the HUD state (its reserve) */
  action: (store: { reserve: number }) => LeverFirearmAction;
  hands: LeverFirearmHandsKit;
  view: LeverFirearmView;
  /** take the muzzle flash's light from the scene's LightPool at boot (default) */
  muzzleLight?: boolean;
}

interface Brass { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; down: boolean; floor: number }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
/** the display model's shadow: depth only, on SHADOW_LAYER (front-sided like the lever's materials, so the same depth) */
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false });

/** the lever's throw over one cycle u 0..1: down fast, a beat open, up and home */
export function leverOpen(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.4) return sstep(0, 0.4, u);
  if (u < 0.52) return 1;
  return 1 - sstep(0.52, 1, u);
}

/** A lever firearm: the shard's model, hands, action and rows on the platform's trigger, hitscan, cycle, gate, brass and pose. */
export class LeverFirearm<P extends LeverFirearmProfile = LeverFirearmProfile> extends Firearm {
  readonly profile: P;
  readonly view: LeverFirearmView;
  readonly state: WeaponState & { ammo: number };
  enabled = true;
  allowUnlocked = false;
  adsHeld = false;
  holster = 0;
  aimInfo: AimInfo | null = null;
  private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };

  /** the lever is thrown (a cycle starts) — the 'leverCycle' sound */
  onCycle?: () => void;
  /** a cartridge went through the loading gate */
  onRoundIn?: () => void;

  readonly model = new THREE.Group();
  private readonly game: RangedWorld['game']; private readonly sky: RangedWorld['sky']; private readonly player: RangedWorld['player'];
  private readonly targets: Targets | undefined;
  private active = true;

  /** the action (the shard's, its headless rifle's too); the reserve is the HUD state's */
  private readonly act: LeverFirearmAction;
  /** what the action tells the view and the sounds */
  private readonly hooks: LeverFirearmHooks = {
    cycle: () => { this.equipEvents?.emit('weapon.action', { id: this.row.id, phase: 'cycle' }); this.onCycle?.(); },
    eject: () => { this.ejectCase(); },
    chambered: () => { this.syncState(); },
    reloadStart: () => { this.state.reloadProgress = 0; this.syncState(); this.onReloadStart?.(); },
    round: () => { this.equipEvents?.emit('weapon.reload', { id: this.row.id, phase: 'round' }); this.onRoundIn?.(); },
    reloadEnd: () => { this.state.reloadProgress = 0; this.syncState(); this.onReloadEnd?.(); },
  };
  /** dev (the evidence strip): hold the cycle at u (0..1) — `__weapons.get('rifle').freezeCycle = 0.45`; null = live */
  freezeCycle: number | null = null;
  /** dev: > 0 = the rifle held out side-on for inspection, turned `inspectYaw` rad (π/2: the right side, the gate) */
  inspect = 0; inspectYaw = Math.PI / 2;

  // parts
  private readonly stock: THREE.Mesh;
  /** where the loading gate is (the cartridge's reload path aims at it) — the build's */
  private readonly gate: THREE.Vector3;
  private readonly lever: THREE.Mesh; private readonly hammer: THREE.Mesh; private readonly bolt: THREE.Mesh; private readonly round: THREE.Mesh;
  private readonly flash = new THREE.Group(); private readonly flashQuads: THREE.Mesh[] = []; private readonly flashLight: THREE.PointLight;
  private flashFrames = 0; private flashLightT = 0;
  private readonly displayParts: { geo: THREE.BufferGeometry; mat: THREE.Material; pos?: THREE.Vector3; rot?: THREE.Euler }[] = [];
  private readonly brass: Brass[] = [];
  private readonly brassMat: THREE.MeshPhysicalMaterial;
  private readonly caseGeo: THREE.BufferGeometry;
  private readonly tracers: HitLine[] = []; private readonly tracerRes = new THREE.Vector2();
  private readonly puffs = new Puffs();
  /** the shard's hands on the model (LeverFirearmOptions.hands), null without */
  private hands: LeverFirearmHands | null = null;
  private readonly makeHands: ((model: THREE.Group) => LeverFirearmHandsBuilt) | null;
  private readonly leverPivot: THREE.Vector3;
  private readonly hammerPivot: THREE.Vector3; private readonly port: THREE.Vector3;
  /** the right hand's grips: at rest (the shard's), at the gate (the shard's, relative to the round's base), through a
   *  cycle, held at the gate, and the blend posed */
  private readonly grips: { rest: LeverGrip; gate: LeverGrip; cyc: LeverGrip; held: LeverGrip; out: LeverGrip };
  private readonly blendGrip: LeverFirearmHandsKit['blend'];

  // pose
  private recoil = 0; private kickPending = 0; private kickApplied = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private readonly posePos = new THREE.Vector3(); private readonly poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private loadBlend = 0;
  private time = 0;
  tracerLife: number;
  /** hip pose (lower-right); a dev knob: `__weapons.get('rifle').hip.py = …` */
  readonly hip: { px: number; py: number; pz: number; rx: number; ry: number; rz: number; scale: number };
  /** the lever's throw, added to the hip pose at full throw (dev knob) */
  readonly cyclePose: { px: number; py: number; pz: number; rx: number; ry: number; rz: number };
  /** the solved sighted pose (dev / verification) */
  readonly adsPose = { px: 0, py: 0, pz: 0, scale: 0, rearDepth: 0, frontDepth: 0 };

  constructor(world: RangedWorld, targets: Targets | undefined, opts: LeverFirearmOptions<P>) {
    super(opts.row);
    this.profile = opts.profile;
    this.view = opts.view;
    this.state = { ammo: opts.view.magazine, magazine: opts.view.magazine, reserve: opts.view.reserve, loaded: true, reloading: false, reloadProgress: 0, ads: false };
    this.act = opts.action(this.state);
    const kit = opts.hands;
    this.grips = { rest: kit.grip(), gate: kit.grip(), cyc: kit.grip(), held: kit.grip(), out: kit.grip() };
    this.blendGrip = kit.blend;
    this.tracerLife = opts.view.tracer.time;
    this.hip = { ...opts.view.hip }; this.cyclePose = { ...opts.view.cyclePose };
    this.hammerPivot = new THREE.Vector3(...opts.view.hammerPivot); this.port = new THREE.Vector3(...opts.view.port);
    this.makeHands = kit.make(world.sky);
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.ranged' } };
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.flashLight = opts.muzzleLight === false ? new THREE.PointLight(0xffb060, 0, 8, 2) : LightPool.for(this.game.scene).acquire(0xffb060, 0, 8, 2);
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;

    const { brassMat, woodMat, steelMat, parts, beadGeo } = opts.build(this.sky);
    this.brassMat = brassMat;
    this.gate = parts.gate;
    this.leverPivot = parts.leverPivot.clone();
    // the stock is its own draw: sighted, the wrist and comb sit under the eye (a flat brown plane across the view) — hidden
    this.stock = new THREE.Mesh(parts.stock, woodMat);
    const meshW = new THREE.Mesh(parts.wood, woodMat), meshS = new THREE.Mesh(parts.steel, steelMat), meshB = new THREE.Mesh(beadGeo, this.brassMat);
    this.model.add(meshW, this.stock, meshS, meshB);
    // ── animated: the lever (in its pivot's frame), the hammer, the bolt, the cartridge being thumbed in ──
    this.lever = new THREE.Mesh(parts.lever, steelMat); this.lever.position.copy(parts.leverPivot);
    this.hammer = new THREE.Mesh(parts.hammer, steelMat); this.hammer.position.copy(this.hammerPivot); this.hammer.rotation.x = this.view.lever.hammerCocked;
    this.bolt = new THREE.Mesh(parts.bolt, steelMat);
    this.caseGeo = opts.cartridge(false);
    this.round = new THREE.Mesh(opts.cartridge(true), this.brassMat); this.round.visible = false;
    this.model.add(this.lever, this.hammer, this.bolt, this.round);
    this.displayParts.push({ geo: parts.wood, mat: woodMat }, { geo: parts.stock, mat: woodMat }, { geo: parts.steel, mat: steelMat }, { geo: beadGeo, mat: this.brassMat },
      { geo: parts.lever, mat: steelMat, pos: parts.leverPivot.clone() }, { geo: parts.hammer, mat: steelMat, pos: this.hammerPivot.clone(), rot: new THREE.Euler(this.view.lever.hammerDown, 0, 0) }, { geo: parts.bolt, mat: steelMat });

    // ── muzzle flash: two additive quads (Rifle.ts's sprite), the pooled light ──
    const flashMat = new THREE.MeshBasicMaterial({ map: makeFlashTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const fq = new THREE.PlaneGeometry(0.2, 0.2);
    const q1 = new THREE.Mesh(fq, flashMat), q2 = new THREE.Mesh(fq, flashMat); q2.rotation.y = Math.PI / 2; q2.position.z = -0.06; q2.scale.set(1.5, 0.55, 1);
    this.flashQuads.push(q1, q2); this.flash.add(q1, q2);
    this.flash.position.set(0, 0, this.view.sight.muzzleZ - 0.02); this.flash.visible = false;
    this.model.add(this.flash);

    // depth clear + render after the world (Crossbow.ts / Rifle.ts)
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = m !== clearer;
      if (m === clearer) return;
      m.renderOrder = this.flashQuads.includes(m) ? 1001 : 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; if (mat !== flashMat) mat.depthWrite = true; }
    });

    whiteColors(this.caseGeo);
    for (let i = 0; i < this.view.brass.count; i++) {
      const mesh = new THREE.Mesh(this.caseGeo, this.brassMat);
      mesh.visible = false; mesh.frustumCulled = false;
      this.game.scene.add(mesh);
      this.brass.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, down: false, floor: 0 });
    }
    for (let i = 0; i < this.view.tracer.count; i++) this.tracers.push(new HitLine(this.game.scene));

    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.puffs.points);

    this.syncState();
    this.buildHands();
  }

  private buildHands(): void {
    const made = this.makeHands?.(this.model);
    if (made === undefined) { this.hands = null; return; }
    this.grips.rest = made.rest; this.grips.gate = made.gate;
    this.hands = made.hands;
  }
  /** dev: rebuild the hands after editing the shard's holds */
  rebuildHands(): void { this.hands?.dispose(); this.buildHands(); }
  /** dev / the cost readout: what the hands add (null: not made yet) */
  get handsCost(): LeverFirearmHands['cost'] | null { return this.hands?.cost ?? null; }

  /** the right hand: on the wrist, its fingers in the loop — thrown with the lever through a cycle; on a reload, behind the
   *  cartridge it thumbs through the gate */
  private poseRightHand(open: number): void {
    const hands = this.hands;
    if (hands === null || !hands.group.visible) return;
    const g = this.grips, piv = this.leverPivot;
    // the fist rides the loop; the hand turns with it only part of the way (the wrist gives, the forearm stays low)
    _q.setFromAxisAngle(_v3.set(1, 0, 0), this.view.lever.open * open);
    g.cyc.at.copy(g.rest.at).sub(piv).applyQuaternion(_q).add(piv);
    _q.setFromAxisAngle(_v3, this.view.lever.open * open * this.view.lever.handTurn);
    g.cyc.axis.copy(g.rest.axis).applyQuaternion(_q); g.cyc.palm.copy(g.rest.palm).applyQuaternion(_q);
    const k = sstep(0, 1, this.loadBlend);
    if (k > 0.001) {
      // the round's base (its rim at +z 0.0255) while one is in hand, else hovering by the gate
      const base = this.round.visible ? _v1.copy(this.round.position).add(_v2.set(0, 0, 0.0255)) : _v1.copy(this.gate).add(_v2.set(0.03, -0.03, 0.08));
      g.held.at.copy(g.gate.at).add(base); g.held.axis.copy(g.gate.axis); g.held.palm.copy(g.gate.palm);
      this.blendGrip(g.cyc, g.held, k, g.out);
    } else { g.out.at.copy(g.cyc.at); g.out.axis.copy(g.cyc.axis); g.out.palm.copy(g.cyc.palm); }
    hands.placeRight(g.out);
    hands.right.visible = this.stock.visible; // sighted, the wrist is under the eye: the hand goes with the stock
  }

  // ── input ──
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.bindInput(ctx);
    ctx.scope.onDispose(() => { this.model.removeFromParent(); });
  }
  private bindInput(ctx: EquipContext): void {
    const allowed = weaponActionGate(this, this.player);
    app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, allowed);
    app.input.bind('aim', () => { this.mouseAds = !this.mouseAds; }, ctx.scope, allowed);
    app.input.bind('reload', () => { this.reload(); }, ctx.scope, allowed);
    app.input.onReset(() => { this.mouseAds = false; }, ctx.scope);
  }

  override setActive(on: boolean): void {
    this.active = on;
    this.model.visible = on;
    if (!on) { this.enabled = false; this.mouseAds = false; }
  }

  /** rounds in the gun, the chamber, the reserve → the HUD's state */
  private syncState(): void {
    const s = this.state;
    s.ammo = this.act.rounds;
    s.loaded = this.act.chambered;
    s.reloading = this.act.phase === 'reload';
  }
  /** the action as the pure helpers see it */
  get action(): LeverActionState { return this.act.action; }
  /** the action's phase (idle, the beat, the throw, a reload) */
  private get phase(): LeverPhase { return this.act.phase; }
  /** 0..1 through the lever's throw (0 when it is shut) */
  get cycleU(): number { return this.freezeCycle ?? this.act.cycleU; }

  /** Pull the trigger: fire the chambered round; mid-reload, stop after the round in hand; empty → the dry click + a reload. */
  protected override reloadingAction(): boolean { return this.act.phase === 'reload'; }
  protected override actionReady(): boolean { return this.act.phase === 'idle'; }
  protected override roundReady(): boolean { return this.act.chambered; }
  protected override onTriggerWhileReloading(): void { this.act.triggerWhileReloading(); }
  protected override onEmptyTrigger(): void { if (this.act.tube > 0) this.startCycle(); else if (this.state.reserve > 0) this.reload(); }

  override reload(): void { if (this.act.beginReload()) this.hooks.reloadStart(); }

  addRounds(n: number): void { this.state.reserve += n; }
  override addBolts(n: number): void { this.addRounds(n); }

  protected override fire(): void {
    this.act.dropHammer();
    this.recoil = 1; this.kickPending = this.view.kick;
    this.flashFrames = this.view.flash.frames; this.flashLightT = this.view.flash.lightTime;
    for (const q of this.flashQuads) { q.rotation.z = app.rng.stream('cosmetic').next() * Math.PI * 2; q.scale.setScalar(0.8 + app.rng.stream('cosmetic').next() * 0.5); }
    this.flash.visible = true; this.flashLight.intensity = this.view.flash.light; this.placeFlashLight();
    this.syncState();
    this.onFire?.();
    this.hitscan();
  }

  private startCycle(): void { this.act.throwLever(); this.hooks.cycle(); }

  private placeFlashLight(): void {
    this.model.updateWorldMatrix(true, false);
    this.model.localToWorld(this.flashLight.position.set(0, 0.03, this.view.sight.muzzleZ + 0.1));
  }

  /** the aim line is the camera forward, hip or sighted */
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }

  private hitscan(): void {
    const result = hitscan((origin, dir) => this.aimRay(origin, dir), this.targets, this.profile, this.adsBlend, 0, this.player.speedFactor);
    const { point, direction, surface, hit, killed } = result;
    if (hit) this.onHit?.(hit.animal.kind, hit.headshot, killed);
    _d.copy(direction);
    if (getSetting('tracers')) {
      const tr = this.tracers.reduce((acc, x) => (x.t0 < acc.t0 ? x : acc));
      this.model.updateMatrixWorld();
      this.model.localToWorld(_v3.set(0, 0, this.view.sight.muzzleZ));
      tr.show(_v3, point, this.time);
    }
    if (surface) { this.puffs.emit(point, _d, surface); this.onImpact?.(surface, point); }
  }

  /** A world-space copy for the cabin pickup / the skin drops: the same geometry, its own copies of the materials (one
   *  program), hammer down. */
  displayModel(): THREE.Group {
    // one mesh per material (PINE-HOLLOW PH-P2): the seven parts were 7 draws + 7 per shadow cascade wherever the pickup
    // was in range; the posed parts are baked into their material's geometry (the same triangles)
    const g = new THREE.Group();
    // the copy's own materials (PH-C11): the pickup orb tints its item's materials, and on shared ones the glow sat on the
    // rifle in your hands until the orb was taken. A clone is the same program: the dfg fix's group and the sky's CSM
    // hooks re-applied, as a skin's clones (Skins.cloneWith)
    const own = new Map<THREE.Material, THREE.Material>();
    const copyOf = (m: THREE.Material): THREE.Material => {
      let c = own.get(m);
      if (!c) { c = m.clone(); c.name = m.name; fixIBL(c, VIEWMODEL_GROUP); this.sky.setupMaterial(c); own.set(m, c); }
      return c;
    };
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const xf = new THREE.Matrix4(), quat = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    for (const { geo, mat, pos, rot } of this.displayParts) {
      const part = pos || rot ? geo.clone().applyMatrix4(xf.compose(pos ?? new THREE.Vector3(), rot ? quat.setFromEuler(rot) : quat.identity(), one)) : geo;
      const list = byMat.get(mat) ?? [];
      list.push(part);
      byMat.set(mat, list);
    }
    const positions: THREE.BufferGeometry[] = [];
    for (const [mat, parts] of byMat) {
      const merged = parts.length > 1 ? mergeOrNull(parts) : parts[0] ?? null;
      for (const geo of merged === null ? parts : [merged]) {
        const m = new THREE.Mesh(geo, copyOf(mat));
        m.castShadow = false; m.receiveShadow = true;
        g.add(m);
        const p = new THREE.BufferGeometry(); p.setAttribute('position', geo.getAttribute('position')); p.setIndex(geo.getIndex());
        positions.push(p);
      }
    }
    // one shadow draw per cascade for the three materials' parts (3 → 1)
    const indexed = positions.every((p) => p.getIndex() !== null);
    // three types mergeGeometries non-null; it returns null (and logs) on mismatched attributes: then each part casts itself
    const caster = mergeOrNull(indexed ? positions : positions.map((p) => (p.getIndex() === null ? p : p.toNonIndexed())));
    if (caster !== null) {
      const proxy = new THREE.Mesh(caster, DEPTH_ONLY);
      proxy.castShadow = true; proxy.layers.set(SHADOW_LAYER);
      g.add(proxy);
    } else for (const m of g.children) m.castShadow = true;
    return g;
  }

  private ejectCase(): void {
    const b = this.brass.find((x) => x.life <= 0) ?? this.brass.reduce((acc, x) => (x.life < acc.life ? x : acc));
    const cam = this.game.camera;
    this.model.updateMatrixWorld();
    this.model.localToWorld(b.mesh.position.copy(this.port));
    _v1.set(1, 0, 0).applyQuaternion(cam.quaternion); _v2.set(0, 1, 0).applyQuaternion(cam.quaternion); cam.getWorldDirection(_v3);
    // Winchester top eject: up and a little right and back, spinning end over end
    b.vel.copy(_v2).multiplyScalar(2.6 + app.rng.stream('cosmetic').next() * 0.6).addScaledVector(_v1, 0.8 + app.rng.stream('cosmetic').next() * 0.5).addScaledVector(_v3, -0.6 + app.rng.stream('cosmetic').next() * 0.2);
    b.spin.set(18 + app.rng.stream('cosmetic').next() * 12, (app.rng.stream('cosmetic').next() - 0.5) * 8, (app.rng.stream('cosmetic').next() - 0.5) * 8);
    b.mesh.quaternion.copy(cam.quaternion).multiply(_q.setFromAxisAngle(_v1.set(1, 0, 0), -Math.PI / 2));
    b.life = this.view.brass.life; b.down = false; b.mesh.visible = true;
    b.floor = brassFloor(b.mesh.position, b.vel) + 0.006;
  }
  private stepBrass(dt: number): void { stepBrass(this.brass, dt); }

  /** Sighted: rotation 0, the eye on the comb on the sight line — the bead in the notch on the crosshair. */
  private solveAds(scale: number): LeverFirearm['adsPose'] {
    const sight = this.view.sight;
    const o = this.adsPose;
    if (o.scale === scale) return o;
    o.scale = scale; o.px = 0; o.py = -sight.y * scale; o.pz = -sight.eyeZ * scale;
    o.rearDepth = (sight.eyeZ - sight.rearZ) * scale; o.frontDepth = (sight.eyeZ - sight.frontZ) * scale;
    return o;
  }

  // ── per frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.sinceEmpty += dt;
    this.stepAction(dt);

    // the parts: lever, bolt, hammer from the cycle; the cartridge in hand on a reload
    const open = this.freezeCycle !== null || this.phase === 'cycle' ? leverOpen(this.cycleU) : 0;
    this.animateAction(t, dt);

    // muzzle flash
    if (this.flashFrames > 0 && --this.flashFrames === 0) this.flash.visible = false;
    if (this.flashLightT > 0) { this.flashLightT -= dt; this.flashLight.intensity = this.flashLightT <= 0 ? 0 : this.view.flash.light * clamp01(this.flashLightT / this.view.flash.lightTime); this.placeFlashLight(); }

    // ADS + FOV (only the held weapon owns the FOV)
    const s = this.state;
    if (p.sprinting || !this.enabled) this.mouseAds = false;
    s.ads = (this.mouseAds || this.adsHeld) && this.enabled && this.phase !== 'reload' && !p.sprinting;
    this.adsBlend = blendAds(this.adsBlend, s.ads, dt, this.profile.ads.blend);
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (this.active && Math.abs(targetFov - this.fov) > 0.01) { this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums(); }

    // recoil + camera kick (a .30-30 shoves: up hard, recovered over ~0.3 s)
    this.recoil *= Math.exp(-dt * 10);
    if (this.kickPending > 0) { const k = Math.min(this.kickPending, this.view.kick * dt * 30); p.pitch += k; this.kickApplied += k; this.kickPending -= k; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 6); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring, substepped — Crossbow.ts)
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

    // pose: hip ↔ sighted ↔ sprint ↔ the loading roll ↔ the lever's rock ↔ holster
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const loading = this.phase === 'reload' ? 1 : 0;
    this.loadBlend += (loading - this.loadBlend) * Math.min(1, dt / (loading ? this.view.timing.reloadIn : this.view.timing.reloadOut) * 2.2);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), ld = sstep(0, 1, this.loadBlend);
    const port = portrait, scale = this.hip.scale * (1 - port * 0.14);
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.014 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.011 * sf, bobRz = Math.cos(p.bobTime) * 0.018 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.009 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil, cy = open; // the lever's rock follows the throw
    let { px, py, pz, rx, ry, rz } = this.hip;
    px += sp * -0.06; py += sp * -0.08; pz += sp * 0.05; rx += sp * 0.3; ry += sp * 0.5; rz += sp * -0.12;
    // the loading pose: rolled right side up toward you, the gate in view, muzzle a touch high
    px += ld * -0.05; py += ld * 0.01; pz += ld * 0.05; rx += ld * 0.16; ry += ld * -0.32; rz += ld * -0.62;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.07; py += rc * 0.012; rx += rc * 0.1; rz += rc * -0.02;
    { const c = this.cyclePose; px += cy * c.px; py += cy * c.py; pz += cy * c.pz; rx += cy * c.rx; ry += cy * c.ry; rz += cy * c.rz; } // the lever thrown: the rifle cants, the loop swings clear
    px *= 1 - port * 0.35; py *= 1 + port * 0.25; pz *= 1 + port * 0.35;
    if (a > 0) {
      const ads = this.solveAds(scale), m = this.view.adsMotion;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.008 - cy * 0.03 * scale, az = ads.pz + rc * 0.03 + cy * 0.02;
      const arx = (bobRx + lagRx) * m + rc * 0.06 - cy * 0.05, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.012 + cy * 0.06;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.3; pz += h * 0.06; rx -= h * 0.5; rz += h * 0.2; }
    if (this.inspect > 0) { px = 0; py = -0.02; pz = -1.15 / this.inspect; rx = 0; ry = this.inspectYaw; rz = 0; }
    this.stock.visible = a < 0.85 || this.inspect > 0;
    this.model.scale.setScalar(scale);
    const sm = this.inspect > 0 ? 1 : this.poseInit ? Math.min(1, dt * 16) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);

    // aim readout (held weapon only)
    if (this.active && this.targets && (++this.aimFrame & 3) === 0) {
      this.aimRay(_o, _d);
      const wall = worldHit(_o, _v2.copy(_o).addScaledVector(_d, 150), 0);
      const hit = this.targets.raycast(_o, _d, wall?.distance ?? 150);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBrass(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, this.tracerRes, this.tracerLife);
  }

  /** the action's clock: the recoil beat → the lever cycle → idle; the reload's rounds */
  private stepAction(dt: number): void {
    if (this.freezeCycle !== null) return;
    this.act.step(dt, this.autoReloadDue(), this.hooks);
    this.state.reloadProgress = this.act.reloadProgress;
    this.syncState();
  }
  protected override animateAction(_t: number, dt: number): void {
    const u = this.cycleU, open = this.freezeCycle !== null || this.act.phase === 'cycle' ? leverOpen(u) : 0;
    this.lever.rotation.x = this.view.lever.open * open;
    this.bolt.position.z = this.view.lever.boltTravel * open;
    const cocked = this.freezeCycle !== null ? u >= 0.2 : this.act.hammerCocked;
    this.hammer.rotation.x += ((cocked ? this.view.lever.hammerCocked : this.view.lever.hammerDown) - this.hammer.rotation.x) * Math.min(1, dt * (cocked ? 18 : 60));
    this.poseRound();
    this.poseRightHand(open);

  }
  protected override autoReloadDue(): boolean {
    return this.act.wantsAutoReload && this.sinceEmpty > this.view.timing.autoReloadDelay && this.sinceEmpty < 5 && this.active && this.enabled;
  }

  private poseRound(): void {
    if (this.act.phase !== 'reload') { this.round.visible = false; return; }
    const inT = this.act.phaseT - this.view.timing.reloadIn;
    if (inT < 0 || this.act.fed >= this.act.planned) { this.round.visible = false; return; }
    const k = (inT % this.view.timing.roundTime) / this.view.timing.roundTime;
    this.round.visible = k < 0.8;
    const approach = sstep(0, 0.45, k), push = sstep(0.45, 0.8, k);
    const gate = this.gate;
    this.round.position.set(gate.x + 0.03 * (1 - approach) + 0.003, gate.y - 0.03 * (1 - approach), gate.z + 0.03 + 0.05 * (1 - approach) - push * 0.05);
    this.round.rotation.set(0, -0.35 * (1 - approach), 0);
  }
}

/** A shard's lever-action as a row: its default profile, model and cartridge builders, action, hands and view. `B` is the
 *  shard's own construction options its builder reads (a model to build from, a viewmodel to borrow a texture from). */
export interface LeverFirearmRow<P extends LeverFirearmProfile, B extends object> {
  readonly profile: P;
  readonly build: (sky: Sky, opts: B) => LeverFirearmBuild;
  readonly cartridge: (live: boolean) => THREE.BufferGeometry;
  readonly action: (store: { reserve: number }) => LeverFirearmAction;
  readonly hands: LeverFirearmHandsKit;
  readonly view: LeverFirearmView;
}
/** Construction of a row-bound lever-action: its equipment row, an optional profile, the muzzle light and the shard's own. */
export type LeverFirearmRowOptions<P extends LeverFirearmProfile, B extends object> = RangedOptions & { profile?: P; muzzleLight?: boolean } & B;
/** The constructor a row binds: `new LeverRifle(world, targets, { row })`, as every other held weapon is built. */
export interface LeverFirearmType<P extends LeverFirearmProfile, B extends object> {
  new (world: RangedWorld, targets: Targets | undefined, opts: LeverFirearmRowOptions<P, B>): LeverFirearm<P>;
  readonly prototype: LeverFirearm<P>;
}
/**
 * Bind a shard's row to the family (SHARD-PLATFORM SF36): the shard writes data and a model, never a subclass.
 *
 *   export const LeverRifle = leverFirearmType({ profile: LEVER_PROFILE, build, cartridge, action, hands, view: LEVER_VIEW });
 *   const rifle = new LeverRifle(world, targets, { row: LEVER, allowUnlocked, woodFrom });
 */
export function leverFirearmType<P extends LeverFirearmProfile, B extends object>(row: LeverFirearmRow<P, B>): LeverFirearmType<P, B> {
  return class extends LeverFirearm<P> {
    constructor(world: RangedWorld, targets: Targets | undefined, opts: LeverFirearmRowOptions<P, B>) {
      super(world, targets, { ...opts, profile: opts.profile ?? row.profile, build: (sky) => row.build(sky, opts), cartridge: row.cartridge, action: row.action, hands: row.hands, view: row.view });
    }
  };
}
