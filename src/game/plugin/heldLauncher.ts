import * as THREE from 'three';
import { app, gameplayRandom } from '@wildshard/engine/app/runtime';
import type { AmmoRow } from '@wildshard/engine/combat/ammo';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { RangedAction } from '@wildshard/engine/combat/Firearm';
import { ProjectileContact } from '@wildshard/engine/combat/projectileContact';
import { projectileFlightStep, ProjectileSlots, type FlightSlot } from '@wildshard/engine/combat/projectileFlight';
import { shotSpread } from '@wildshard/engine/combat/shotSpread';
import type { TargetHit, Targets } from '@wildshard/engine/combat/types';
import { ProjectilePresentation } from '@wildshard/engine/combat/view/projectile';
import { FOV_ADS, FOV_HIP, impactSurfaceOf, isMesh, prepareWeaponView, Puffs, weaponDisplay, whiteColors, worldHit, type RangedOptions, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import { quiverState, Weapon, type ImpactSurface } from '@wildshard/engine/combat/Weapon';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { HeldHandParts } from '@wildshard/engine/player/heldHandParts';
import { sstep } from '@wildshard/engine/player/viewmodelTextures';
import { RangedFrame, type RangedFrameRow, type RangedTraceRow } from '@wildshard/engine/render/viewmodelFeel';
import { getSetting } from '@wildshard/engine/ui/Settings';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { heldFirearmParts, heldGrip, placeHeldFist, type HeldFirearmHands, type HeldFirearmModel, type HeldModelRows } from './heldFirearm';
import { createClientScene } from './ui';
import { HeldPlayback } from './weaponFamily';

/**
 * The held-launcher host (H3, SHARD-PLATFORM C6 view, G454 data only): a first-person crossbow loosing physical bolts,
 * beside `HeldFirearm`'s hitscan. The shard passes rows and borrowed geometry, never a callback:
 *
 * - `rows.scene`: the model's private hierarchy (`createClientScene` rows) over `model.geometry`; `rows.objects` names its
 *   declared groups (`sight`, `sightRing`), `rows.nodes` the meshes the rows pose (`stringLeft`, `stringRight`, `serving`,
 *   `round` the loaded bolt, `sightPost`); `rows.materials` / `rows.textures` as `HeldFirearm`'s, `rows.fade` the
 *   materials whose opacity follows the sights' blend.
 * - The action is `RangedAction` in quiver mode (one bolt on the rail); the string is a spring (`rows.string`) that snaps
 *   forward on a loose and draws back over the reload's window. Bolts fly the engine's `projectileFlightStep` (the
 *   profile's gravity / drag × the loaded bolt's), `profile.substeps` a frame, and hit the nearer of a target and the world
 *   (`ProjectileContact`, `rows.glance`): they stick (riding a moving owner or a target's bone), glance or lie.
 * - `rows.playback`: HeldPlayback groups `frame`, `pose`, `parts`, `sight`, `string`, `peep`, their input bindings and
 *   outputs (`frame` → the pose frame, `sight` → `adsPose`). `hands`: two baked fists (HeldHandParts), fixed on the model.
 *
 * Owner paths the rows read on `weapon` (a data contract: move the JSON paths with any rename): `time`, `player`, `feel`,
 * `holster`, `state`, `inspect`, `adsPose`, `view`, `profile`, `game`, `draw`, `poseFrame`, `tipModel`, `tipL`, `tipR`,
 * `nockRest`, `nockDrawn` (the last four: `rows.anchors`).
 *
 *   const crossbow = new HeldLauncher(world, targets, { row, profile, view, rows, model: { geometry }, hands });
 */

type Triple = readonly [number, number, number];
/** The numbers the host reads: the quiver, the bolt's speed / flight / reach / bury, the timing, kick, ADS and the pools. */
export interface HeldLauncherProfile {
  quiver: number; speed: number; gravity: number; drag: number; radius: number; bury: number;
  reload: number; autoReload: number; cooldown: number; kick: number; adsBlend: number; adsMotion: number;
  maxFlying: number; maxStuck: number;
  spreadAds?: number; spreadHip?: number; spreadRadius?: 'linear' | 'sqrt'; spreadAxisScale?: 1 | 2;
  muzzle?: number; substeps?: number; lifetime?: number; damageScale?: number;
}
/** The launcher's view (metres, radians): the hip pose and scale, the iron sights, the rear peep. */
export interface HeldLauncherView {
  readonly hip: { readonly px: number; readonly py: number; readonly pz: number; readonly rx: number; readonly ry: number; readonly rz: number; readonly scale: number };
  readonly ads: { readonly eyeAboveRail: number; readonly nearMargin: number; readonly pitch: number };
  readonly peep: { readonly z: number; readonly radius: number; readonly worldRadius: number };
}
/**
 * The next bolt to leave the rail (a shard's loadout sets it): `gravity` / `drag` multiply the profile's, `damage` the damage
 * model's number by target kind (`default` for any other), `material` dresses the bolt (a uniform-only clone of its material).
 */
export interface HeldBolt { gravity: number; drag: number; damage: { readonly default: number; readonly kinds?: Readonly<Record<string, number>> }; material?: THREE.Material | undefined }
export const PLAIN_BOLT: HeldBolt = { gravity: 1, drag: 1, damage: { default: 1 } };
/** The launcher's rows (see the module comment). */
export interface HeldLauncherRows extends Pick<HeldModelRows, 'materials' | 'textures'> {
  readonly scene: unknown;
  readonly objects: { readonly sight: string; readonly sightRing: string };
  readonly nodes: { readonly stringLeft: string; readonly stringRight: string; readonly serving: string; readonly round: string; readonly sightPost: string };
  readonly fade: readonly string[];
  readonly anchors: { readonly tipL: Triple; readonly tipR: Triple; readonly nockRest: Triple; readonly nockDrawn: Triple };
  /** the string spring held / reloading ([stiffness, damping]), its velocity on a loose, the reload window it draws over */
  readonly string: { readonly spring: readonly [number, number]; readonly reloadSpring: readonly [number, number]; readonly release: number; readonly reload: readonly [number, number] };
  readonly glance: { readonly lift: number; readonly keep: number; readonly bounce: number; readonly maxSpeed: number };
  readonly frame: RangedFrameRow;
  /** the trail, the bolt's spin (rad/s) and the glow sizes: on a flying bolt, a stuck nock, an impact marker, its ring */
  readonly tracer: { readonly row: RangedTraceRow & { readonly roster: number; readonly markerScale: number; readonly order: number }; readonly spin: number;
    readonly glow: { readonly flight: number; readonly stuck: number; readonly impact: number; readonly ring: readonly [number, number] } };
  /** the display copy's rest pose: per root child (index + material name checked), its position / quaternion / scale */
  readonly displayRest: readonly { readonly child: number; readonly material: string; readonly position: readonly number[]; readonly quaternion: readonly number[]; readonly scale: readonly number[] }[];
  readonly playback: {
    readonly groups: Readonly<Record<'frame' | 'pose' | 'parts' | 'sight' | 'string' | 'peep', readonly unknown[]>>;
    readonly inputs: readonly { readonly group: string; readonly rows: unknown }[];
    readonly outputs: readonly { readonly group: string; readonly rows: readonly { readonly property: string; readonly target: string; readonly path: readonly string[] }[]; readonly target: 'frame' | 'sight' }[];
  };
}
export interface HeldLauncherOptions<P extends HeldLauncherProfile> extends RangedOptions {
  profile: P; view: HeldLauncherView; rows: HeldLauncherRows; model: HeldFirearmModel; hands?: Omit<HeldFirearmHands, 'gate'>;
}

type BoltData = ReturnType<ProjectilePresentation['flight']> & { mod: HeldBolt; ammo?: AmmoRow | undefined };
type Bolt = FlightSlot<BoltData>;
const need = <T>(value: T | null | undefined, what: string): T => { if (value === undefined || value === null) throw new Error(`Held launcher: missing ${what}`); return value; };
const MAX_REST_ROWS = 64, MAX_PART_DEPTH = 32;

/** The rows' scene built on fresh materials: its root, the named meshes and groups, the bolt's geometry and material. */
function buildScene(sky: Sky, rows: HeldLauncherRows, model: HeldFirearmModel, groups?: { sight: THREE.Group; sightRing: THREE.Group }) {
  const { geometry, materials } = heldFirearmParts(sky, { materials: rows.materials, ...rows.textures === undefined ? {} : { textures: rows.textures }, parts: [], anchors: {} }, model);
  const sight = groups?.sight ?? new THREE.Group(), sightRing = groups?.sightRing ?? new THREE.Group();
  const made = createClientScene(rows.scene, { geometry: id => geometry.get(id) ?? null, objects: new Map([[rows.objects.sight, sight], [rows.objects.sightRing, sightRing]]), materials });
  const mesh = (id: string): THREE.Mesh => need(made.mesh(id), `node ${id}`);
  const round = mesh(rows.nodes.round), boltMat = round.material;
  if (!(boltMat instanceof THREE.MeshStandardMaterial)) throw new Error('Held launcher: the bolt needs a lit material');
  return { root: made.root, mesh, round, boltGeo: round.geometry, boltMat, sight, sightRing, materials };
}
/** Pose a fresh copy at rest and keep its displayed parts (no hidden sight, no hands): a pickup's or the Model Explorer's card. */
function displayCopy(source: THREE.Object3D, rows: HeldLauncherRows, sky: Sky, round: string): THREE.Group {
  const root = source.clone(true);
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
  if (rows.displayRest.length > MAX_REST_ROWS) throw new Error('Held launcher: display rest rows over their bound');
  for (const row of rows.displayRest) {
    const mesh = root.children[row.child];
    if (mesh === undefined || !isMesh(mesh) || Array.isArray(mesh.material) || mesh.material.name !== row.material) throw new Error('Held launcher: display rest part changed');
    mesh.position.fromArray(row.position); mesh.quaternion.fromArray(row.quaternion); mesh.scale.fromArray(row.scale);
  }
  root.updateMatrixWorld(true);
  const hiddenUnder = (mesh: THREE.Object3D): boolean => {
    let parent = mesh.parent;
    for (let depth = 0; depth < MAX_PART_DEPTH; depth++) { if (parent === null || parent === root) return false; if (!parent.visible) return true; parent = parent.parent; }
    throw new Error('Held launcher: display part nests too deep');
  };
  const parts: Parameters<typeof weaponDisplay>[0][number][] = [];
  root.traverse(mesh => {
    if (!isMesh(mesh) || Array.isArray(mesh.material)) return;
    const mat = mesh.material;
    if (!mat.name || !mat.colorWrite || (!mesh.visible && mat.name !== round) || mesh.userData['viewmodelOnly'] === true || hiddenUnder(mesh)) return;
    parts.push({ geo: mesh.geometry, mat, matrix: mesh.matrixWorld });
  });
  return weaponDisplay(parts, { mode: 'merged', sky, opaque: true });
}
/** The Model Explorer's card: a fresh model at rest, its sight left out, on merged world materials. */
export function heldLauncherDisplay(sky: Sky, rows: HeldLauncherRows, model: HeldFirearmModel): THREE.Group {
  const made = buildScene(sky, rows, model);
  made.root.remove(made.sight);
  made.root.traverse(m => { if (isMesh(m) && (Array.isArray(m.material) ? m.material : [m.material]).some(mat => mat.vertexColors)) whiteColors(m.geometry); }); // the program reads vertex colours
  return displayCopy(made.root, rows, sky, made.boltMat.name);
}
/** The bolt alone (its geometry borrowed, its material fresh): the Model Explorer's bolt card. */
export function heldLauncherBolt(sky: Sky, rows: HeldLauncherRows, model: HeldFirearmModel): { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  const made = buildScene(sky, rows, model);
  return { geometry: made.boltGeo, material: made.boltMat };
}

const _v1 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3(), _aimEnd = new THREE.Vector3();

/** A held launcher on rows: the platform's trigger, string, bolts, tracers, sights, pose and hands. */
export class HeldLauncher<P extends HeldLauncherProfile = HeldLauncherProfile> extends Weapon {
  readonly profile: P; readonly view: HeldLauncherView;
  readonly state: ReturnType<typeof quiverState>;
  enabled = true; allowUnlocked = false; adsHeld = false; holster = 0;
  /** dev: 1 = the showcase pose; reload duration multiplier */
  inspect = 0; reloadScale = 1;
  aimInfo: { kind: string; distance: number } | null = null;
  /** the bolt on the rail, read at each loose */
  boltMod: HeldBolt = PLAIN_BOLT;
  selectedAmmo: AmmoRow | undefined;
  override get ammoLabel(): string { return this.row.ui.ammo?.label ?? ''; }
  override set ammoLabel(label: string) { if (this.row.ui.ammo) this.row = { ...this.row, ui: { ...this.row.ui, ammo: { ...this.row.ui.ammo, label } } }; }

  readonly model = new THREE.Group();
  readonly adsPose = { px: 0, py: 0, pz: 0, rx: 0, scale: 0, tipDepth: 0, eyeAboveRail: 0, nutDepth: 0, nutNdcY: 0, limbNdcX: 0, tipNdcY: 0, peepY: 0, peepZ: 0, peepDepth: 0, peepR: 0 };
  readonly tipL: THREE.Vector3; readonly tipR: THREE.Vector3; readonly nockRest: THREE.Vector3; readonly nockDrawn: THREE.Vector3;
  readonly tipModel = new THREE.Vector3(); readonly tipLocal = new THREE.Vector3();
  /** the string's draw (1 = spanned) */
  draw = 1;
  private drawVel = 0; private drawTarget = 1;
  private readonly rows: HeldLauncherRows;
  private readonly game: RangedWorld['game']; private readonly sky: Sky; private readonly player: RangedWorld['player'];
  private readonly targets: Targets | undefined;
  private readonly loadedBolt: THREE.Mesh; private readonly boltGeo: THREE.BufferGeometry; private readonly boltMat: THREE.MeshStandardMaterial;
  private readonly nockZ: number;
  private readonly sight: THREE.Group; private readonly fadeMats: THREE.Material[];
  private readonly hands: HeldHandParts | null = null;
  private readonly action: RangedAction;
  private readonly reloadPose = (pr: number): void => { const [a, b] = this.rows.string.reload; this.drawTarget = pr >= 1 ? 1 : sstep(a, b, pr); };
  private readonly feel: RangedFrame;
  private readonly frameInputs = { enabled: false, active: false, held: false, reloading: false, adsDuration: 1, kick: 0 };
  private readonly posePlayback: HeldPlayback;
  private readonly poseFrame = { portrait: 0, ads: 0, reloading: 0, scale: 1, sprinting: 0, sprint: 0, reloadTilt: 0 };
  private readonly partValues = { loaded: 0, reloading: 0, reloadProgress: 0 };
  private readonly flightPool: ProjectileSlots<BoltData>;
  private readonly presentation: ProjectilePresentation;
  private readonly puffs = new Puffs();
  private readonly contacts: ProjectileContact<Bolt>;
  private time = 0;

  constructor(world: RangedWorld, targets: Targets | undefined, opts: HeldLauncherOptions<P>) {
    super(opts.row);
    const { rows, view, profile } = opts;
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.ranged' } };
    this.profile = profile; this.view = view; this.rows = rows;
    this.adsPose.rx = view.ads.pitch; this.adsPose.peepZ = view.peep.z;
    this.state = quiverState({ bolts: profile.quiver, loaded: true, reloading: false, reloadProgress: 0, ads: false }, profile.quiver);
    this.action = new RangedAction(this, { mode: 'quiver', maximum: profile.quiver, interval: profile.cooldown, reload: profile.reload, autoReload: profile.autoReload, autoFrom: 'shot' });
    this.game = world.game; this.sky = world.sky; this.player = world.player; this.targets = targets;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.feel = new RangedFrame(rows.frame, this.player, FOV_HIP, FOV_ADS);
    const a = rows.anchors;
    this.tipL = new THREE.Vector3(...a.tipL); this.tipR = new THREE.Vector3(...a.tipR); this.nockRest = new THREE.Vector3(...a.nockRest); this.nockDrawn = new THREE.Vector3(...a.nockDrawn);

    // the model: the scene's children under the viewmodel group, its bolt's tip and nock measured
    const made = buildScene(this.sky, rows, opts.model);
    this.model.add(...made.root.children);
    this.loadedBolt = made.round; this.boltGeo = made.boltGeo; this.boltMat = made.boltMat; this.sight = made.sight;
    this.fadeMats = rows.fade.map(id => need(made.materials.get(id), `material ${id}`));
    const box = need(this.boltGeo.boundingBox, 'bolt bounds');
    this.tipLocal.set(0, 0, box.min.z); this.tipModel.copy(this.tipLocal).add(this.loadedBolt.position); this.nockZ = box.max.z;
    prepareWeaponView(this.model); // the engine's shared depth clear at 999; the model at 1000 in the transparent queue
    this.model.scale.setScalar(view.hip.scale);

    const trace = rows.tracer, glow = trace.glow;
    this.presentation = new ProjectilePresentation(this.game.scene, this.boltGeo, this.boltMat,
      { flying: profile.maxFlying, stopped: profile.maxStuck, axis: [0, 0, -1], spin: trace.spin, tip: this.tipLocal.z, nock: this.nockZ, trace: trace.row, traceCount: trace.row.roster, markerScale: trace.row.markerScale, order: trace.row.order + 1 },
      { material: new THREE.MeshBasicMaterial({ color: new THREE.Color(...trace.row.color), transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }),
        flight: new THREE.SphereGeometry(glow.flight, 12, 8), stuck: new THREE.SphereGeometry(glow.stuck, 10, 6), impact: new THREE.SphereGeometry(glow.impact, 14, 10), ring: new THREE.RingGeometry(glow.ring[0], glow.ring[1], 28) },
      () => this.flightPool.slots);
    this.contacts = new ProjectileContact<Bolt>({ glance: rows.glance, spentRest: 'upward', impactAfterLift: true, impactOnRepeatedGlance: false }, {
      world: worldHit, target: (from, direction, distance) => this.targets?.raycast(from, direction, distance) ?? null,
      hit: (bolt, hit, direction) => { this.boltHit(bolt, hit, direction); },
      stop: (bolt, at, direction, wall) => { this.stopBolt(bolt, at, direction, impactSurfaceOf(wall.material), true, profile.bury, false, ProjectilePresentation.movingFrame(wall.owner)); },
      rest: (bolt, at, direction) => { this.stopBolt(bolt, at, direction, 'ground', true, 0, true); },
      impact: (at, direction, wall) => { const surface = impactSurfaceOf(wall.material); this.puffs.emit(at, direction, surface); this.onImpact?.(surface, at); },
      expire: bolt => { bolt.active = false; bolt.mesh.visible = false; },
    });
    this.flightPool = new ProjectileSlots<BoltData>(profile.maxFlying, () => ({ ...this.presentation.flight(), mod: PLAIN_BOLT }), {
      substeps: profile.substeps ?? 4, extent: CHUNK_HALF + 60, floor: -150, lifetime: profile.lifetime ?? 12,
      integrate: (bolt, h) => {
        const mod = bolt.ammo && this.equipEvents ? this.equipEvents.ask('projectile.modify', { ammo: bolt.ammo, gravity: bolt.ammo.flight.gravity, drag: bolt.ammo.flight.drag }) : bolt.mod;
        projectileFlightStep(bolt.pos, bolt.vel, h, { gravity: profile.gravity * mod.gravity, drag: profile.drag * mod.drag, windCoupling: 0 });
      },
      contact: (bolt, previous) => this.contacts.step(bolt, previous, profile.radius, this.nockZ - this.tipLocal.z), advanced: bolt => { bolt.tracer?.addPoint(bolt.pos); },
      expired: bolt => { bolt.mesh.visible = false; this.presentation.finishTrace(bolt, bolt.pos, this.time); },
      moved: (bolt, dt) => { this.presentation.move(bolt, bolt.pos, bolt.vel, dt, this.game.camera); },
    });
    this.presentation.prepareTraces();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.puffs.points);

    const hands = opts.hands;
    if (hands !== undefined) {
      const fist = (row: typeof hands.left, name: string) => ({ name, geometry: row.geometry, sleeve: row.sleeve, wrist: row.wrist, dir: row.dir, elbow: row.elbow,
        material: hands.material, sleeveMaterial: row.coat === true ? hands.coatMaterial ?? hands.material : hands.material });
      this.hands = new HeldHandParts(this.model, [fist(hands.left, 'hand-left'), fist(hands.right, 'hand-right')],
        { name: 'weapon-hands', viewmodelOnly: true, transparentMaterials: [hands.material, hands.coatMaterial ?? hands.material] });
      placeHeldFist(this.hands.fist(0), heldGrip(hands.left), true); placeHeldFist(this.hands.fist(1), heldGrip(hands.right), false);
    }

    const play = rows.playback;
    this.posePlayback = new HeldPlayback(play.groups, new Map<string, unknown>([['root', this.model], ['loadedBolt', this.loadedBolt], ['stringLeft', made.mesh(rows.nodes.stringLeft)],
      ['stringRight', made.mesh(rows.nodes.stringRight)], ['serving', made.mesh(rows.nodes.serving)], ['peep', made.sight], ['peepRing', made.sightRing], ['peepPost', made.mesh(rows.nodes.sightPost)]]));
    const owners = new Map([['weapon', this]]);
    for (const input of play.inputs) this.posePlayback.bindInputs(input.group, input.rows, owners);
    for (const output of play.outputs) this.posePlayback.bindOutputs(output.group, output.rows, new Map(output.rows.map(row => [row.target, output.target === 'frame' ? this.poseFrame : this.adsPose])));
  }

  /** dev / the cost readout: what the hands add (null without) */
  get handsCost(): { draws: number; tris: number; verts: number; bytes: number } | null { return this.hands?.cost ?? null; }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.feel.bindInputs(app.input, ctx.scope, this, this.player);
    ctx.scope.onDispose(() => { this.posePlayback.dispose(); this.model.removeFromParent(); });
  }
  /** Pull the trigger: looses if loaded, else starts a reload (and reports a dry pull). */
  tryFire(): void { this.action.trigger(() => { this.fire(); }); }
  fire(): void {
    if (!this.state.loaded || this.state.reloading) return;
    this.action.shot();
    this.drawTarget = 0; this.drawVel = this.rows.string.release;
    this.feel.shot(this.profile.kick);
    this.spawnBolt();
    this.onFire?.();
  }
  override reload(): void { this.action.reload(); }
  override addBolts(n: number): void { this.state.bolts = Math.min(this.profile.quiver, this.state.bolts + n); }
  /** world position of the loaded bolt's tip (the iron sight) */
  tipWorld(out: THREE.Vector3): THREE.Vector3 { return this.loadedBolt.localToWorld(out.copy(this.tipLocal)); }
  /** the plain bolt's material (special bolts dress a uniform-only clone of it) */
  get boltMaterial(): THREE.Material { return this.boltMat; }
  get inFlight(): number { let n = 0; for (const b of this.flightPool.slots) if (b.active) n++; return n; }
  get stuckCount(): number { return this.presentation.stuckCount; }
  /** A world copy for a pickup or a skin drop: the model at rest, without the hands, on merged world materials. */
  displayModel(): THREE.Group { return displayCopy(this.model, this.rows, this.sky, this.boltMat.name); }

  /** The aim line is always the camera forward (hip or sighted); a sighted bolt leaves from the tip, parallel to it. */
  private spawnBolt(): void {
    const b = this.flightPool.take(), p = this.profile;
    const a = sstep(0, 1, this.feel.adsBlend);
    this.aimRay(_v3, _fwd);
    const spread = THREE.MathUtils.degToRad((p.spreadAds ?? 0.15) + (1 - a) * ((p.spreadHip ?? 0.75) - (p.spreadAds ?? 0.15)));
    _dir.copy(_fwd);
    shotSpread(_dir, spread, gameplayRandom, { radius: p.spreadRadius ?? 'linear', axisScale: p.spreadAxisScale ?? 2 }, _v1);
    b.pos.copy(_v3).addScaledVector(_fwd, p.muzzle ?? 0.35); // the command's origin, never the drawn bolt's
    b.vel.copy(_dir).multiplyScalar(p.speed);
    b.roll = 0; b.mod = this.boltMod; b.ammo = this.selectedAmmo;
    this.presentation.launch(b, b.pos, _dir, b.mod.material ?? this.boltMat, getSetting('tracers'), this.time);
  }

  update(dt: number, t: number): void {
    this.time = t; this.posePlayback.beginFrame(dt);
    const p = this.player, cam = this.game.camera, s = this.state, string = this.rows.string;
    this.action.advance(dt, this.reloadScale, true, this.reloadPose);
    // the string spring (stiff, slightly under-damped so the release overshoots)
    const [k, c] = s.reloading ? string.reloadSpring : string.spring;
    this.drawVel += (-(this.draw - this.drawTarget) * k - this.drawVel * c) * dt;
    this.draw += this.drawVel * dt;
    this.posePlayback.apply('string', this.poseFrame);
    const parts = this.partValues; parts.loaded = Number(s.loaded); parts.reloading = Number(s.reloading); parts.reloadProgress = s.reloadProgress;
    this.posePlayback.apply('parts', parts);
    this.loadedBolt.material = this.boltMod.material ?? this.boltMat;
    const frame = this.frameInputs;
    frame.enabled = this.enabled; frame.active = true; frame.held = this.adsHeld;
    frame.reloading = s.reloading; frame.adsDuration = this.profile.adsBlend; frame.kick = this.profile.kick;
    s.ads = this.feel.sampleFrame(dt, p, frame, cam, this.sky.csm);
    // pose: hip ↔ sighted ↔ sprint ↔ reload
    this.poseFrame.sprinting = Number(p.sprinting); this.poseFrame.reloading = Number(s.reloading);
    this.posePlayback.apply('frame', this.poseFrame);
    const a = this.poseFrame.ads; if (a > 0) this.posePlayback.apply('sight', this.poseFrame);
    this.sight.visible = a > 0.001 && !this.inspect;
    if (this.sight.visible) { this.posePlayback.apply('peep', this.poseFrame); for (const m of this.fadeMats) m.opacity = a; }
    this.posePlayback.apply('pose', this.poseFrame);
    this.hands?.aim(this.model);
    this.feel.scanAim(this, this.targets, true, _v3, _fwd, _aimEnd, this.model);
    this.flightPool.step(dt);
    this.feel.presentEffects(dt, t, this.game.renderer, cam, this.puffs, this.presentation.traces, this.presentation.paint);
  }

  private boltHit(bolt: Bolt, hit: TargetHit, direction: THREE.Vector3): void {
    const damage = bolt.mod.damage, scale = damage.kinds?.[hit.animal.kind] ?? damage.default;
    const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.point.distanceTo(this.player.position)) * scale * (this.profile.damageScale ?? 1), hit.point, direction);
    this.onHit?.(hit.animal.kind, hit.headshot, killed);
    const frame = hit.animal.stuckFrame?.(hit.point) ?? null, attached = frame instanceof THREE.Object3D ? frame : null;
    this.stopBolt(bolt, hit.point, direction, 'flesh', attached !== null, this.profile.bury, false, attached);
  }
  /** `bury`: how deep the tip goes in; `quiet`: no puff / impact event (a spent bolt settling) */
  private stopBolt(b: Bolt, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, stick: boolean, bury: number, quiet: boolean, rideOn: THREE.Object3D | null = null): void {
    b.active = false; b.mesh.visible = false;
    this.presentation.finishTrace(b, point, this.time);
    if (!quiet) { this.puffs.emit(point, dir, surface); this.onImpact?.(surface, point); }
    if (stick) this.presentation.stick(point, dir, b.roll, b.mod.material ?? this.boltMat, b.traced, bury, rideOn);
  }
}
