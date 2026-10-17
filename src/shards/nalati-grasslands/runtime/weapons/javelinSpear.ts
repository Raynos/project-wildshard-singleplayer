import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import { gameplayRandom, app } from '@wildshard/engine/app/runtime';
import { aimRay, fovForAspect } from '@wildshard/engine/combat/blocks/melee';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { Melee } from '@wildshard/engine/combat/Melee';
import type { MeleeProfile } from '@wildshard/engine/combat/meleeProfile';
import { Thrown } from './Thrown';
import type { ThrownProfile } from './thrownProfile';
import type { Targets, TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import { impactSurfaceOf, worldHit, viewmodelMaterial } from '@wildshard/engine/combat/view/ranged';
import { quiverState, type WeaponState, type AimInfo, type ImpactSurface } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import { weaponActionGate } from '@wildshard/engine/input/weaponActions';
import { floorBelow, sticksIn } from '@wildshard/engine/physics/query';
import { targetRadius, type AimTarget } from '@wildshard/engine/player/AimTargets';
import { placeArm } from '@wildshard/engine/player/nalatiArms';
import type { Player } from '@wildshard/engine/player/Player';
import { viewmodel } from '@wildshard/engine/render/viewmodelFeel';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import * as schema from 'valibot';
import { ThrownWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import { readItemEquipment } from '@wildshard/game/plugin/nativeItems';
import { SWORD_WOOD } from '@wildshard/game/weapons/starterMeleeProfile';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';

/**
 * The javelin spear family (SHARD-PLATFORM SF36): a two-handed spear that thrusts, throws javelins from the same slot and
 * couches as a lance in the saddle, over a shard's model, materials and rows.
 *
 * THRUST (`tryFire`): `profile.thrust` (wind-up, active window, total, the fan of rays, damage, stagger); mid-thrust queues
 * one; no lunge. JAVELINS (`javelin`, a ThrownProfile: speed, gravity, damage, the pool, pickup): the touch THROW disc
 * (`adsHeld`, held) winds up with a dotted arc and throws on release; a quick desktop RMB tap (< `view.tapMax` s) throws.
 * Flight through the physics world (stuck in what `sticksIn` takes, lying on stone, gone into water), creatures short of
 * it (`Targets`), `damageMultiplier` at the hit; picked up by walking over them. COUCHED LANCE (`mount = { speed, yaw }`):
 * at `profile.lance.minSpeed` the spear levels; a creature closing inside its reach and cone takes
 * `baseDamage + speedDamage × speed`, once per `lance.rehit` s.
 *
 *   await prepareSpear(product);
 *   const spear = new Spear(world, targets, { allowUnlocked });  spear.mount = { speed, yaw };
 */

/** The host the spear draws into. */
export interface JavelinSpearWorld { game: Game; sky: Sky; player: Player; forest: Forest }
/** The riding hook: the horse's ground speed (m/s) and heading (rad). */
export interface JavelinSpearMount { speed: number; yaw: number }

/** The numbers the spear reads beside a melee profile's: the thrust and the couched lance. */
export interface JavelinSpearProfile extends MeleeProfile {
  readonly thrust: { readonly damage: number; readonly stagger: number; readonly windup: number; readonly activeEnd: number; readonly total: number;
    readonly fan: { readonly yaws: readonly number[]; readonly pitches: readonly number[] } };
  readonly lance: { readonly reach: number; readonly cone: number; readonly minSpeed: number; readonly baseDamage: number; readonly speedDamage: number; readonly rehit: number };
}

/** A spear's or a javelin's two draws: the painterly body and the PBR steel (with a `uv`). */
export interface JavelinSpearDraws { paint: THREE.BufferGeometry; metal: THREE.BufferGeometry }
/** A pose in camera space: the right hand's grip point and the shaft's rotation (+Y toward the head). */
export interface JavelinSpearPose { readonly pos: THREE.Vector3; readonly q: THREE.Quaternion }
/** The family's view as rows (camera space, metres, seconds). */
export interface JavelinSpearView {
  /** rest (two hands, low right), the thrust's cock and jab, the throw's left-low spear, sprint, the couched lance, the
   *  javelin cocked by the ear and the throwing hand out after the release */
  readonly poses: { readonly rest: JavelinSpearPose; readonly cock: JavelinSpearPose; readonly jab: JavelinSpearPose; readonly leftLow: JavelinSpearPose;
    readonly sprint: JavelinSpearPose; readonly lance: JavelinSpearPose; readonly javCock: JavelinSpearPose; readonly javOut: JavelinSpearPose };
  /** where the sleeves run back to (camera space): the elbows, just off the bottom corners of the frame */
  readonly elbows: { readonly left: THREE.Vector3; readonly right: THREE.Vector3 };
  /** a desktop RMB tap shorter than this (s) throws; a held RMB has no action */
  readonly tapMax: number;
  readonly javelinGrip: number;
  readonly wrists: { readonly left: THREE.Vector3; readonly right: THREE.Vector3 };
}
/** The family's construction: the profile row, the javelin row, the model, the view and the unlock policy. */
export interface JavelinSpearOptions<P extends JavelinSpearProfile> {
  readonly profile: P;
  readonly javelin: ThrownProfile;
  readonly view: JavelinSpearView;
  readonly allowUnlocked?: boolean;
}

const Y = new THREE.Vector3(0, 1, 0);
const _commandOrigin = new THREE.Vector3(), _commandRotation = new THREE.Quaternion();


interface Jav { state: 0 | 1 | 2; pos: THREE.Vector3; vel: THREE.Vector3; q: THREE.Quaternion; age: number }  // 0 none · 1 flying · 2 stuck
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _head = new THREE.Vector3(), _nrm = new THREE.Vector3(), _arcPrev = new THREE.Vector3(), _stickDir = new THREE.Vector3();
/** the top of the world under (x, z) from y down (terrain, a deck, a rock); the terrain when there is no physics */
function floorUnder(x: number, y: number, z: number): number {
  const ph = app.physics;
  return (ph ? floorBelow(ph, x, z, y, 60) : undefined) ?? heightAt(x, z);
}
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s1 = new THREE.Vector3(1, 1, 1);
const _vThrow = new THREE.Vector3(), _qThrow = new THREE.Quaternion(), _vCock = new THREE.Vector3(), _qCock = new THREE.Quaternion();
const _qSway = new THREE.Quaternion(), _qHol = new THREE.Quaternion(), _vArm = new THREE.Vector3(), _vEl = new THREE.Vector3();



/** A melee spear that is also thrown: thrusts, javelin throws that stick, lie or drop, pickup and the couched lance, dressed from a shard row. */
export class JavelinSpear<P extends JavelinSpearProfile = JavelinSpearProfile> extends Melee<P> {
  override readonly reach = this.profile.reach;
  readonly state: WeaponState;
  enabled = true;
  allowUnlocked = false;
  /** the touch THROW disc (held): press = wind up, release = throw */
  adsHeld = false;

  /** 0..1 weapon-swap blend (the kit drives it): 1 = dropped out of the frame */
  holster = 0;
  /** the riding row's hook (B7): horse speed / heading while mounted, null on foot */
  mount: JavelinSpearMount | null = null;
  /** Three javelins carried; the throw shares this weapon slot. */
  readonly thrown: Thrown;
  get javelins(): number { return this.thrown.ammo; }
  set javelins(value: number) { this.thrown.ammo = value; }
  get maxJavelins(): number { return this.thrown.profile.carried; }
  /** × the javelin's damage on a hit (the sneak shot from HIDDEN ×2 — src/shards/nalati-grasslands/stealth.ts); undefined = 1 */
  damageMultiplier: ((hit: TargetHit) => number) | undefined;
  /** show the dotted throw arc while winding up (touch default on — the bow's Hunter's-eye rule) */
  showArc = true;
  aimInfo: AimInfo | null = null;
  /** dev: showcase pose */
  inspect = 0;

  onThrow?: () => void;
  onPickup?: (n: number) => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets: Targets | undefined;
  private spearRig = new THREE.Group(); private handRig = new THREE.Group();
  private heldJav!: THREE.Group;
  private leftArm!: THREE.Mesh; private rightArm!: THREE.Mesh;
  private leftWrist = new THREE.Vector3(); private rightWrist = new THREE.Vector3();
  private arc!: THREE.Points; private arcPos: Float32Array; private arcAttr!: THREE.BufferAttribute; private arcMat!: THREE.PointsMaterial;
  private world!: THREE.InstancedMesh;
  private javs: Jav[] = [];
  private time = 0;
  // thrust
  private thrustT = -1; private hitDone = false; private queued = false;
  private rehit = new Map<object, number>();
  private rmbDown = false; private rmbT = 0;
  // throw
  private windT = -1; private throwT = -1; private releaseQueued = false; private throwPrev = false; private threw = false;
  // lance
  private lanceBlend = 0;
  // look lag / sway
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private fov = this.profile.feel.fovHip; private baseFov = 0; private jolt = 0; private sprintBlend = 0;
  private throwBlend = 0; private inHand = false; private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };
  private prevPos = new Map<object, THREE.Vector3>();

  private readonly view: JavelinSpearView;

  constructor(w: JavelinSpearWorld, targets: Targets | undefined, opts: JavelinSpearOptions<P>) {
    super(opts.profile, app.combat);
    const carried = opts.javelin.carried;
    this.state = quiverState({ bolts: carried, loaded: true, reloading: false, reloadProgress: 0, ads: false }, carried);
    this.thrown = new Thrown(opts.javelin);
    this.arcPos = new Float32Array(this.thrown.profile.arcPoints * 3);
    this.view = opts.view;
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.spear' } };
    this.game = w.game; this.sky = w.sky; this.player = w.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.build();
    const cam = this.game.camera;
    this.game.viewmodel.mountOwnPass(this.model, cam); // its own depth clear; staged while its cell prepares (op-hitch41)
    if (!cam.parent) this.game.scene.add(cam);
    this.aimBlock = aimRay(() => this.player.sampleAimCommand()); this.blocks.aim = this.aimBlock; this.blocks.vm = this.lookBlock;
  }

  // ── kit surface ──
  override get segments(): number { return this.maxJavelins; }
  get magazine(): number { return this.maxJavelins; }
  get winding(): boolean { return this.windT >= 0; }
  get thrusting(): boolean { return this.thrustT >= 0; }
  /** javelins in flight or stuck in the world (dev / HUD) */
  get javelinsOut(): number { let n = 0; for (const j of this.javs) if (j.state !== 0) n++; return n; }
  override addBolts(n: number): void { this.javelins = Math.min(this.maxJavelins, this.javelins + Math.max(0, n)); }
  override reload(): void { /* nothing to reload: javelins are picked up */ }
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }

  private readonly lookBlock = viewmodel(this.profile.feel.lag);
  private readonly lookState = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly lookDelta = new THREE.Vector2();
  private readonly aimBlock: ReturnType<typeof aimRay>;
  override install(ctx: EquipContext): void {
    super.install(ctx); this.bindInput(ctx);
    ctx.scope.onDispose(() => { this.model.removeFromParent(); this.world.removeFromParent(); this.arc.removeFromParent(); });
  }
  private bindInput(ctx: EquipContext): void {
    const allowed = weaponActionGate(this, this.player);
    app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, allowed);
    app.input.bind('aim', () => { this.rmbDown = true; this.rmbT = 0; }, ctx.scope, allowed);
    app.input.bindRelease('aim', () => { if (!this.rmbDown) return; this.rmbDown = false; if (allowed() && this.rmbT < this.view.tapMax) this.requestThrow(); }, ctx.scope);
    app.input.onReset(() => { this.rmbDown = false; }, ctx.scope);
  }

  /** a thrust (LMB / F / LOOK tap); mid-thrust queues one; ignored while throwing */
  tryFire(): void {
    if (!this.enabled || this.windT >= 0 || this.throwT >= 0) return;
    if (this.thrustT >= 0) { if (this.thrustT > this.profile.thrust.windup) this.queued = true; return; }
    this.thrustT = 0; this.hitDone = false; this.queued = false;
    this.onFire?.();
  }
  /** desktop tap / touch release: wind up (if not yet) and throw as soon as the wind-up is full */
  private requestThrow(): void {
    if (this.windT < 0 && !this.beginWind()) return;
    this.releaseQueued = true;
  }
  private beginWind(): boolean {
    if (!this.enabled || this.throwT >= 0) return false;
    if (this.javelins <= 0) { this.onDry?.(); return false; }
    this.thrustT = -1; this.queued = false;
    this.windT = 0; this.chargeEvent('throw', 0); this.releaseQueued = false;
    return true;
  }

  // ── build ──
  private build(): void {
    const mat = painterlyMaterial(this.sky, { vertexColors: true, rim: 0.55, bands: 0.7, transparent: true, depthWrite: true }); mat.name = 'nalati-viewmodel';
    const steel = viewmodelMaterial(this.sky, 'nalati-steel', { metalness: 0.55, roughness: 0.3, envMapIntensity: 0.7 }); steel.transparent = true; steel.depthWrite = true;
    this.leftWrist.copy(this.view.wrists.left); this.rightWrist.copy(this.view.wrists.right);
    this.leftArm = new THREE.Mesh(spearGeometry('left-arm'), mat); this.rightArm = new THREE.Mesh(spearGeometry('right-arm'), mat);
    for (const a of [this.leftArm, this.rightArm]) { a.frustumCulled = false; a.renderOrder = 1000; a.receiveShadow = true; this.model.add(a); }
    const add = (g: THREE.BufferGeometry, m: THREE.Material, to: THREE.Object3D) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      to.add(mesh);
    };
    add(spearGeometry('held-spear'), mat, this.spearRig); add(spearGeometry('spear-metal'), steel, this.spearRig);
    add(spearGeometry('right-fist'), mat, this.handRig);
    this.heldJav = new THREE.Group();
    add(spearGeometry('javelin-paint'), mat, this.heldJav); add(spearGeometry('javelin-metal'), steel, this.heldJav);
    this.heldJav.visible = false;
    this.heldJav.position.set(0, this.view.javelinGrip, 0); // the right hand grips it just behind the balance point
    this.handRig.add(this.heldJav);
    this.model.add(this.spearRig, this.handRig);
    // depth clear so the viewmodel never clips into the world (Sword.ts / Crossbow.ts: 999 in the transparent queue)
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    // the dotted throw arc (world space)
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', (this.arcAttr = new THREE.BufferAttribute(this.arcPos, 3)));
    this.arcAttr.setUsage(THREE.DynamicDrawUsage);
    ag.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.arcMat = new THREE.PointsMaterial({ color: 0x8fe3ff, size: 6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    this.arc = new THREE.Points(ag, this.arcMat);
    this.arc.frustumCulled = false; this.arc.renderOrder = 1003; this.arc.visible = false;
    this.game.scene.add(this.arc);
    // thrown javelins: one instanced mesh for every javelin in the world
    this.world = new THREE.InstancedMesh(spearGeometry('world-javelin'), painterlyMaterial(this.sky, { vertexColors: true, rim: 0.4 }), this.thrown.profile.pool);
    this.world.count = 0; this.world.castShadow = true; this.world.receiveShadow = true; this.world.frustumCulled = false;
    this.game.scene.add(this.world);
    for (let i = 0; i < this.thrown.profile.pool; i++) this.javs.push({ state: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), age: 0 });
  }

  // ── javelins in the world ──
  private launch(): void {
    const j = this.javs.find((x) => x.state === 0);
    if (j === undefined || this.javelins <= 0) return;
    if (!this.thrown.release()) return;
    this.aimPose(_commandOrigin, _commandRotation);
    this.aimRay(_commandOrigin, _fwd);
    // leave from beside the right ear, aimed 2° over the crosshair (a heavy javelin is thrown a little up)
    _v1.set(0.22, 0.05, -0.3).applyQuaternion(_commandRotation).add(_commandOrigin);
    _v2.set(1, 0, 0).applyQuaternion(_commandRotation);
    _dir.copy(_fwd).applyAxisAngle(_v2, 0.035).normalize();
    j.state = 1; j.age = 0; j.pos.copy(_v1); j.vel.copy(_dir).multiplyScalar(this.thrown.profile.speed);
    const m = this.mount;
    if (m !== null) { j.vel.x -= Math.sin(m.yaw) * m.speed; j.vel.z -= Math.cos(m.yaw) * m.speed; } // the horse's velocity rides along
    j.q.setFromUnitVectors(Y, _dir);
    this.chargeEvent('throw', 1); this.onFire?.(); this.onThrow?.();
  }
  private stick(j: Jav, at: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface): void {
    // embed the head ~0.25 m: the balance point sits 0.62 + 0.21 - 0.25 back along the flight
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    // `at` may be a module temporary (the flight passes `_v3`): the direction gets its own
    j.q.setFromUnitVectors(Y, _stickDir.copy(dir).normalize());
    j.pos.copy(at).addScaledVector(_stickDir, -0.58);
    this.onImpact?.(surface, at);
  }
  /** off stone: it lies where it struck, along its flight flattened onto the surface */
  private lie(j: Jav, at: THREE.Vector3, n: THREE.Vector3, surface: ImpactSurface): void {
    const along = _v2.copy(_dir).addScaledVector(n, -_dir.dot(n));
    if (along.lengthSq() < 1e-6) along.set(1, 0, 0);
    along.normalize();
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    j.q.setFromUnitVectors(Y, along);
    j.pos.copy(at).addScaledVector(n, 0.04).addScaledVector(along, -0.58);
    this.onImpact?.(surface, at);
  }
  private drop(j: Jav, at: THREE.Vector3): void {
    // a javelin that hit an animal falls beside it, head down-ish into the turf
    const a = gameplayRandom() * Math.PI * 2;
    _v1.set(at.x + Math.cos(a) * 0.6, 0, at.z + Math.sin(a) * 0.6);
    _v1.y = floorUnder(_v1.x, at.y + 1, _v1.z);   // the turf, a deck, a rock under it
    _dir.set(Math.cos(a + 1.3) * 0.7, -0.55, Math.sin(a + 1.3) * 0.7).normalize();
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    j.q.setFromUnitVectors(Y, _dir);
    j.pos.copy(_v1).addScaledVector(_dir, -0.45);
  }
  private flyJavelins(dt: number): void {
    const p = this.player.position;
    for (const j of this.javs) {
      if (j.state === 1) {
        j.age += dt;
        let rem = dt;
        while (rem > 0) { // every way out of the flight breaks the loop
          const h = Math.min(rem, 1 / 120); rem -= h;
          _v1.copy(j.pos);
          this.thrown.flightStep(j.pos, j.vel, h);
          const seg = _v2.subVectors(j.pos, _v1), len = seg.length();
          if (len < 1e-6) continue;
          _dir.copy(seg).multiplyScalar(1 / len);
          // the head leads the balance point by ~0.8 m: test the head's path — through the physics world (NALATI-MERGE P2:
          // a small ball swept like the crossbow's bolt: terrain, trunks, rocks, yurts, fences, decks), animals short of it
          _v3.copy(_v1).addScaledVector(_dir, this.thrown.profile.headOffset);
          _head.copy(_v3).addScaledVector(_dir, len);
          const wall = worldHit(_v3, _head, this.thrown.profile.radius);
          if (this.targets) {
            const hit = this.targets.raycast(_v3, _dir, wall ? wall.distance : len);
            if (hit?.animal.alive === true) {
              const dmg = Math.round(this.thrown.profile.damage * (hit.headshot ? this.thrown.profile.headMultiplier : 1) * (this.damageMultiplier?.(hit) ?? 1));
              const killed = hit.animal.applyDamage(dmg, hit.point, _dir);
              if (!killed) hit.animal.stagger?.(_v2.set(_dir.x, 0, _dir.z).normalize(), this.thrown.profile.stagger);
              this.onHit?.(hit.animal.kind, hit.headshot, killed);
              this.onImpact?.('flesh', hit.point);
              this.drop(j, hit.point);
              break;
            }
          }
          if (wall) {
            _v3.set(wall.point.x, wall.point.y, wall.point.z);
            if (wall.material === 'ground') {
              const ws = this.player.waterSurfaceAt(_v3.x, _v3.z);
              if (ws !== null && ws > _v3.y) { j.state = 0; this.onImpact?.('ground', _v3); break; } // into the river: gone
            }
            if (sticksIn(wall.material)) { this.stick(j, _v3.addScaledVector(_dir, this.thrown.profile.radius), _dir, impactSurfaceOf(wall.material)); break; }
            // stone, rock, metal: it clatters off and lies on the surface
            _nrm.set(wall.normal.x, wall.normal.y, wall.normal.z);
            if (_nrm.dot(_dir) > 0) _nrm.negate();
            this.lie(j, _v3, _nrm, impactSurfaceOf(wall.material));
            break;
          }
          if (j.age > 8 || j.pos.y < -200) { j.state = 0; break; }
          j.q.setFromUnitVectors(Y, _dir);
        }
      } else if (j.state === 2) {
        j.age += dt;
        if (this.javelins < this.maxJavelins && Math.hypot(j.pos.x - p.x, j.pos.z - p.z) < this.thrown.profile.pickupRadius && Math.abs(j.pos.y - p.y) < this.thrown.profile.pickupHeight) {
          j.state = 0;
          if (gameplayRandom() < this.thrown.profile.survive) { this.javelins++; this.onPickup?.(this.javelins); this.chargeEvent('recover', this.javelins); }
        }
      }
    }
    let n = 0;
    for (const j of this.javs) {
      if (j.state === 0) continue;
      this.world.setMatrixAt(n++, _m.compose(j.pos, j.q, _s1));
    }
    if (n !== this.world.count || n > 0) { this.world.count = n; this.world.instanceMatrix.needsUpdate = true; }
  }

  /** the dotted arc a javelin thrown now would fly (world space), stopping at the first surface (the world query) */
  private drawArc(alpha: number): void {
    this.arc.visible = alpha > 0.01;
    this.arcMat.opacity = alpha * 0.85;
    if (!this.arc.visible) return;
    this.aimPose(_commandOrigin, _commandRotation);
    this.aimRay(_commandOrigin, _fwd);
    _v1.set(0.22, 0.05, -0.3).applyQuaternion(_commandRotation).add(_commandOrigin);
    _v2.set(1, 0, 0).applyQuaternion(_commandRotation);
    _dir.copy(_fwd).applyAxisAngle(_v2, 0.035).normalize().multiplyScalar(this.thrown.profile.speed);
    const P = this.arcPos;
    let hitAt = this.thrown.profile.arcPoints;
    for (let i = 0; i < this.thrown.profile.arcPoints; i++) {
      const t = 0.06 + i * 0.05; // 1.6 s of flight ≈ 40 m
      let x = _v1.x + _dir.x * t, y = _v1.y + _dir.y * t - 0.5 * this.thrown.profile.gravity * t * t, z = _v1.z + _dir.z * t;
      if (i >= hitAt) { x = P[(hitAt - 1) * 3] ?? x; y = P[(hitAt - 1) * 3 + 1] ?? y; z = P[(hitAt - 1) * 3 + 2] ?? z; }
      else if (i > 0) {
        _head.set(x, y, z);
        const wall = worldHit(_arcPrev.set(P[(i - 1) * 3] ?? x, P[(i - 1) * 3 + 1] ?? y, P[(i - 1) * 3 + 2] ?? z), _head, 0);
        if (wall) { hitAt = i; x = wall.point.x; y = wall.point.y + 0.05; z = wall.point.z; }
      }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    this.arcAttr.needsUpdate = true;
  }

  // ── couched lance contact: anything closing on the point ──
  private contacts(dt: number, t: number): void {
    const p = this.player.position; this.aimPose(_commandOrigin, _commandRotation);
    const heading = this.mount !== null ? this.mount.yaw : this.player.yaw;
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    for (const a of app.aimTargets) {
      let prev = this.prevPos.get(a);
      if (prev === undefined) { prev = a.position.clone(); this.prevPos.set(a, prev); continue; }
      const vx = (a.position.x - prev.x) / Math.max(dt, 1e-3), vz = (a.position.z - prev.z) / Math.max(dt, 1e-3);
      prev.copy(a.position);
      if (!a.alive || a.hidden === true) continue;
      const dx = a.position.x - p.x, dz = a.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.01) continue;
      const edge = d - targetRadius(a);
      const reach = this.profile.lance.reach;
      if (edge > reach || Math.abs(a.position.y - p.y) > 2) continue;
      const ang = Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1));
      if (ang > this.profile.lance.cone) continue;
      const closing = -(vx * dx + vz * dz) / d;               // its speed toward you
      const speed = (this.mount?.speed ?? 0) + Math.max(0, closing);
      if (speed < this.profile.lance.minSpeed) continue;
      const last = this.rehit.get(a) ?? -1e9;
      if (t - last < this.profile.lance.rehit) continue;
      // confirm through the real hit volumes (Targets): a ray from the eye to its body
      _v1.set(a.position.x, a.position.y + (a.dims?.bodyY ?? 0.6) * (a.scale ?? 1), a.position.z);
      _dir.subVectors(_v1, _commandOrigin); const len = _dir.length(); _dir.multiplyScalar(1 / Math.max(len, 1e-4));
      const hit = this.targets?.raycast(_commandOrigin, _dir, len + 1) ?? null;
      if (hit === null || !this.same(hit.animal, a)) continue;
      const dmg = Math.round(this.profile.lance.baseDamage + this.profile.lance.speedDamage * speed);
      const result = this.contact(hit.animal, dmg, hit.point, _dir, _commandOrigin, 'move.lance');
      if (!result) continue;
      this.rehit.set(a, t);
      const killed = result.killed;
      if (!killed) hit.animal.stagger?.(_v2.set(dx, 0, dz).normalize(), 1);
      this.jolt = 1.4;
      this.onHit?.(hit.animal.kind, false, killed);
      this.onImpact?.('flesh', hit.point);
    }
  }
  private same(a: TargetAnimal, b: AimTarget): boolean { return a.position === b.position; }

  private thrustHit(): void {
    if (this.targets === undefined) return;
    this.aimPose(_commandOrigin, _commandRotation);
    this.aimRay(_commandOrigin, _fwd);
    _e.set(0, 0, 0, 'YXZ');
    for (const pitch of this.profile.thrust.fan.pitches) for (const yaw of this.profile.thrust.fan.yaws) {
      _e.y = yaw; _e.x = pitch;
      _q.setFromEuler(_e); _q.premultiply(_commandRotation);
      _dir.set(0, 0, -1).applyQuaternion(_q);
      const hit = this.targets.raycast(_commandOrigin, _dir, this.profile.reach);
      if (!hit || !hit.animal.alive) continue;
      const result = this.contact(hit.animal, this.profile.thrust.damage, hit.point, _fwd, _commandOrigin, 'move.thrust');
      if (!result) continue;
      const killed = result.killed;
      if (!killed) hit.animal.stagger?.(_v2.set(_fwd.x, 0, _fwd.z).normalize(), this.profile.thrust.stagger);
      this.hitDone = true; this.jolt = 1;
      this.onHit?.(hit.animal.kind, false, killed);
      this.onImpact?.('flesh', hit.point);
      return;
    }
  }

  // ── per frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    const inHand = this.model.visible;
    if (!inHand || !this.enabled) {
      // holstered / paused: drop every held state
      this.rmbDown = false;
      if (this.windT >= 0 && !inHand) { this.windT = -1; this.releaseQueued = false; }
      if (!inHand) { this.thrustT = -1; this.queued = false; }
    }
    if (inHand !== this.inHand) { this.inHand = inHand; if (!inHand) { p.moveScale = 1; p.swinging = false; } }

    if (inHand) {
      // FOV (Hor+ on portrait) + the dodge kick
      const baseFov = fovForAspect(this.profile.feel.fovHip, cam.aspect);
      const target = baseFov + p.fovKick;
      if (Math.abs(target - this.fov) > 0.01) {
        const refit = Math.abs(baseFov - this.baseFov) > 0.01; this.baseFov = baseFov;
        this.fov = target; cam.fov = target; cam.updateProjectionMatrix();
        if (refit) this.sky.csm.updateFrustums();
      }
    }

    // ── inputs: quick RMB tap throws; the THROW disc edges wind / throw ──
    if (this.rmbDown) this.rmbT += dt;
    p.moveScale = 1;

    const throwHeld = this.adsHeld && this.enabled && inHand;
    if (throwHeld && !this.throwPrev) this.beginWind();
    if (!throwHeld && this.throwPrev && this.windT >= 0) this.releaseQueued = true;
    this.throwPrev = throwHeld;
    if (this.windT >= 0) {
      this.windT += dt;
      if (this.releaseQueued && this.windT >= this.thrown.profile.windup) { this.windT = -1; this.releaseQueued = false; this.throwT = 0; this.threw = false; }
    }
    if (this.throwT >= 0) {
      this.throwT += dt;
      if (!this.threw && this.throwT >= this.thrown.profile.release * 0.5) { this.threw = true; this.launch(); }
      if (this.throwT >= this.thrown.profile.release + this.thrown.profile.recovery) this.throwT = -1;
    }

    // ── thrust clock ──
    if (this.thrustT >= 0) {
      this.thrustT += dt;
      if (!this.hitDone && this.thrustT >= this.profile.thrust.windup && this.thrustT <= this.profile.thrust.activeEnd) this.thrustHit();
      if (this.thrustT >= this.profile.thrust.total) { this.thrustT = -1; if (this.queued) { this.queued = false; this.tryFire(); } }
    }
    if (inHand) p.swinging = this.thrustT >= 0;

    // ── contacts: the couched lance (mounted, canter+) ──
    const lance = this.mount !== null && this.mount.speed >= this.profile.lance.minSpeed && this.windT < 0 && this.throwT < 0;
    if (inHand && lance) this.contacts(dt, t);
    else if (this.prevPos.size > 0) this.prevPos.clear();

    this.flyJavelins(dt);
    this.state.bolts = this.javelins; this.state.loaded = this.javelins > 0; this.state.ads = this.windT >= 0;

    // ── pose ──
    this.jolt *= Math.exp(-dt * 14);
    const throwing = this.windT >= 0 || this.throwT >= 0;
    this.throwBlend += ((throwing ? 1 : 0) - this.throwBlend) * (1 - Math.exp(-dt * (throwing ? 16 : 8)));
    this.lanceBlend += ((lance ? 1 : 0) - this.lanceBlend) * (1 - Math.exp(-dt * 6));
    this.sprintBlend += ((p.sprinting && this.thrustT < 0 && !throwing ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);

    // look lag (spring, substepped)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lookState.yaw = this.lagYaw; this.lookState.pitch = this.lagPitch;
    this.lookState.yawVelocity = this.lagYawVel; this.lookState.pitchVelocity = this.lagPitchVel;
    this.lookBlock.step(this.lookState, this.lookDelta.set(dYaw, dPitch), dt);
    this.lagYaw = this.lookState.yaw; this.lagPitch = this.lookState.pitch;
    this.lagYawVel = this.lookState.yawVelocity; this.lagPitchVel = this.lookState.pitchVelocity;

    // the spear: rest → thrust (cock, jab, recover) → lance / left-low while throwing
    const sp = _v1, sq = _q, { rest: REST, cock: COCK, jab: JAB, leftLow: LEFT_LOW, sprint: SPRINT, lance: LANCE, javCock: JAV_COCK, javOut: JAV_OUT } = this.view.poses;
    sp.copy(REST.pos); sq.copy(REST.q);
    if (this.thrustT >= 0) {
      const tt = this.thrustT;
      if (tt < this.profile.thrust.windup) { const f = sstep(0, 1, tt / this.profile.thrust.windup); sp.lerp(COCK.pos, f); sq.slerp(COCK.q, f); }
      else if (tt < this.profile.thrust.activeEnd) { const f = 1 - (1 - (tt - this.profile.thrust.windup) / (this.profile.thrust.activeEnd - this.profile.thrust.windup)) ** 3; sp.copy(COCK.pos).lerp(JAB.pos, f); sq.copy(COCK.q).slerp(JAB.q, f); }
      else { const f = sstep(0, 1, (tt - this.profile.thrust.activeEnd) / (this.profile.thrust.total - this.profile.thrust.activeEnd)); sp.copy(JAB.pos).lerp(REST.pos, f); sq.copy(JAB.q).slerp(REST.q, f); }
    }
    const lb = sstep(0, 1, this.lanceBlend), tb = sstep(0, 1, this.throwBlend), sb = this.sprintBlend;
    if (lb > 0) { sp.lerp(LANCE.pos, lb); sq.slerp(LANCE.q, lb); }
    if (sb > 0) { sp.lerp(SPRINT.pos, sb); sq.slerp(SPRINT.q, sb); }
    // the right hand: on the shaft (the spear's own grip transform) unless throwing
    const hp = _v2.copy(sp), hq = _q2.copy(sq);
    if (tb > 0) {
      // the spear goes to the left hand, low left; the right hand brings a javelin up by the ear, then snaps it forward
      sp.lerp(_v3.copy(LEFT_LOW.pos), tb); sq.slerp(LEFT_LOW.q, tb);
      let jp = JAV_COCK.pos, jq = JAV_COCK.q;
      let wind = 1;
      if (this.windT >= 0) wind = sstep(0, 1, this.windT / this.thrown.profile.windup);
      if (this.throwT >= 0) {
        const f = this.throwT < this.thrown.profile.release ? 1 - (1 - this.throwT / this.thrown.profile.release) ** 2 : 1;
        jp = _vThrow.copy(JAV_COCK.pos).lerp(JAV_OUT.pos, f); jq = _qThrow.copy(JAV_COCK.q).slerp(JAV_OUT.q, f);
      }
      _vCock.copy(REST.pos).lerp(jp, wind); _qCock.copy(REST.q).slerp(jq, wind);
      if (this.windT >= 0) { _vCock.x += Math.sin(t * 31) * 0.002 * wind; _vCock.z += 0.02 * wind * sstep(0.6, 1, this.windT / this.thrown.profile.windup); } // drawn back taut
      hp.lerp(_vCock, tb); hq.slerp(_qCock, tb);
    }
    this.heldJav.visible = (this.windT >= 0 || (this.throwT >= 0 && !this.threw)) && this.javelins > 0;

    // sway / bob / look lag / jolt, the portrait layout, the holster drop — applied to both rigs alike
    const sf = p.speedFactor, m = 1;
    const swX = Math.sin(t * this.profile.feel.sway.fx) * this.profile.feel.sway.ax, swY = Math.sin(t * this.profile.feel.sway.fy) * this.profile.feel.sway.ay;
    const bobX = Math.cos(p.bobTime) * this.profile.feel.bob.x * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * this.profile.feel.bob.y * sf;
    _e.set((Math.sin(p.bobTime * 2) * this.profile.feel.bob.rx * sf + this.lagPitch + this.jolt * 0.05) * m, this.lagYaw * m, (Math.sin(t * 0.5) * 0.006 + Math.cos(p.bobTime) * this.profile.feel.bob.rz * sf) * m, 'YXZ');
    _qSway.setFromEuler(_e);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const scale = 1 - portrait * 0.15;
    const h = this.holster > 0 ? sstep(0, 1, this.holster) : 0;
    if (h > 0) _qHol.setFromEuler(_e.set(-h * 0.6, 0, h * 0.3, 'YXZ'));
    for (const [pos, q, rig] of [[sp, sq, this.spearRig], [hp, hq, this.handRig]] as [THREE.Vector3, THREE.Quaternion, THREE.Group][]) {
      pos.x += (swX + bobX + this.lagYaw * this.profile.feel.lag.posYaw) * m; pos.y += (swY + bobY + this.lagPitch * this.profile.feel.lag.posPitch) * m; pos.z += this.jolt * 0.04;
      q.premultiply(_qSway);
      pos.x *= 1 - portrait * 0.3; pos.y *= 1 + portrait * 0.08; pos.z *= 1 + portrait * 0.25;
      if (h > 0) { pos.y -= h * 0.5; pos.z += h * 0.1; q.premultiply(_qHol); }
      if (this.inspect) { pos.set(0.05, -0.1, -1.1); q.setFromEuler(_e.set(0.3, Math.sin(t * 0.3) * 0.6, 1.3, 'YXZ')); }
      rig.position.copy(pos); rig.quaternion.copy(q); rig.scale.setScalar(scale);
    }
    // the sleeves: from each wrist (on its rig) back to its elbow, fixed off the bottom corners of the frame
    for (const [rig, wrist, elbow, arm] of [[this.spearRig, this.leftWrist, this.view.elbows.left, this.leftArm], [this.handRig, this.rightWrist, this.view.elbows.right, this.rightArm]] as [THREE.Group, THREE.Vector3, THREE.Vector3, THREE.Mesh][]) {
      rig.updateMatrix();
      _vArm.copy(wrist).applyMatrix4(rig.matrix);
      _vEl.set(elbow.x * (1 - portrait * 0.3), elbow.y - h * 0.5, elbow.z);
      placeArm(arm, _vArm, _vEl.sub(_vArm));
      arm.scale.setScalar(scale);
    }

    // the dotted throw arc while winding up
    const arcAlpha = this.showArc && inHand && this.windT >= this.thrown.profile.arcAfter ? sstep(this.thrown.profile.arcAfter, this.thrown.profile.windup, this.windT) : 0;
    this.drawArc(arcAlpha);

    // aim readout (HUD "WOLF · 15 M")
    if (this.targets && inHand && (++this.aimFrame & 3) === 0) {
      this.aimRay(_commandOrigin, _fwd);
      const hit = this.targets.raycast(_commandOrigin, _fwd, 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }
  }

  /** dev: the running clock */
  get clock(): number { return this.time; }
}

const finite = schema.pipe(schema.number(), schema.finite()), triple = schema.tuple([finite, finite, finite]);
const cue = schema.custom<`cue.${string}`>(value => typeof value === 'string' && /^cue\.[a-z][a-zA-Z0-9.-]*$/u.test(value));
const pose = schema.strictObject({ pos: triple, q: schema.tuple([finite, finite, finite, finite]) });
const SpearRows = schema.strictObject({ pool: schema.strictObject({ url: schema.string(), parts: schema.array(schema.string()) }),
  profile: schema.strictObject({ damage: finite, reach: finite,
    thrust: schema.strictObject({ damage: finite, stagger: finite, windup: finite, activeEnd: finite, total: finite,
      fan: schema.strictObject({ yaws: schema.array(finite), pitches: schema.array(finite) }) }),
    lance: schema.strictObject({ reach: finite, cone: finite, minSpeed: finite, baseDamage: finite, speedDamage: finite, rehit: finite }),
    hitStop: schema.strictObject({ body: finite, head: finite, kill: finite }),
    cues: schema.strictObject({ fire: cue, reload: cue, impact: cue, hit: cue,
      charge: schema.strictObject({ throw: cue, recover: cue }) }),
    feel: schema.strictObject({ lag: schema.strictObject({ gain: finite, clampYaw: finite, clampPitch: finite, k: finite, c: finite, posYaw: finite, posPitch: finite }),
      bob: schema.strictObject({ x: finite, y: finite, rx: finite, rz: finite }), sway: schema.strictObject({ ax: finite, fx: finite, ay: finite, fy: finite }), fovHip: finite }) }),
  view: schema.strictObject({ poses: schema.strictObject({ rest: pose, cock: pose, jab: pose, leftLow: pose, sprint: pose, lance: pose, javCock: pose, javOut: pose }),
    elbows: schema.strictObject({ left: triple, right: triple }), wrists: schema.strictObject({ left: triple, right: triple }), javelinGrip: finite, tapMax: finite }) });
let prepared: { parts: ReturnType<typeof createModelLibrary<never, never>>; profile: JavelinSpearProfile; javelin: ThrownProfile; view: JavelinSpearView } | null = null;
function spearRows(): NonNullable<typeof prepared> { if (prepared === null) throw new Error('Spear rows are not prepared'); return prepared; }
const spearPose = (row: schema.InferOutput<typeof pose>): JavelinSpearPose => ({ pos: new THREE.Vector3(...row.pos), q: new THREE.Quaternion(...row.q) });
/** Admit the named spear rows and geometry before constructing held or Explorer weapons. */
export async function prepareSpear(product: Pick<ShardProduct, 'file' | 'shardfile'>): Promise<void> {
  const rows = schema.parse(SpearRows, JSON.parse(new TextDecoder().decode(await product.file('weapons/spear.json'))));
  const item = product.shardfile.items.rows.find(row => row.id === 'weapon.spear');
  const { family: _family, ...javelin } = schema.parse(ThrownWeaponProfileSchema, item?.kind === 'weapon' ? item.profile : undefined);
  const parts = createModelLibrary<never, never>({ meshes: [], hd: [], meshUrls: {}, hdUrls: {}, hdLooks: {}, aoFloor: 1, geometryPools: [rows.pool] }, 'nalati-spear');
  await parts.preload();
  const p = rows.view.poses;
  prepared = { parts, profile: { ...SWORD_WOOD, ...readItemEquipment(product.shardfile.items, 'weapon.spear'), parent: SWORD_WOOD.id, ...rows.profile },
    javelin: { id: 'weapon.javelin', ...javelin }, view: { ...rows.view,
      poses: { rest: spearPose(p.rest), cock: spearPose(p.cock), jab: spearPose(p.jab), leftLow: spearPose(p.leftLow), sprint: spearPose(p.sprint), lance: spearPose(p.lance), javCock: spearPose(p.javCock), javOut: spearPose(p.javOut) },
      wrists: { left: new THREE.Vector3(...rows.view.wrists.left), right: new THREE.Vector3(...rows.view.wrists.right) },
      elbows: { left: new THREE.Vector3(...rows.view.elbows.left), right: new THREE.Vector3(...rows.view.elbows.right) } } };
}
/** Independent mutable geometry keeps skins and Explorer specimens isolated. */
export function spearGeometry(name: string): THREE.BufferGeometry {
  const geometry = spearRows().parts.geometry(name); if (geometry === null) throw new Error(`Missing baked spear part ${name}`); return geometry;
}
export const buildSpear = (): JavelinSpearDraws => ({ paint: spearGeometry('spear-paint'), metal: spearGeometry('spear-metal') });
export const buildJavelin = (): JavelinSpearDraws => ({ paint: spearGeometry('javelin-paint'), metal: spearGeometry('javelin-metal') });
export const spearProfile = (): JavelinSpearProfile => spearRows().profile;
/** The original spear slot, with its admitted profile, javelin policy and baked rig. */
export class Spear extends JavelinSpear {
  constructor(world: JavelinSpearWorld, targets?: Targets, opts: { allowUnlocked?: boolean; profile?: JavelinSpearProfile } = {}) {
    const row = spearRows();
    super(world, targets, { profile: opts.profile ?? row.profile, javelin: row.javelin, view: row.view, allowUnlocked: opts.allowUnlocked ?? false });
  }
}
export type SpearWeapon = JavelinSpear;

