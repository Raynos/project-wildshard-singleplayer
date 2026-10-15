import { HeldPlayback } from '@wildshard/game/plugin/weaponFamily';
import playback from '../../data/heldPlayback.json' with { type: 'json' };
import inputs from '../../data/heldInputs.json' with { type: 'json' };
import { app } from '@wildshard/engine/app/runtime';
import { RangedFrame, RangedTrace, RangedFlash } from '@wildshard/engine/render/viewmodelFeel';
import { RANGED_FRAME, RANGED_TRACE, RANGED_FLASH, RANGED_RELOAD, RANGED_HIT, RANGED_BRASS } from '../../data/rangedFrame';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { Firearm, RangedReload } from '@wildshard/engine/combat/Firearm';
import type { Targets } from '@wildshard/engine/combat/types';
import { stepBrass, brassRoster, ejectBrass, type BrassCase } from '@wildshard/engine/combat/view/brass';
import type { HitscanProfile } from '@wildshard/engine/combat/view/hitscan';
import { Puffs, FOV_HIP, FOV_ADS, isMesh, whiteColors, type RangedOptions, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import type { WeaponState, AimInfo } from '@wildshard/engine/combat/Weapon';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { sstep } from '@wildshard/engine/player/viewmodelTextures';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';

/**
 * The magazine firearm family (SHARD-PLATFORM SF36): a semi-automatic, magazine-fed hitscan gun whose model is the shard's
 * parts and whose numbers and view are rows. One round per trigger pull (`profile.interval` min), a magazine plus reserve,
 * `profile.reload` s reload on Reload or automatically when the trigger is pulled on an empty magazine. Hitscan along
 * `aimRay()` (the camera forward): the physics world's first hit and `Targets.raycast` for the animals short of it, the
 * nearer wins. Muzzle flash (two additive quads for `view.flash.frames` frames plus a pooled point light for
 * `view.flash.lightTime`), pooled brass from `view.port`, camera kick, a short red tracer when the 'tracers' setting is on,
 * impact puffs and `onImpact` / `onHit` so audio and combat feedback need no weapon-specific wiring.
 *
 * ADS = shouldered iron sights: model rotation 0, the sight line `profile.ads.sightY` above the bore on the eye, the rear
 * aperture as close as the near plane allows (near + `profile.ads.nearMargin`). FOV hip → ADS through `fovForAspect`.
 *
 *   const rifle = new MagazineFirearm(world, targets, { row, profile, parts: buildRifleParts, view: RIFLE_VIEW });
 */

/** The numbers the family reads: the hitscan's, the magazine and its timing, the kick and bloom, brass, tracers and ADS. */
export interface MagazineFirearmProfile extends HitscanProfile {
  magazine: number; reserve: number; interval: number; reload: number; autoReload: number; kick: number;
  bloomShot: number; bloomMax: number;
  brass: { count: number; life: number }; tracer: { count: number };
  ads: { blend: number; motion: number; nearMargin: number; sightY: number; rearZ: number; frontZ: number; muzzleZ: number };
}

/**
 * The gun's parts in model space (−Z the bore, +Y up, the bore axis at y 0), every one on the viewmodels' shared lit
 * program: the three body meshes, the charging handle, the bolt and the magazine (the three the viewmodel animates; the
 * magazine at `magRest`), the rear sight's glow (hidden: shown sighted) and the ejected brass's material.
 */
export interface MagazineFirearmParts {
  readonly alu: THREE.Mesh; readonly poly: THREE.Mesh; readonly steel: THREE.Mesh;
  readonly handle: THREE.Mesh; readonly bolt: THREE.Mesh; readonly mag: THREE.Mesh; readonly magRest: THREE.Vector3;
  readonly glowRing: THREE.Mesh; readonly glow: THREE.MeshBasicMaterial;
  readonly aluMat: THREE.MeshPhysicalMaterial; readonly polyMat: THREE.MeshPhysicalMaterial; readonly steelMat: THREE.MeshPhysicalMaterial; readonly brassMat: THREE.MeshPhysicalMaterial;
}

/** The family's view as rows (metres, seconds, radians). */
export interface MagazineFirearmView {
  /** the hip pose (lower right) and the model's scale */
  readonly hip: { readonly px: number; readonly py: number; readonly pz: number; readonly rx: number; readonly ry: number; readonly rz: number; readonly scale: number };
  /** the ejection port in model space, where the brass leaves */
  readonly port: readonly [number, number, number];
  /** the ejected case: radius and length */
  readonly brassCase: readonly [number, number];
  /** the muzzle flash: quads shown `frames` frames, the light `lightTime` s at `light` intensity in `colour`, the quad size */
  readonly flash: { readonly frames: number; readonly lightTime: number; readonly light: number; readonly colour: number; readonly size: number };
  /** the tracer line's life (s) */
  readonly tracer: number;
}

export interface MagazineFirearmOptions<P extends MagazineFirearmProfile> extends RangedOptions {
  profile: P;
  /** the gun's model, built at the viewmodel's build from the scene's sky */
  parts: (sky: Sky) => MagazineFirearmParts;
  view: MagazineFirearmView;
  /**
   * Take the muzzle-flash light from the scene's LightPool at boot (default). A shard where the gun can't be found passes
   * false: its flash is the quads only and every lit program there keeps one point light fewer.
   */
  muzzleLight?: boolean;
}


const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** A magazine firearm: the shard's parts and rows on the platform's trigger, hitscan, brass, flash, tracer and pose. */
export class MagazineFirearm<P extends MagazineFirearmProfile = MagazineFirearmProfile> extends Firearm {
  readonly profile: P;
  readonly view: MagazineFirearmView;
  readonly state: WeaponState & { ammo: number };
  enabled = true;
  allowUnlocked = false;
  adsHeld = false;
  holster = 0;
  aimInfo: AimInfo | null = null;

  readonly model = new THREE.Group();
  private game: RangedWorld['game']; private sky: RangedWorld['sky']; private player: RangedWorld['player'];
  private targets: Targets | undefined;
  private active = true;
  private readonly buildParts: (sky: Sky) => MagazineFirearmParts;
  private readonly port: THREE.Vector3;

  // animated parts
  private mag!: THREE.Mesh; private magRest = new THREE.Vector3(); private handle!: THREE.Mesh; private bolt!: THREE.Mesh;
  private readonly flash: RangedFlash; private flashLight: THREE.PointLight;
  private rearGlow!: THREE.Material;
  private glowRing!: THREE.Mesh;
  /** geometry + material pairs for `displayModel()` (a world pickup) */
  private displayParts: { geo: THREE.BufferGeometry; mat: THREE.Material; pos?: THREE.Vector3 }[] = [];
  private brass: BrassCase[] = [];
  private brassMat!: THREE.MeshStandardMaterial;
  private tracers: RangedTrace[] = []; private readonly paintTracer = (trace: RangedTrace, time: number, _camera: THREE.PerspectiveCamera, resolution: THREE.Vector2): void => { trace.publish(time, _camera, resolution, this.tracerLife); };
  private puffs = new Puffs();
  private readonly hitMuzzle: [number,number,number] = [...RANGED_HIT.magazine.muzzle];

  // animation state
  private cooldown = 0;
  private readonly reloadClock = new RangedReload(RANGED_RELOAD.magazine);
  private bloom = 0;
  
  private readonly feel: RangedFrame;
  private readonly frameInputs = { enabled: false, active: false, held: false, reloading: false, adsDuration: 1, kick: 0 };
  private readonly posePlayback: HeldPlayback;
  private readonly poseFrame = { portrait: 0, ads: 0 };
  private readonly partValues = { reloading: 0, reloadProgress: 0, magX: 0, magY: 0, magZ: 0 };
  private sprintBlend = 0; private reloadTilt = 0;
  private time = 0;
  /** tracer line life (s) — a dev knob for screenshots */
  tracerLife: number;
  /** hip pose (lower-right); a dev knob: `__weapons.get('rifle').hip.py = …` */
  readonly hip: { px: number; py: number; pz: number; rx: number; ry: number; rz: number; scale: number };
  /** the solved shouldered pose (dev / verification: `__weapons.get('rifle').adsPose`) */
  readonly adsPose = { px: 0, py: 0, pz: 0, scale: 1, rearDepth: 0, frontDepth: 0, muzzleDepth: 0 };

  constructor(world: RangedWorld, targets: Targets | undefined, opts: MagazineFirearmOptions<P>) {
    super(opts.row);
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.ranged' } };
    this.profile = opts.profile;
    this.view = opts.view;
    this.buildParts = opts.parts;
    this.hip = { ...opts.view.hip };
    this.tracerLife = opts.view.tracer;
    this.port = new THREE.Vector3(...opts.view.port);
    this.state = { ammo: this.profile.magazine, magazine: this.profile.magazine, reserve: this.profile.reserve, loaded: true, reloading: false, reloadProgress: 0, ads: false };
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    // the muzzle light is a pooled scene light (B7), taken now, at boot: in the viewmodel it came and went with the
    // model's visibility, and every change of the scene's light count recompiled every lit program in view (taking the
    // gun mid-play: 28 programs). Dark at rest, lit by intensity only, placed at the muzzle in world space when it fires.
    const flash = opts.view.flash;
    this.flashLight = opts.muzzleLight === false ? new THREE.PointLight(flash.colour, 0, 8, 2) : LightPool.for(this.game.scene).acquire(flash.colour, 0, 8, 2);
    this.flash = new RangedFlash(this.view.flash, RANGED_FLASH.magazine, this.profile.ads, this.flashLight);
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.feel = new RangedFrame(RANGED_FRAME.magazine, this.player, FOV_HIP, FOV_ADS);
    this.buildViewmodel();
    this.posePlayback = new HeldPlayback({ pose: playback.magazine, parts: playback.magazineParts },
      new Map<string, unknown>([['root', this.model], ['magazine', this.mag], ['handle', this.handle], ['bolt', this.bolt]]));
    this.posePlayback.bindInputs('pose', inputs.magazine, new Map([['weapon', this]]));
    this.buildEffects();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.puffs.points);
  }

  // ── input ──
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.feel.bindInputs(app.input, ctx.scope, this, this.player);
    ctx.scope.onDispose(() => { this.posePlayback.dispose(); this.model.removeFromParent(); });
  }


  override setActive(on: boolean): void {
    this.active = on;
    this.model.visible = on;
    if (!on) { this.enabled = false; this.feel.mouseAds = false; }
  }

  /** the pooled muzzle light, just ahead of the muzzle, in world space (the pool's group sits at the scene origin) */


  /** Pull the trigger: one round if the mag has one, else a dry click and (after a beat) a reload. */
  protected override actionReady(): boolean { return this.cooldown <= 0; }

  override reload(): void { this.reloadClock.begin(this, this.profile.magazine); }

  addRounds(n: number): void { this.state.reserve += n; }

  protected override fire(): void {
    const s = this.state;
    s.ammo--; s.loaded = s.ammo > 0;
    this.cooldown = this.profile.interval;
    this.feel.shot(this.profile.kick);
    this.flash.fire(this.model, app.rng.stream('cosmetic'));
    this.onFire?.(); // before the hit resolves: Combat registers the aimed shot, the damage float then closes it
    this.hitscan();
    this.ejectBrass();
    this.bloom = Math.min(this.profile.bloomMax, this.bloom + this.profile.bloomShot);
    this.onShot();
  }

  private hitscan(): void {
    const muzzle = this.hitMuzzle; muzzle[2] = this.profile.ads.muzzleZ;
    this.feel.publishHitscan(this, this.targets, this.profile, this.bloom, this.player.speedFactor, this.model, muzzle, this.time, this.tracers, this.puffs, _d, _v3);
  }

  // ── viewmodel ──
  private buildViewmodel() {
    const p = this.buildParts(this.sky);
    const { alu: meshA, poly: meshP, steel: meshS, glowRing, aluMat, polyMat, steelMat } = p;
    const handleGeo = p.handle.geometry, magGeo = p.mag.geometry;
    this.brassMat = p.brassMat; this.handle = p.handle; this.bolt = p.bolt; this.mag = p.mag; this.magRest.copy(p.magRest); this.rearGlow = p.glow;
    this.model.add(meshA, meshP, meshS, this.handle, this.bolt, this.mag, glowRing);
    this.displayParts.push({ geo: meshA.geometry, mat: aluMat }, { geo: meshP.geometry, mat: polyMat }, { geo: meshS.geometry, mat: steelMat }, { geo: handleGeo, mat: steelMat }, { geo: magGeo, mat: polyMat, pos: this.magRest.clone() });
    this.glowRing = glowRing;

    const flashMat = this.flash.build(this.model);

    // The engine clears depth once for all viewmodels before this transparent queue.
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
      m.renderOrder = this.flash.quads.includes(m) ? 1001 : 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; if (mat !== flashMat) mat.depthWrite = true; }
    });
  }

  /** A world-space copy of the gun for a pickup: the same geometry + materials (one program), no depth clearer / flash /
   *  light, normal render order, casts a shadow; bore along -Z, origin at the receiver. */
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
    const [radius, length] = this.view.brassCase;
    const caseGeo = new THREE.CylinderGeometry(radius, radius, length, 8); caseGeo.rotateX(Math.PI / 2); whiteColors(caseGeo); // brassMat reads vertex colours
    this.brass.push(...brassRoster(this.game.scene, caseGeo, this.brassMat, this.profile.brass.count));
    this.tracers.push(...RangedTrace.roster(this.game.scene, RANGED_TRACE.segment, this.profile.tracer.count));
  }

  private ejectBrass(): void {
    ejectBrass(this.brass, RANGED_BRASS.magazine, this.model, this.game.camera, this.port, this.profile.brass.life, _v1, _v2, _v3, _q);
  }


  /** Shouldered pose: rotation 0, sight line on the eye, rear aperture at near + margin. Depends on the scale only. */
  private solveAds(scale: number) {
    const o = this.adsPose, cam = this.game.camera;
    if (o.scale === scale && o.rearDepth > 0) return o;
    o.scale = scale;
    o.rearDepth = cam.near + this.profile.ads.nearMargin;
    o.px = 0; o.py = -this.profile.ads.sightY * scale; o.pz = -o.rearDepth - this.profile.ads.rearZ * scale;
    o.frontDepth = -(o.pz + this.profile.ads.frontZ * scale); o.muzzleDepth = -(o.pz + this.profile.ads.muzzleZ * scale);
    return o;
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t; this.posePlayback.beginFrame(dt);
    const p = this.player, cam = this.game.camera, s = this.state;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceEmpty += dt;
    this.bloom = Math.max(0, this.bloom - dt * 2.4);

    // auto reload: the mag ran dry on a trigger pull
    if (this.autoReloadDue()) this.reload();
    this.reloadStep(dt);
    this.animateAction(t, dt);

    // muzzle flash: `flash.frames` frames of quads, the light for `flash.lightTime`
    this.flash.advance(dt, this.model);

    const frame = this.frameInputs;
    frame.enabled = this.enabled; frame.active = this.active; frame.held = this.adsHeld;
    frame.reloading = s.reloading; frame.adsDuration = this.profile.ads.blend; frame.kick = this.profile.kick;
    s.ads = this.feel.sampleFrame(dt, p, frame, cam, this.sky.csm);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload ↔ holster
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = s.reloading ? Math.sin(Math.min(1, s.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.feel.adsBlend), scale = this.hip.scale * (1 - portrait * 0.12);
    if (a > 0) this.solveAds(scale);
    this.glowRing.visible = a > 0.001; (this.rearGlow as THREE.MeshBasicMaterial).opacity = a * 0.85;
    this.model.scale.setScalar(scale); this.poseFrame.portrait = portrait; this.poseFrame.ads = a; this.posePlayback.apply('pose', this.poseFrame);

    this.feel.scanAim(this, this.targets, this.active, _o, _d, _v2, this.model);

    stepBrass(this.brass, dt);
    this.feel.presentEffects(dt, t, this.game.renderer, cam, this.puffs, this.tracers, this.paintTracer);
  }
  protected override animateAction(_t: number, _dt: number): void {
    const parts = this.partValues; parts.reloading = Number(this.state.reloading); parts.reloadProgress = this.state.reloadProgress;
    parts.magX = this.magRest.x; parts.magY = this.magRest.y; parts.magZ = this.magRest.z; this.posePlayback.apply('parts', parts);
  }
  protected override autoReloadDue(): boolean {
    const s = this.state;
    return !s.reloading && s.ammo <= 0 && s.reserve > 0 && this.sinceEmpty > this.profile.autoReload && this.active && this.enabled;
  }
  protected override reloadStep(dt: number): void {
    if (this.state.reloading && this.reloadClock.progress(this, dt, this.profile.reload) >= 1) this.reloadClock.finish(this, this.profile.magazine);
  }
}

/** A shard's gun as a row: its default profile, its parts and its view. */
export interface MagazineFirearmRow<P extends MagazineFirearmProfile> {
  readonly profile: P;
  readonly parts: (sky: Sky) => MagazineFirearmParts;
  readonly view: MagazineFirearmView;
}
/** Construction of a row-bound gun: its equipment row, an optional profile over the row's and the muzzle light. */
export interface MagazineFirearmRowOptions<P extends MagazineFirearmProfile> extends RangedOptions {
  profile?: P;
  muzzleLight?: boolean;
}
/** The constructor a row binds: `new Gun(world, targets, { row })`, as every other held weapon is built. */
export interface MagazineFirearmType<P extends MagazineFirearmProfile> {
  new (world: RangedWorld, targets: Targets | undefined, opts: MagazineFirearmRowOptions<P>): MagazineFirearm<P>;
  readonly prototype: MagazineFirearm<P>;
}
/**
 * Bind a shard's row to the family (SHARD-PLATFORM SF36): the shard writes data and a model, never a subclass.
 *
 *   export const Rifle = magazineFirearmType({ profile: AR15, parts: buildRifleParts, view: RIFLE_VIEW });
 *   const rifle = new Rifle(world, targets, { row: AR15_ROW, allowUnlocked });
 */
export function magazineFirearmType<P extends MagazineFirearmProfile>(row: MagazineFirearmRow<P>): MagazineFirearmType<P> {
  return class extends MagazineFirearm<P> {
    constructor(world: RangedWorld, targets: Targets | undefined, opts: MagazineFirearmRowOptions<P>) {
      super(world, targets, { ...opts, profile: opts.profile ?? row.profile, parts: row.parts, view: row.view });
    }
  };
}
