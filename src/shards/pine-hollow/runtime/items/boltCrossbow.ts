import { app, gameplayRandom } from '@wildshard/engine/app/runtime';
import type { AmmoRow } from '@wildshard/engine/combat/ammo';
import { ads as blendAds } from '@wildshard/engine/combat/blocks/ads';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { shotSpread } from '@wildshard/engine/combat/shotSpread';
import type { TargetHit, Targets } from '@wildshard/engine/combat/types';
import { Puffs, worldHit, impactSurfaceOf, FOV_HIP, FOV_ADS, fovForAspect, isMesh, whiteColors, TRACER_ORDER, TRACER_RED, type RangedOptions, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import { quiverState, Weapon, type ImpactSurface } from '@wildshard/engine/combat/Weapon';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { Game } from '@wildshard/engine/core/Game';
import { weaponActionGate } from '@wildshard/engine/input/weaponActions';
import { sticksIn } from '@wildshard/engine/physics/query';
import type { Player } from '@wildshard/engine/player/Player';
import { sstep } from '@wildshard/engine/player/viewmodelTextures';
import { getSetting } from '@wildshard/engine/ui/Settings';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

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
 *   export const Crossbow = crossbowType({ profile: CROSSBOW_PROFILE, parts: buildCrossbow, hands: crossbowHands, flight: boltFlightStep, view: CROSSBOW_VIEW });
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

export interface BoltCrossbowOptions<P extends BoltCrossbowProfile> extends RangedOptions {
  profile: P;
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
const MAX_TRACERS = 8, TRACER_POINTS = 2048, TRACER_LIFE = 6, TRACER_FADE = 1.5, TRACER_WIDTH = 8;
/** markers + the flying glow are scaled with distance (never below 1×) so they stay ~25 px on screen at any range */
const TRACER_PX = 0.32;
/** shared: the glow on flying bolts, impact-marker spheres, stuck-bolt nock dots (never fades) */
const glowMat = new THREE.MeshBasicMaterial({ color: TRACER_RED, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
const boltGlowGeo = new THREE.SphereGeometry(0.035, 12, 8);   // 7 cm on the flying bolt
const stuckDotGeo = new THREE.SphereGeometry(0.025, 10, 6);   // 5 cm on a stuck bolt's nock
const markerGeo = new THREE.SphereGeometry(0.06, 14, 10);     // 12 cm at the impact point
const ringGeo = new THREE.RingGeometry(0.10, 0.14, 28);

/** One flight path: a pre-allocated fat-line buffer (TRACER_POINTS samples → segment pairs) + an impact marker. */
class Tracer {
  readonly line: LineSegments2; readonly mat: LineMaterial;
  readonly marker = new THREE.Group();
  private buf: Float32Array; private ibuf: THREE.InstancedInterleavedBuffer; private geo: LineSegmentsGeometry;
  private markMat: THREE.MeshBasicMaterial; private ring: THREE.Mesh;
  private last = new THREE.Vector3();
  n = 0; active = false;
  /** absolute time the trail + marker expire; < 0 while the bolt is still flying */
  endTime = -1;

  constructor(scene: THREE.Scene) {
    this.buf = new Float32Array((TRACER_POINTS - 1) * 6);
    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(this.buf);
    this.ibuf = (this.geo.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer;
    this.ibuf.setUsage(THREE.DynamicDrawUsage);
    this.geo.instanceCount = 0;
    this.mat = new LineMaterial({ linewidth: TRACER_WIDTH, transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mat.color = TRACER_RED.clone(); // the setter stores the object itself (a Color; > 1 so bloom haloes it)
    this.line = new LineSegments2(this.geo, this.mat);
    this.line.frustumCulled = false; this.line.renderOrder = TRACER_ORDER; this.line.visible = false;
    scene.add(this.line);
    this.markMat = glowMat.clone();
    const ball = new THREE.Mesh(markerGeo, this.markMat); ball.renderOrder = TRACER_ORDER + 1;
    this.ring = new THREE.Mesh(ringGeo, this.markMat); this.ring.renderOrder = TRACER_ORDER + 1;
    this.marker.add(ball, this.ring);
    this.marker.visible = false;
    scene.add(this.marker);
  }

  begin(p: THREE.Vector3) {
    this.n = 0; this.geo.instanceCount = 0; this.active = true; this.endTime = -1;
    this.mat.opacity = 1; this.markMat.opacity = 1;
    this.marker.visible = false; this.line.visible = false;
    this.addPoint(p);
  }

  /** append a flight sample (one per integration step); no allocation, uploads only the new segment */
  addPoint(p: THREE.Vector3) {
    if (this.n >= TRACER_POINTS) return;
    if (this.n > 0) {
      if (p.distanceToSquared(this.last) < 1e-8) return;
      const o = (this.n - 1) * 6, b = this.buf, l = this.last;
      b[o] = l.x; b[o + 1] = l.y; b[o + 2] = l.z; b[o + 3] = p.x; b[o + 4] = p.y; b[o + 5] = p.z;
      this.ibuf.addUpdateRange(o, 6); this.ibuf.needsUpdate = true;
      this.geo.instanceCount = this.n;
      this.line.visible = true;
    }
    this.last.copy(p); this.n++;
  }

  finish(p: THREE.Vector3, t: number) {
    this.addPoint(p);
    this.marker.position.copy(p); this.marker.visible = true;
    this.endTime = t + TRACER_LIFE;
  }

  update(t: number, cam: THREE.Camera, res: THREE.Vector2) {
    if (!this.active) return;
    this.mat.resolution.copy(res);
    if (this.endTime < 0) return;
    const rem = this.endTime - t;
    if (rem <= 0) { this.active = false; this.line.visible = false; this.marker.visible = false; return; }
    const a = Math.min(1, rem / TRACER_FADE);
    this.mat.opacity = a; this.markMat.opacity = a;
    this.ring.quaternion.copy(cam.quaternion); // the ring always faces the camera
    this.marker.scale.setScalar(Math.max(1, TRACER_PX * this.marker.position.distanceTo(cam.position)));
  }
}

// ───────────────────────────── the crossbow ─────────────────────────────

interface Bolt { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; active: boolean; age: number; roll: number; traced: boolean; tracer: Tracer | null; glow: THREE.Mesh; glanced: boolean; mod: BoltMod; ammo?: AmmoRow | undefined }
interface Stuck { mesh: THREE.Mesh }

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _aimEnd = new THREE.Vector3();
const NEG_Z = new THREE.Vector3(0, 0, -1), Y_AXIS = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);

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
  private aimFrame = 0;
  private aimCache = { kind: 'deer', distance: 0 };
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
  private recoil = 0; private kickPending = 0; private kickApplied = 0;
  private cooldown = 0; private sinceFire = 99; private reloadT = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private reloadTilt = 0;
  /** loaded bolt's broadhead tip, in model space (measured from the bolt geometry) and bolt-local */
  private tipModel = new THREE.Vector3(); private tipLocal = new THREE.Vector3();
  private adsCache = { aspect: 0, fov: 0, scale: 0 };
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
  private bolts: Bolt[] = [];
  private stuck: Stuck[] = [];
  private puffs = new Puffs();
  private tracers: Tracer[] = [];
  private tracerRes = new THREE.Vector2();
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
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel();
    this.buildProjectiles();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.puffs.points);

    this.buildHands();
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

  /** Pull the trigger. Fires if loaded, else starts a reload (and reports a dry click). */
  tryFire(): void {
    if (this.state.reloading || this.cooldown > 0) return;
    if (!this.state.loaded) { this.onDry?.(); this.reload(); return; }
    this.fire();
  }

  fire(): void {
    if (!this.state.loaded || this.state.reloading) return;
    this.state.loaded = false;
    this.state.bolts = Math.max(0, this.state.bolts - 1);
    this.cooldown = this.profile.cooldown; this.sinceFire = 0;
    this.drawTarget = 0; this.drawVel = -40; // string snaps forward
    this.recoil = 1; this.kickPending = this.profile.kick;
    this.spawnBolt();
    this.onFire?.();
  }

  override reload(): void {
    if (this.state.reloading || this.state.loaded || this.state.bolts <= 0) return;
    this.state.reloading = true; this.reloadT = 0; this.state.reloadProgress = 0;
    this.onReloadStart?.();
  }

  override addBolts(n: number): void { this.state.bolts = Math.min(this.profile.quiver, this.state.bolts + n); }

  // ── viewmodel ──
  private buildViewmodel(): void {
    const p = this.buildParts(this.sky, { model: this.model, peep: this.peep, peepRing: this.peepRing });
    this.stringLeft = p.stringLeft; this.stringRight = p.stringRight; this.serving = p.serving; this.loadedBolt = p.loadedBolt;
    this.boltGeo = p.boltGeo; this.boltMat = p.boltMat; this.peepPost = p.peepPost; this.peepMats.push(...p.peepMats);
    this.tipL.copy(p.tipL); this.tipR.copy(p.tipR); this.nockRest.copy(p.nockRest); this.nockDrawn.copy(p.nockDrawn);
    this.tipLocal.copy(p.tipLocal); this.tipModel.copy(p.tipModel); this.nockZ = p.nockZ;

    // The engine owns the shared depth clear at 999; models remain at 1000 in the transparent queue.
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
      m.renderOrder = 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; mat.depthWrite = true; }
    });
    this.model.scale.setScalar(this.view.hip.scale);
  }

  private buildProjectiles(): void {
    for (let i = 0; i < this.profile.maxFlying; i++) {
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false; mesh.castShadow = true; mesh.frustumCulled = false;
      // red glow riding on the flying bolt (a child, so it hides with it; shown only on traced shots)
      const glow = new THREE.Mesh(boltGlowGeo, glowMat); glow.renderOrder = TRACER_ORDER + 1; glow.position.set(0, 0, this.tipLocal.z + 0.05); glow.visible = false;
      mesh.add(glow);
      this.game.scene.add(mesh);
      this.bolts.push({ mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), active: false, age: 0, roll: 0, traced: false, tracer: null, glow, glanced: false, mod: PLAIN_BOLT });
    }
    for (let i = 0; i < MAX_TRACERS; i++) this.tracers.push(new Tracer(this.game.scene));
  }
  /** a free tracer, else the one closest to expiring (oldest) */
  private takeTracer(): Tracer | null {
    let best: Tracer | null = null;
    for (const t of this.tracers) { if (!t.active) return t; if (t.endTime >= 0 && (!best || t.endTime < best.endTime)) best = t; }
    best ??= this.tracers[0] ?? null; // all 8 still flying: recycle the first
    for (const b of this.bolts) if (b.tracer === best) b.tracer = null;
    return best;
  }
  private endTracer(b: Bolt, point: THREE.Vector3): void {
    if (!b.tracer) return;
    b.tracer.finish(point, this.time);
    b.tracer = null;
  }

  /** world position of the loaded bolt's broadhead tip (the iron sight) */
  tipWorld(out: THREE.Vector3): THREE.Vector3 { return this.loadedBolt.localToWorld(out.copy(this.tipLocal)); }
  /** The aim line is ALWAYS the camera forward (the crosshair / the peep ring's centre), hip or sighted — the user
   *  found sighted shots landing low when they flew along the eye→tip ray. Sighted bolts start at the tip, which is
   *  a few cm under the eye, and fly parallel to the forward: at any range that is the same point as the hip shot. */
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }

  private spawnBolt(): void {
    let b = this.bolts.find((x) => !x.active);
    b ??= this.bolts.reduce((a, x) => (x.age > a.age ? x : a));
    const a = sstep(0, 1, this.adsBlend);
    this.aimRay(_v3, _fwd);
    // spread: tight at ADS, a touch wider from the hip
    const spread = THREE.MathUtils.degToRad(0.15 + (1 - a) * 0.6);
    _dir.copy(_fwd);
    shotSpread(_dir, spread, gameplayRandom, { radius: 'linear', axisScale: 2 }, _v1);
    // Simulation launches from command data; the drawn bolt never chooses a shot's origin.
    b.pos.copy(_v3).addScaledVector(_fwd, 0.35);
    b.vel.copy(_dir).multiplyScalar(this.profile.speed);
    b.active = true; b.age = 0; b.roll = 0; b.glanced = false;
    b.mod = this.boltMod; b.ammo = this.nextAmmo(); this.onShot(b); b.mesh.material = b.mod.material ?? this.boltMat;
    b.mesh.visible = true;
    b.mesh.position.copy(b.pos);
    b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir);
    if (b.tracer) b.tracer.finish(b.pos, this.time); // slot stolen mid-flight: close its old trail
    b.traced = getSetting('tracers'); // read per shot: a pause-menu flip applies to the next bolt
    b.tracer = b.traced ? this.takeTracer() : null;
    b.tracer?.begin(b.pos);
    b.glow.visible = b.traced;
  }

  /**
   * Iron-sights pose, derived once per (aspect, fov, scale): model rotation is (view.ads.pitch, 0, 0) so the bolt runs
   * parallel to the camera forward, and the translation puts the tip on the ray to NDC (0, ADS_TIP_NDC_Y).
   * With the tip depth D and the eye h above the bolt: h = -ADS_TIP_NDC_Y·tan(fov/2)·D. The nut sits A = (nut.z - tip.z)·scale
   * behind the tip, at depth D - A; asking for it at ADS_NUT_NDC_Y gives one linear equation in D. The near plane
   * (+ margin) caps how close the nut may come, which is what limits the 94° portrait frame.
   */
  private solveAds(cam: THREE.PerspectiveCamera, scale: number): BoltCrossbow['adsPose'] {
    const { ads: { eyeAboveRail, nearMargin, pitch }, peep } = this.view;
    const c = this.adsCache, o = this.adsPose;
    if (c.aspect === cam.aspect && c.fov === cam.fov && c.scale === scale) return o;
    c.aspect = cam.aspect; c.fov = cam.fov; c.scale = scale;
    // Shouldered: the stock is pulled up under the cheek so the eye sits a few cm above the rail and looks straight down
    // the bolt; the nut is as close as the near plane allows (that is what "pinned into the shoulder" looks like).
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), th = tv * cam.aspect;
    const tip = this.tipModel, nut = this.nockDrawn;
    const A = (nut.z - tip.z) * scale;
    const nutDepth = cam.near + nearMargin;
    const D = nutDepth + A;
    o.px = 0; o.py = -eyeAboveRail; o.pz = -D - tip.z * scale; o.rx = pitch; o.scale = scale;
    o.tipDepth = D; o.eyeAboveRail = eyeAboveRail; o.nutDepth = nutDepth;
    o.nutNdcY = (nut.y * scale + o.py) / (nutDepth * tv); o.tipNdcY = (tip.y * scale + o.py) / (D * tv);
    o.limbNdcX = (this.tipR.x * scale) / (-(this.tipR.z * scale + o.pz) * th);
    // peep: a real rear sight MOUNTED ON THE STOCK at model z = peep.z, its centre exactly at eye height (on the forward
    // line → screen centre); fixed physical size, so the post is short and the ring reads as part of the weapon.
    o.peepZ = peep.z; o.peepY = eyeAboveRail / scale; o.peepDepth = -(o.pz + peep.z * scale);
    o.peepR = peep.worldRadius;
    return o;
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceFire += dt;

    // auto reload
    if (!this.state.loaded && !this.state.reloading && this.state.bolts > 0 && this.sinceFire > this.profile.autoReload) this.reload();
    if (this.state.reloading) {
      this.reloadT += dt / this.reloadScale;
      const pr = Math.min(1, this.reloadT / this.profile.reload);
      this.state.reloadProgress = pr;
      this.drawTarget = sstep(0.18, 0.78, pr);
      if (pr >= 1) { this.state.reloading = false; this.state.loaded = true; this.drawTarget = 1; this.onReloadEnd?.(); }
    }
    // string spring (stiff, slightly under-damped so the release overshoots)
    const k = this.state.reloading ? 260 : 1400, c = this.state.reloading ? 28 : 34;
    this.drawVel += (-(this.draw - this.drawTarget) * k - this.drawVel * c) * dt;
    this.draw += this.drawVel * dt;
    this.updateString();

    // loaded bolt: visible once the reload is ~85 % through (slides in from the rear)
    const showBolt = this.state.loaded || (this.state.reloading && this.state.reloadProgress > 0.8);
    this.loadedBolt.visible = showBolt;
    this.loadedBolt.material = this.boltMod.material ?? this.boltMat;
    if (showBolt && this.state.reloading) {
      const slide = 1 - sstep(0.8, 1, this.state.reloadProgress);
      this.loadedBolt.position.z = 0.128 - 0.18 + slide * 0.12;
      this.loadedBolt.position.y = 0.0095 + slide * 0.02;
    } else { this.loadedBolt.position.z = 0.128 - 0.18; this.loadedBolt.position.y = 0.0095; }

    // ADS + FOV
    if (p.sprinting || !this.enabled) this.mouseAds = false; // sprinting / pause / holster drop the RMB toggle
    this.state.ads = (this.mouseAds || this.adsHeld) && this.enabled && !this.state.reloading && !p.sprinting;
    this.adsBlend = blendAds(this.adsBlend, this.state.ads, dt, this.profile.adsBlend);
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (Math.abs(targetFov - this.fov) > 0.01) {
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums();
    }

    // recoil + camera kick (kick up on fire, recover smoothly)
    this.recoil *= Math.exp(-dt * 9);
    if (this.kickPending > 0) { const a = Math.min(this.kickPending, this.profile.kick * dt * 40); p.pitch += a; this.kickApplied += a; this.kickPending -= a; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 6); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    // stiff spring (k=220): explicit Euler blows up once k·dt² > 1 (≈ 15 fps on a phone) → substep at ≤ 1/120 s
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = this.state.reloading ? Math.sin(Math.min(1, this.state.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), rt = this.reloadTilt; // portrait: the sprint swing would fill the frame
    // portrait phone: the wider FOV + narrow frame make the bow fill the screen — hold it lower, further out, smaller
    const port = portrait, scale = this.view.hip.scale * (1 - port * 0.55);
    // shared motion: breathing / idle sway, walk bob (counter-phase to the camera bob → the weapon feels heavy),
    // look lag (spring), recoil. The hip takes it in full, the sights ~30 % (this.profile.adsMotion) so the tip stays on the aim line.
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.016 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.012 * sf, bobRz = Math.cos(p.bobTime) * 0.02 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.01 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil;
    // hip: lower-right (Skyrim)
    const hip = this.view.hip;
    let px = hip.px, py = hip.py, pz = hip.pz, rx = hip.rx, ry = hip.ry, rz = hip.rz;
    // sprint: drop and swing across the body
    px += sp * -0.05; py += sp * -0.09; pz += sp * 0.04; rx += sp * 0.32; ry += sp * 0.45; rz += sp * -0.15;
    // reload: tilt the bow up-left to reach the string, crank shake
    const crank = this.state.reloading ? Math.sin(this.state.reloadProgress * Math.PI * 14) * (this.state.reloadProgress > 0.15 && this.state.reloadProgress < 0.8 ? 1 : 0) : 0;
    px += rt * -0.06; py += rt * -0.05; pz += rt * 0.02; rx += rt * 0.35 + crank * 0.008; ry += rt * -0.28; rz += rt * 0.42 + crank * 0.012;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.07; py += rc * 0.015; rx += rc * 0.12; rz += rc * -0.03;
    // target: the whole prod visible inside ~60 % of the screen width (prod ≈ 0.68 m × scale at |pz| + 0.3 × scale)
    px *= 1 - port * 0.25; py *= 1 + port * 0.7; pz *= 1 + port * 1.5;
    // iron sights: cheek on the stock, looking straight down the bolt — pose solved from the geometry (solveAds);
    // recoil kicks the muzzle up but barely back, the nut is already a hair in front of the near plane
    if (a > 0) {
      const ads = this.solveAds(cam, scale), m = this.profile.adsMotion;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.01, az = ads.pz + rc * 0.015;
      const arx = ads.rx + (bobRx + lagRx) * m + rc * 0.1, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.02;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }

    // peep sight: posed from the solve, faded with the blend (its centre, the eye and the tip are collinear at a = 1)
    if (a > 0.001 && !this.inspect) {
      const ads = this.solveAds(cam, scale);
      this.peep.visible = true;
      this.peep.position.set(0, ads.peepY, ads.peepZ);
      this.peepRing.scale.setScalar(ads.peepR / (scale * this.view.peep.radius));
      this.peepPost.scale.y = Math.max(0.001, ads.peepY);
      for (const m of this.peepMats) m.opacity = a;
    } else this.peep.visible = false;

    if (this.inspect) { px = 0.02; py = -0.02; pz = -0.42; rx = 0.35; ry = 0.9 + Math.sin(t * 0.25) * 0.5; rz = 0.1; }
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.32; pz += h * 0.08; rx -= h * 0.55; rz += h * 0.25; } // weapon swap: drop out of the frame
    this.model.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 14) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);
    this.hands?.aim(this.model);

    // aim readout
    if (this.targets && (++this.aimFrame & 3) === 0) {
      this.model.updateMatrixWorld(); // the pose was just set; the sight ray goes through the tip
      this.aimRay(_v3, _fwd);
      // an animal behind a wall shows no range (P5-L2): the world hit along the sight ray caps the reach
      const wall = worldHit(_v3, _aimEnd.copy(_v3).addScaledVector(_fwd, 120), 0);
      const hit = this.targets.raycast(_v3, _fwd, wall?.distance ?? 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBolts(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, cam, this.tracerRes);
  }

  private updateString(): void {
    const d = THREE.MathUtils.clamp(this.draw, -0.12, 1.05);
    const nock = _v1.copy(this.nockRest).lerp(this.nockDrawn, d);
    nock.y = this.nockRest.y + (1 - Math.abs(d - 0.5) * 2) * 0.002;
    this.placeLeg(this.stringLeft, this.tipL, nock);
    this.placeLeg(this.stringRight, this.tipR, nock);
    this.serving.position.copy(nock);
    this.serving.quaternion.setFromUnitVectors(X_AXIS, _v2.subVectors(this.tipR, this.tipL).normalize());
  }
  private placeLeg(leg: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    leg.position.copy(from);
    _v3.subVectors(to, from);
    const len = _v3.length();
    leg.scale.set(1, len, 1);
    leg.quaternion.setFromUnitVectors(Y_AXIS, _v3.multiplyScalar(1 / len));
  }

  // ── projectiles ──
  private stepBolts(dt: number): void {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.age += dt;
      const sub = 4, h = dt / sub;
      let stopped = false;
      for (let s = 0; s < sub; s++) {
        _v1.copy(b.pos); // previous
        const flight = b.ammo && this.equipEvents ? this.equipEvents.ask('projectile.modify', { ammo: b.ammo, gravity: b.ammo.flight.gravity, drag: b.ammo.flight.drag }) : b.mod;
        this.flight(b.pos, b.vel, h, flight, this.profile);
        if (this.testHit(b, _v1)) { stopped = true; break; }
        b.tracer?.addPoint(b.pos);
      }
      if (stopped) continue;
      if (Math.abs(b.pos.x) > CHUNK_HALF + 60 || Math.abs(b.pos.z) > CHUNK_HALF + 60 || b.pos.y < -150 || b.age > 12) { b.active = false; b.mesh.visible = false; this.endTracer(b, b.pos); continue; }
      b.mesh.position.copy(b.pos);
      _dir.copy(b.vel).normalize();
      b.roll += dt * 14;
      b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir).multiply(_q2.setFromAxisAngle(NEG_Z, b.roll));
      if (b.traced) b.glow.scale.setScalar(Math.max(1, TRACER_PX * b.pos.distanceTo(this.game.camera.position)));
    }
  }

  /**
   * The step prev → b.pos: the nearer of an animal (AnimalManager.raycast, cut short at the world hit so a wall in
   * front wins) and the world (a this.profile.radius ball swept through the physics world — terrain, trunks, rocks,
   * structures). By the surface's material the bolt sticks (wood, planks, ground, sand, grass), or glances off
   * (stone, rock, metal, shell): a short skip with most of its speed lost, then it lies on the first floor it falls on
   * (knocking off any wall on the way).
   * Returns true when the bolt stopped.
   */
  private testHit(b: Bolt, prev: THREE.Vector3): boolean {
    _dir.subVectors(b.pos, prev);
    const segLen = _dir.length();
    if (segLen < 1e-6) return false;
    _dir.multiplyScalar(1 / segLen);
    const wall = worldHit(prev, b.pos, this.profile.radius);

    // animals, short of the wall
    if (this.targets) {
      const hit = this.targets.raycast(prev, _dir, wall ? wall.distance : segLen);
      if (hit) {
        this.onBoltHit(hit);
        const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.point.distanceTo(this.player.position)) * b.mod.damage(hit.animal.kind), hit.point, _dir);
        this.onHit?.(hit.animal.kind, hit.headshot, killed);
        const frame = hit.animal.stuckFrame?.(hit.point) ?? null; // a practice dummy keeps the bolt, on the bone it hit
        const attached = frame instanceof THREE.Object3D ? frame : null;
        this.stopBolt(b, hit.point, _dir, 'flesh', attached !== null, this.profile.bury, false, attached);
        return true;
      }
    }
    if (!wall) return false;
    const n = _v2.set(wall.normal.x, wall.normal.y, wall.normal.z);
    if (n.dot(_dir) > 0) n.negate(); // facing the bolt
    const at = _v3.set(wall.point.x, wall.point.y, wall.point.z); // the ball's centre, touching the surface
    if (b.glanced && n.y >= 0.5) { this.restBolt(b, at, n); return true; } // a spent bolt lies where it lands
    const surface = impactSurfaceOf(wall.material);
    if (!b.glanced && sticksIn(wall.material)) {
      // the ball touches one radius off the surface: the tip carries on along the flight to it
      at.addScaledVector(_dir, this.profile.radius / Math.max(0.25, -n.dot(_dir)));
      this.stopBolt(b, at, _dir, surface, true, this.profile.bury, false, movingOwner(wall.owner));
      return true;
    }
    // glance: off the surface with little of the speed left, then gravity has it
    at.addScaledVector(n, GLANCE_LIFT);
    if (!b.glanced) { this.puffs.emit(at, _dir, surface); this.onImpact?.(surface, at); } // a spent bolt knocks off walls quietly
    const vn = b.vel.dot(n);
    b.vel.addScaledVector(n, -vn).multiplyScalar(GLANCE_KEEP).addScaledVector(n, -vn * GLANCE_BOUNCE);
    if (b.vel.length() > GLANCE_MAX) b.vel.setLength(GLANCE_MAX);
    b.pos.copy(at);
    b.glanced = true;
    return false;
  }

  /** A spent (glanced) bolt comes to rest lying on the surface it fell onto: along its travel, flat to the surface. */
  private restBolt(b: Bolt, at: THREE.Vector3, n: THREE.Vector3): void {
    const along = _v1.copy(_dir).addScaledVector(n, -_dir.dot(n));
    if (along.lengthSq() < 1e-6) along.crossVectors(n, Math.abs(n.y) < 0.9 ? Y_AXIS : X_AXIS); // fell straight down: any way along the surface
    along.normalize();
    // the tip half a bolt ahead of the contact so the shaft lies across it, on the surface instead of a radius above it
    at.addScaledVector(n, -this.profile.radius * 0.8).addScaledVector(along, (this.nockZ - this.tipLocal.z) * 0.5);
    this.stopBolt(b, at, along, 'ground', true, 0, true);
  }

  /** `bury`: how deep the broadhead goes in; `quiet`: no puff / impact event (a spent bolt settling) */
  private stopBolt(b: Bolt, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, stick: boolean, bury = this.profile.bury, quiet = false, rideOn: THREE.Object3D | null = null): void {
    b.active = false; b.mesh.visible = false;
    this.endTracer(b, point);
    if (!quiet) {
      this.puffs.emit(point, dir, surface);
      this.onImpact?.(surface, point);
    }
    if (!stick) return;
    // stick: a static mesh, permanent, with the broadhead this.profile.bury into the surface and the shaft + fletching
    // standing proud. The geometry origin sits -tipLocal.z (≈ 21.5 cm, measured from the bounding box) behind
    // the tip, so the origin goes this.profile.bury + tipLocal.z along the flight direction from the hit point.
    if (this.stuck.length >= this.profile.maxStuck) this.removeStuck(0);
    const mesh = new THREE.Mesh(this.boltGeo, b.mod.material ?? this.boltMat);
    mesh.castShadow = true;
    mesh.position.copy(point).addScaledVector(dir, bury + this.tipLocal.z);
    mesh.quaternion.setFromUnitVectors(NEG_Z, dir).multiply(_q.setFromAxisAngle(NEG_Z, b.roll));
    if (b.traced) { // permanent red dot on the nock so a traced bolt reads from a distance
      const dot = new THREE.Mesh(stuckDotGeo, glowMat); dot.renderOrder = TRACER_ORDER + 1;
      dot.position.set(0, 0, this.nockZ);
      mesh.add(dot);
    }
    this.game.scene.add(mesh);
    if (rideOn !== null) rideOn.attach(mesh); // stuck in something that moves (the boat, a door): it rides along (P5-L1)
    this.stuck.push({ mesh });
  }
  private removeStuck(i: number): void {
    const s = this.stuck.splice(i, 1)[0];
    if (s !== undefined) s.mesh.removeFromParent();
  }

  /** the iron bolt's material (special bolts dress a uniform-only clone of it — BoltMod.material) */
  get boltMaterial(): THREE.Material { return this.boltMat; }
  /** flying bolt count (for debugging / HUD) */
  get inFlight(): number { let n = 0; for (const b of this.bolts) if (b.active) n++; return n; }
  get stuckCount(): number { return this.stuck.length; }
}

/** The Object3D a hit collider moves with: a registered piece that `follows` one (the boat, a cabin door), else null. */
function movingOwner(owner: unknown): THREE.Object3D | null {
  if (typeof owner !== 'object' || owner === null || !('follows' in owner)) return null;
  const f = (owner as { follows?: unknown }).follows;
  return f instanceof THREE.Object3D ? f : null;
}

/** A shard's crossbow as a row: its default profile, parts and hands builders, flight law and view. */
export interface BoltCrossbowRow<P extends BoltCrossbowProfile> {
  readonly profile: P;
  readonly parts: BoltCrossbowOptions<P>['parts'];
  readonly hands?: BoltCrossbowOptions<P>['hands'];
  readonly flight: BoltFlightStep<P>;
  readonly view: BoltCrossbowView;
}
/** Construction of a row-bound crossbow: its equipment row and an optional profile over the row's. */
export interface BoltCrossbowRowOptions<P extends BoltCrossbowProfile> extends RangedOptions {
  profile?: P;
}
/** The constructor a row binds: `new Crossbow(world, targets, { row })`, as every other held weapon is built. */
export interface BoltCrossbowType<P extends BoltCrossbowProfile> {
  new (world: RangedWorld, targets: Targets | undefined, opts: BoltCrossbowRowOptions<P>): BoltCrossbow<P>;
  readonly prototype: BoltCrossbow<P>;
}
/**
 * Bind a shard's row to the family (SHARD-PLATFORM SF36): the shard writes data and a model, never a subclass.
 *
 *   export const Crossbow = crossbowType({ profile: CROSSBOW_PROFILE, parts: buildCrossbow, hands: crossbowHands, flight: boltFlightStep, view: CROSSBOW_VIEW });
 *   const crossbow = new Crossbow(world, targets, { row: CROSSBOW, allowUnlocked });
 */
export function crossbowType<P extends BoltCrossbowProfile>(row: BoltCrossbowRow<P>): BoltCrossbowType<P> {
  return class extends BoltCrossbow<P> {
    constructor(world: RangedWorld, targets: Targets | undefined, opts: BoltCrossbowRowOptions<P>) {
      super(world, targets, { ...opts, profile: opts.profile ?? row.profile, parts: row.parts, ...(row.hands ? { hands: row.hands } : {}), flight: row.flight, view: row.view });
    }
  };
}
