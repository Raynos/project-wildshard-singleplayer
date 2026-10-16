import { RangedAction } from '@wildshard/engine/combat/Firearm';
import { HeldPlayback } from '@wildshard/game/plugin/weaponFamily';
import type { InferOutput } from 'valibot';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { SECTIONS } from '../sections';
import { ProjectilePresentation } from '@wildshard/engine/combat/view/projectile';
import { ProjectileSlots, type FlightSlot } from '@wildshard/engine/combat/projectileFlight';
import { app, gameplayRandom } from '@wildshard/engine/app/runtime';
import type { AmmoRow } from '@wildshard/engine/combat/ammo';
import { RangedFrame } from '@wildshard/engine/render/viewmodelFeel';
import { RANGED_FRAME, RANGED_TRACE } from './rangedFrame';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { shotSpread } from '@wildshard/engine/combat/shotSpread';
import type { TargetHit, Targets } from '@wildshard/engine/combat/types';
import { Puffs, worldHit, impactSurfaceOf, FOV_HIP, FOV_ADS, prepareWeaponView, type RangedOptions, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import { quiverState, Weapon, type ImpactSurface } from '@wildshard/engine/combat/Weapon';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { Game } from '@wildshard/engine/core/Game';
import { ProjectileContact } from '@wildshard/engine/combat/projectileContact';
import type { Player } from '@wildshard/engine/player/Player';
import { sstep } from '@wildshard/engine/player/viewmodelTextures';
import { getSetting } from '@wildshard/engine/ui/Settings';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';

/**
 * The bolt crossbow family (SHARD-PLATFORM SF36): a first-person crossbow loosing physical bolts, whose model and hands are
 * the shard's and whose numbers, flight law and view are rows. One bolt on the rail (`profile.quiver` in all); a pull
 * looses it (`profile.cooldown`), a dry pull or `profile.autoReload` s later reloads (`profile.reload` s; the string
 * spring draws, the bolt slides in). Bolts fly through the shard's `flight` step in four substeps a frame and hit the
 * nearer of an animal (`Targets.raycast`, short of the world hit) and the world (a `profile.radius` ball swept through the
 * physics world): they stick in wood / ground (riding a moving owner, or a practice dummy's bone), glance off stone /
 * metal and lie where they fall. Tracers (the 'tracers' setting at each loose), impact puffs and `onFire` / `onHit` /
 * `onImpact` / `onReloadStart` / `onReloadEnd` / `onDry` so audio and combat feedback need no weapon-specific wiring.
 *
 * ADS = true iron sights, not a zoom: the camera looks straight down the bolt, the pose solved per (aspect, fov, scale)
 * from the parts and `view.ads`, with the rear peep (`view.peep`) faded in on the eye → tip line.
 *
 *   The named Crossbow constructor supplies the authored profile, parts, hands, flight and view.
 *   const crossbow = new Crossbow(world, targets, { row: CROSSBOW, allowUnlocked });
 *   game.onUpdate((dt, t) => crossbow.update(dt, t));   // register AFTER player.update
 *
 * Side effects: the FOV setter (Hor+ on portrait) owns `game.camera.fov` and calls `camera.updateProjectionMatrix()` +
 * `sky.csm.updateFrustums()`; the kick nudges `player.pitch`; the viewmodel is parented to `game.viewmodel`.
 */

/** The numbers the family reads: the quiver, the bolt's speed / flight / reach / bury, the timing, kick, ADS and the pools. */
export interface BoltCrossbowProfile {
  quiver: number; speed: number; gravity: number; drag: number; radius: number; bury: number;
  reload: number; autoReload: number; cooldown: number; kick: number; adsBlend: number; adsMotion: number;
  maxFlying: number; maxStuck: number;
  spreadAds?: number; spreadHip?: number; spreadRadius?: 'linear' | 'sqrt'; spreadAxisScale?: 1 | 2;
  muzzle?: number; substeps?: number; lifetime?: number; damageScale?: number;
}

/** The flight multipliers a bolt carries (the selected ammo's, the weather's): 1 / 1 is the plain bolt. */
export interface BoltFlight { gravity: number; drag: number }
/** The shard's flight law: one deterministic substep of `h` s, writing only `pos` / `vel`. */
export type BoltFlightStep<P extends BoltCrossbowProfile> = (pos: THREE.Vector3, vel: THREE.Vector3, h: number, mod: BoltFlight, profile: P) => void;

/**
 * Special bolts (a shard's loadout): the flight + damage of the NEXT bolt to leave the rail, captured by each bolt as it
 * launches. `gravity` / `drag` multiply the flight's, `damage(kind)` the damage model's number on an animal of that kind,
 * `material` dresses the bolt (a uniform-only clone of the bolt material: no program). `PLAIN_BOLT` (the default) is the
 * plain bolt.
 */
export interface BoltMod { gravity: number; drag: number; damage: (kind: string) => number; material?: THREE.Material | undefined }
export const PLAIN_BOLT: BoltMod = { gravity: 1, drag: 1, damage: () => 1 };

/**
 * The crossbow's parts in model space (−Z the bolt, +Y up, the rail top at y 0), every one already added to `into.model`:
 * the ones the viewmodel animates (the string's legs and serving, the loaded bolt, the peep's post and materials), the
 * bolt's geometry and material (the flying and stuck bolts share them) and the measured rest points.
 */
export interface BoltCrossbowParts {
  readonly stringLeft: THREE.Mesh; readonly stringRight: THREE.Mesh; readonly serving: THREE.Mesh; readonly loadedBolt: THREE.Mesh;
  readonly boltGeo: THREE.BufferGeometry; readonly boltMat: THREE.MeshStandardMaterial;
  readonly peepPost: THREE.Mesh; readonly peepMats: readonly THREE.Material[];
  readonly tipL: THREE.Vector3; readonly tipR: THREE.Vector3; readonly nockRest: THREE.Vector3; readonly nockDrawn: THREE.Vector3;
  readonly tipLocal: THREE.Vector3; readonly tipModel: THREE.Vector3; readonly nockZ: number;
}
/** Where the parts builder puts the model: the viewmodel group, and the peep sight's group and ring (posed by the family). */
export interface BoltCrossbowInto { readonly model: THREE.Group; readonly peep: THREE.Group; readonly peepRing: THREE.Group }

/** The shard's hands on the model: posed every frame, measured for the cost readout, disposed on a rebuild. */
export interface BoltCrossbowHands {
  readonly aim: (model: THREE.Object3D) => void;
  readonly cost: { draws: number; tris: number; verts: number; bytes: number };
  readonly dispose: () => void;
}

/** The family's view as rows (metres, radians). */
export interface BoltCrossbowView {
  /** the hip pose (lower right) and the model's scale */
  readonly hip: { readonly px: number; readonly py: number; readonly pz: number; readonly rx: number; readonly ry: number; readonly rz: number; readonly scale: number };
  /** iron sights: the eye's height above the rail, the nut's margin in front of the near plane, the model's pitch */
  readonly ads: { readonly eyeAboveRail: number; readonly nearMargin: number; readonly pitch: number };
  /** the rear peep: its model z, its ring geometry's radius (the parts') and its size in the world when sighted */
  readonly peep: { readonly z: number; readonly radius: number; readonly worldRadius: number };
}

type Section<K extends keyof typeof SECTIONS> = InferOutput<(typeof SECTIONS)[K]>;
/** The crossbow's admitted playback rows: Pine's custom sections, read once from the product where it is built. */
export interface CrossbowHeldRows {
  readonly playback: Section<'custom/heldPlayback'>;
  readonly inputs: Section<'custom/heldInputs'>;
  readonly sights: Section<'custom/heldSights'>;
}
/** Read the crossbow's playback sections (load time, never in a frame loop). */
export function crossbowHeldRows(product: ShardProduct): CrossbowHeldRows {
  return { playback: product.section('custom/heldPlayback', SECTIONS), inputs: product.section('custom/heldInputs', SECTIONS),
    sights: product.section('custom/heldSights', SECTIONS) };
}

export interface BoltCrossbowOptions<P extends BoltCrossbowProfile> extends RangedOptions {
  profile: P;
  /** the playback, input and sight rows (`crossbowHeldRows(ctx.product)`) */
  held: CrossbowHeldRows;
  /** the crossbow's model, built at the viewmodel's build from the scene's sky */
  parts: (sky: Sky, into: BoltCrossbowInto) => BoltCrossbowParts;
  /** the hands' maker, called once with the scene's sky; each call of what it returns builds a pair on the model */
  hands?: (sky: Sky) => (model: THREE.Group) => BoltCrossbowHands;
  flight: BoltFlightStep<P>;
  view: BoltCrossbowView;
}

/** a bolt glancing off stone / rock / metal keeps this much of its speed along the surface, bounces off it with this
 *  much of its speed into it, and never leaves faster than GLANCE_MAX (m/s): a short skip, then it falls and lies */
const GLANCE_KEEP = 0.2, GLANCE_BOUNCE = 0.25, GLANCE_MAX = 9, GLANCE_LIFT = 0.01;
/**
 * TRACERS (for sighting-in the iron sights): a traced bolt gets a big red glow while it flies, leaves a fat solid-red
 * trail of its whole flight path (drawn through trees: no depth test) and drops a red impact marker where it stopped;
 * trail + marker live TRACER_LIFE s then fade. A traced bolt that sticks keeps a permanent red dot on its nock.
 * Runtime toggle: the 'tracers' setting (pause menu, persisted) is read at fire time, so a flip applies to the next
 * shot (a capture script saves it in ws.settings.v1 before the load, scripts/debug-settings.mjs).
 */
const MAX_TRACERS = RANGED_TRACE.trail.roster;
/** markers + the flying glow are scaled with distance (never below 1×) so they stay ~25 px on screen at any range */
const TRACER_PX = RANGED_TRACE.trail.markerScale;
/** shared: the glow on flying bolts, impact-marker spheres, stuck-bolt nock dots (never fades) */
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...RANGED_TRACE.trail.color), transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
const boltGlowGeo = new THREE.SphereGeometry(0.035, 12, 8);   // 7 cm on the flying bolt
const stuckDotGeo = new THREE.SphereGeometry(0.025, 10, 6);   // 5 cm on a stuck bolt's nock
const markerGeo = new THREE.SphereGeometry(0.06, 14, 10);     // 12 cm at the impact point
const ringGeo = new THREE.RingGeometry(0.10, 0.14, 28);

// ───────────────────────────── the crossbow ─────────────────────────────

type BoltData = ReturnType<ProjectilePresentation['flight']> & { mod: BoltMod; ammo?: AmmoRow | undefined };
type Bolt = FlightSlot<BoltData>;


const _v1 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _aimEnd = new THREE.Vector3();

/** A bolt crossbow: the shard's parts, hands and rows on the platform's trigger, string, bolts, tracers, sights and pose. */
export class BoltCrossbow<P extends BoltCrossbowProfile = BoltCrossbowProfile> extends Weapon {
  readonly profile: P;
  readonly view: BoltCrossbowView;
  readonly state: ReturnType<typeof quiverState>;
  enabled = true;
  allowUnlocked = false;
  /** hold ADS externally — OR'ed with the right mouse button */
  adsHeld = false;
  /** dev: 0 = normal, 1 = showcase pose (model centred, three-quarter view, slowly turning) */
  inspect = 0;
  /** dev: reload duration multiplier (1 = normal) */
  reloadScale = 1;
  /** 0..1 weapon-swap blend driven by Weapons.ts: 1 = dropped out of view (down + back + muzzle up); 0 = held (no effect) */
  holster = 0;
  /** what the crosshair is over (animals only; refreshed every 4th frame, 120 m) */
  aimInfo: { kind: string; distance: number } | null = null;
  /** the bolt on the rail (special bolts, BoltMod above): read at each loose; PLAIN_BOLT = iron */
  boltMod: BoltMod = PLAIN_BOLT;
  selectedAmmo: AmmoRow | undefined;
  protected nextAmmo(): AmmoRow | undefined { return this.selectedAmmo; }
  protected onShot(_bolt: { pos: THREE.Vector3; vel: THREE.Vector3 }): void { /* custom bolt hook */ }
  protected onBoltHit(_hit: TargetHit): void { /* custom hit hook */ }
  /** the HUD strip's ammo label (Weapons.ts BaseLike override): the loaded kind's ("Pitch bolts") */
  override get ammoLabel(): string { return this.row.ui.ammo?.label ?? ''; }
  override set ammoLabel(label: string) { if (this.row.ui.ammo) this.row = { ...this.row, ui: { ...this.row.ui, ammo: { ...this.row.ui.ammo, label } } }; }


  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets: Targets | undefined;

  // viewmodel parts we animate
  private stringLeft!: THREE.Mesh; private stringRight!: THREE.Mesh; private serving!: THREE.Mesh;
  private loadedBolt!: THREE.Mesh;
  private tipL = new THREE.Vector3(); private tipR = new THREE.Vector3();
  private nockRest = new THREE.Vector3(); private nockDrawn = new THREE.Vector3();
  private boltGeo!: THREE.BufferGeometry; private boltMat!: THREE.MeshStandardMaterial;
  /** the bolt geometry's nock end (max z), measured from its bounding box */
  private nockZ = 0;

  // animation state
  private draw = 1; private drawVel = 0; private drawTarget = 1;
  
  private readonly action: RangedAction;
  private readonly reloadPose = (pr: number): void => { this.drawTarget = pr >= 1 ? 1 : sstep(0.18, 0.78, pr); };
  
  private readonly feel: RangedFrame;
  private readonly frameInputs = { enabled: false, active: false, held: false, reloading: false, adsDuration: 1, kick: 0 };
  private readonly posePlayback: HeldPlayback;
  private readonly poseFrame = { portrait: 0, ads: 0, reloading: 0, scale: 1, sprinting: 0, sprint: 0, reloadTilt: 0 };
  private readonly partValues = { loaded: 0, reloading: 0, reloadProgress: 0 };

  /** loaded bolt's broadhead tip, in model space (measured from the bolt geometry) and bolt-local */
  private tipModel = new THREE.Vector3(); private tipLocal = new THREE.Vector3();
  /** the solved iron-sights pose + the numbers behind it (dev / verification: `__wildshard.world.crossbow.adsPose`) */
  readonly adsPose = { px: 0, py: 0, pz: 0, rx: 0, scale: 0, tipDepth: 0, eyeAboveRail: 0, nutDepth: 0, nutNdcY: 0, limbNdcX: 0, tipNdcY: 0, peepY: 0, peepZ: 0, peepDepth: 0, peepR: 0 };
  /** the rear peep sight: ring + post, posed from `adsPose` every sighted frame */
  private peep = new THREE.Group(); private peepRing = new THREE.Group(); private peepPost!: THREE.Mesh;
  private peepMats: THREE.Material[] = [];
  /** the shard's hands on the model (BoltCrossbowOptions.hands), null without */
  private hands: BoltCrossbowHands | null = null;
  private readonly makeHands: ((model: THREE.Group) => BoltCrossbowHands) | null;
  private readonly buildParts: BoltCrossbowOptions<P>['parts'];
  private readonly flight: BoltFlightStep<P>;

  // projectiles
  private readonly flightPool: ProjectileSlots<BoltData>;
  private get bolts(): Bolt[] { return this.flightPool.slots; }
  private readonly presentation: ProjectilePresentation;
  private puffs = new Puffs();
  private time = 0;

  constructor(world: RangedWorld, targets: Targets | undefined, opts: BoltCrossbowOptions<P>) {
    super(opts.row);
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.ranged' } };
    this.profile = opts.profile;
    this.view = opts.view;
    this.buildParts = opts.parts; this.flight = opts.flight;
    this.makeHands = opts.hands?.(world.sky) ?? null;
    this.adsPose.rx = opts.view.ads.pitch; this.adsPose.peepZ = opts.view.peep.z;
    this.state = quiverState({ bolts: this.profile.quiver, loaded: true, reloading: false, reloadProgress: 0, ads: false }, this.profile.quiver);
    this.action = new RangedAction(this, { mode: 'quiver', maximum: this.profile.quiver, interval: this.profile.cooldown, reload: this.profile.reload, autoReload: this.profile.autoReload, autoFrom: 'shot' });
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.feel = new RangedFrame(RANGED_FRAME.crossbow, this.player, FOV_HIP, FOV_ADS);
    this.buildViewmodel();
    this.presentation = new ProjectilePresentation(this.game.scene, this.boltGeo, this.boltMat,
      { flying: this.profile.maxFlying, stopped: this.profile.maxStuck, axis: [0, 0, -1], spin: 14, tip: this.tipLocal.z, nock: this.nockZ, trace: RANGED_TRACE.trail, traceCount: MAX_TRACERS, markerScale: TRACER_PX, order: RANGED_TRACE.trail.order + 1 },
      { material: glowMat, flight: boltGlowGeo, stuck: stuckDotGeo, impact: markerGeo, ring: ringGeo }, () => this.bolts);
    this.flightPool = this.buildProjectiles();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.puffs.points);

    this.buildHands();
    const { playback, inputs, sights } = opts.held;
    this.posePlayback = new HeldPlayback({ frame: inputs.frames.crossbow.program, pose: playback.crossbow, parts: playback.crossbowParts, sight: sights.sight, string: sights.string, peep: sights.peep }, new Map<string, unknown>([['root', this.model], ['loadedBolt', this.loadedBolt], ['stringLeft', this.stringLeft], ['stringRight', this.stringRight], ['serving', this.serving], ['peep', this.peep], ['peepRing', this.peepRing], ['peepPost', this.peepPost]]));
    this.posePlayback.bindInputs('frame', inputs.frames.crossbow.inputs, new Map([['weapon', this]]));
    this.posePlayback.bindOutputs('frame', inputs.frames.crossbow.outputs, new Map([['frame', this.poseFrame]]));
    this.posePlayback.bindInputs('pose', inputs.crossbow, new Map([['weapon', this]]));
    this.posePlayback.bindInputs('sight', sights.sightInputs, new Map([['weapon', this]])); this.posePlayback.bindOutputs('sight', sights.sightOutputs, new Map([['sight', this.adsPose]]));
    this.posePlayback.bindInputs('string', sights.stringInputs, new Map([['weapon', this]])); this.posePlayback.bindInputs('peep', sights.peepInputs, new Map([['weapon', this]]));
  }

  private buildHands(): void {
    this.hands = this.makeHands?.(this.model) ?? null;
  }
  /** dev: rebuild the hands after editing the shard's holds */
  rebuildHands(): void { this.hands?.dispose(); this.buildHands(); }
  /** dev / the cost readout: what the hands add (null: not made yet) */
  get handsCost(): BoltCrossbowHands['cost'] | null { return this.hands?.cost ?? null; }

  // ── input ──
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.feel.bindInputs(app.input, ctx.scope, this, this.player);
    ctx.scope.onDispose(() => { this.posePlayback.dispose(); this.model.removeFromParent(); });
  }


  /** Pull the trigger. Fires if loaded, else starts a reload (and reports a dry click). */
  tryFire(): void { this.action.trigger(() => { this.fire(); }); }

  fire(): void {
    if (!this.state.loaded || this.state.reloading) return;
    this.action.shot();
    this.drawTarget = 0; this.drawVel = -40; // string snaps forward
    this.feel.shot(this.profile.kick);
    this.spawnBolt();
    this.onFire?.();
  }

  override reload(): void { this.action.reload(); }

  override addBolts(n: number): void { this.state.bolts = Math.min(this.profile.quiver, this.state.bolts + n); }

  // ── viewmodel ──
  private buildViewmodel(): void {
    const p = this.buildParts(this.sky, { model: this.model, peep: this.peep, peepRing: this.peepRing });
    this.stringLeft = p.stringLeft; this.stringRight = p.stringRight; this.serving = p.serving; this.loadedBolt = p.loadedBolt;
    this.boltGeo = p.boltGeo; this.boltMat = p.boltMat; this.peepPost = p.peepPost; this.peepMats.push(...p.peepMats);
    this.tipL.copy(p.tipL); this.tipR.copy(p.tipR); this.nockRest.copy(p.nockRest); this.nockDrawn.copy(p.nockDrawn);
    this.tipLocal.copy(p.tipLocal); this.tipModel.copy(p.tipModel); this.nockZ = p.nockZ;

    // The engine owns the shared depth clear at 999; models remain at 1000 in the transparent queue.
    prepareWeaponView(this.model);
    this.model.scale.setScalar(this.view.hip.scale);
  }

  private buildProjectiles(): ProjectileSlots<BoltData> {
    const pool = new ProjectileSlots<BoltData>(this.profile.maxFlying, () => ({ ...this.presentation.flight(), mod: PLAIN_BOLT }), {
      substeps: this.profile.substeps ?? 4, extent: CHUNK_HALF + 60, floor: -150, lifetime: this.profile.lifetime ?? 12,
      integrate: (bolt, h) => {
        const flight = bolt.ammo && this.equipEvents ? this.equipEvents.ask('projectile.modify', { ammo: bolt.ammo, gravity: bolt.ammo.flight.gravity, drag: bolt.ammo.flight.drag }) : bolt.mod;
        this.flight(bolt.pos, bolt.vel, h, flight, this.profile);
      },
      contact: (bolt, previous) => this.testHit(bolt, previous), advanced: bolt => { bolt.tracer?.addPoint(bolt.pos); },
      expired: bolt => { bolt.mesh.visible = false; this.presentation.finishTrace(bolt, bolt.pos, this.time); },
      moved: (bolt, dt) => { this.presentation.move(bolt, bolt.pos, bolt.vel, dt, this.game.camera); },
    });
    this.presentation.prepareTraces();
    return pool;
  }
  /** world position of the loaded bolt's broadhead tip (the iron sight) */
  tipWorld(out: THREE.Vector3): THREE.Vector3 { return this.loadedBolt.localToWorld(out.copy(this.tipLocal)); }
  /** The aim line is ALWAYS the camera forward (the crosshair / the peep ring's centre), hip or sighted — the user
   *  found sighted shots landing low when they flew along the eye→tip ray. Sighted bolts start at the tip, which is
   *  a few cm under the eye, and fly parallel to the forward: at any range that is the same point as the hip shot. */
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }

  private spawnBolt(): void {
    const b = this.flightPool.take();
    const a = sstep(0, 1, this.feel.adsBlend);
    this.aimRay(_v3, _fwd);
    // spread: tight at ADS, a touch wider from the hip
    const spread = THREE.MathUtils.degToRad((this.profile.spreadAds ?? 0.15) + (1 - a) * ((this.profile.spreadHip ?? 0.75) - (this.profile.spreadAds ?? 0.15)));
    _dir.copy(_fwd);
    shotSpread(_dir, spread, gameplayRandom, { radius: this.profile.spreadRadius ?? 'linear', axisScale: this.profile.spreadAxisScale ?? 2 }, _v1);
    // Simulation launches from command data; the drawn bolt never chooses a shot's origin.
    b.pos.copy(_v3).addScaledVector(_fwd, this.profile.muzzle ?? 0.35);
    b.vel.copy(_dir).multiplyScalar(this.profile.speed);
    b.roll = 0; b.mod = this.boltMod; b.ammo = this.nextAmmo(); this.onShot(b);
    this.presentation.launch(b, b.pos, _dir, b.mod.material ?? this.boltMat, getSetting('tracers'), this.time);
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t; this.posePlayback.beginFrame(dt);
    const p = this.player, cam = this.game.camera;
    this.action.advance(dt, this.reloadScale, true, this.reloadPose);
    // string spring (stiff, slightly under-damped so the release overshoots)
    const k = this.state.reloading ? 260 : 1400, c = this.state.reloading ? 28 : 34;
    this.drawVel += (-(this.draw - this.drawTarget) * k - this.drawVel * c) * dt;
    this.draw += this.drawVel * dt;
    this.posePlayback.apply('string', this.poseFrame);

    const parts = this.partValues; parts.loaded = Number(this.state.loaded); parts.reloading = Number(this.state.reloading); parts.reloadProgress = this.state.reloadProgress;
    this.posePlayback.apply('parts', parts);
    this.loadedBolt.material = this.boltMod.material ?? this.boltMat;

    const frame = this.frameInputs;
    frame.enabled = this.enabled; frame.active = true; frame.held = this.adsHeld;
    frame.reloading = this.state.reloading; frame.adsDuration = this.profile.adsBlend; frame.kick = this.profile.kick;
    this.state.ads = this.feel.sampleFrame(dt, p, frame, cam, this.sky.csm);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload
    this.poseFrame.sprinting = Number(p.sprinting); this.poseFrame.reloading = Number(this.state.reloading);
    this.posePlayback.apply('frame', this.poseFrame);
    const { ads: a } = this.poseFrame; if (a > 0) this.posePlayback.apply('sight', this.poseFrame);

    this.peep.visible = a > 0.001 && !this.inspect;
    if (this.peep.visible) { this.posePlayback.apply('peep', this.poseFrame); for (const m of this.peepMats) m.opacity = a; }

    this.posePlayback.apply('pose', this.poseFrame);
    this.hands?.aim(this.model);

    this.feel.scanAim(this, this.targets, true, _v3, _fwd, _aimEnd, this.model);

    this.flightPool.step(dt);
    this.feel.presentEffects(dt, t, this.game.renderer, cam, this.puffs, this.presentation.traces, this.presentation.paint);
  }


  // ── projectiles ──
  /**
   * The step prev → b.pos: the nearer of an animal (AnimalManager.raycast, cut short at the world hit so a wall in
   * front wins) and the world (a this.profile.radius ball swept through the physics world — terrain, trunks, rocks,
   * structures). By the surface's material the bolt sticks (wood, planks, ground, sand, grass), or glances off
   * (stone, rock, metal, shell): a short skip with most of its speed lost, then it lies on the first floor it falls on
   * (knocking off any wall on the way).
   * Returns true when the bolt stopped.
   */
  private readonly contacts = new ProjectileContact<Bolt>({
    glance: { lift: GLANCE_LIFT, keep: GLANCE_KEEP, bounce: GLANCE_BOUNCE, maxSpeed: GLANCE_MAX },
    spentRest: 'upward', impactAfterLift: true, impactOnRepeatedGlance: false,
  }, {
    world: worldHit, target: (from, direction, distance) => this.targets?.raycast(from, direction, distance) ?? null,
    hit: (bolt, hit, direction) => {
      this.onBoltHit(hit);
      const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.point.distanceTo(this.player.position)) * bolt.mod.damage(hit.animal.kind) * (this.profile.damageScale ?? 1), hit.point, direction);
      this.onHit?.(hit.animal.kind, hit.headshot, killed);
      const frame = hit.animal.stuckFrame?.(hit.point) ?? null, attached = frame instanceof THREE.Object3D ? frame : null;
      this.stopBolt(bolt, hit.point, direction, 'flesh', attached !== null, this.profile.bury, false, attached);
    },
    stop: (bolt, at, direction, wall) => { this.stopBolt(bolt, at, direction, impactSurfaceOf(wall.material), true, this.profile.bury, false, ProjectilePresentation.movingFrame(wall.owner)); },
    rest: (bolt, at, direction) => { this.stopBolt(bolt, at, direction, 'ground', true, 0, true); },
    impact: (at, direction, wall) => { const surface = impactSurfaceOf(wall.material); this.puffs.emit(at, direction, surface); this.onImpact?.(surface, at); },
    expire: bolt => { bolt.active = false; bolt.mesh.visible = false; },
  });
  private testHit(b: Bolt, prev: THREE.Vector3): boolean { return this.contacts.step(b, prev, this.profile.radius, this.nockZ - this.tipLocal.z); }

  /** `bury`: how deep the broadhead goes in; `quiet`: no puff / impact event (a spent bolt settling) */
  private stopBolt(b: Bolt, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, stick: boolean, bury = this.profile.bury, quiet = false, rideOn: THREE.Object3D | null = null): void {
    b.active = false; b.mesh.visible = false;
    this.presentation.finishTrace(b, point, this.time);
    if (!quiet) {
      this.puffs.emit(point, dir, surface);
      this.onImpact?.(surface, point);
    }
    if (!stick) return;
    this.presentation.stick(point, dir, b.roll, b.mod.material ?? this.boltMat, b.traced, bury, rideOn);
  }

  /** the iron bolt's material (special bolts dress a uniform-only clone of it — BoltMod.material) */
  get boltMaterial(): THREE.Material { return this.boltMat; }
  /** flying bolt count (for debugging / HUD) */
  get inFlight(): number { let n = 0; for (const b of this.bolts) if (b.active) n++; return n; }
  get stuckCount(): number { return this.presentation.stuckCount; }
}
