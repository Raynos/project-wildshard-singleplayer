import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { NativeRidingSchema } from '@wildshard/format/nativeRiding';
import { nativeHerdCollection } from '../shardfile/groupRuntime';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { unzlibSync } from 'fflate';
import { MountedBody, mountedMotorOptions, type MountedRider, type MountedWorld, type ReinsFrame } from '@wildshard/game/riding/physics';
import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost, SimPlayerDriver, SimPlayerMotionSample, SimValue } from '@wildshard/engine/sim';
import { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { AnimalPoseLaw } from '@wildshard/engine/entities/animalPose';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { tagOf } from '@wildshard/engine/physics/surface';
import { withOwner } from '@wildshard/engine/app/ownership';
import { walkingSpeed } from '@wildshard/engine/player/walk';

const num = v.pipe(v.number(), v.finite()), triple = v.tuple([num, num, num]);
const handle = v.nullable(v.pipe(num, v.minValue(0)));
const MotorState = v.strictObject({ version: v.literal(1), colliderHandle: v.pipe(num, v.minValue(0)),
  filter: v.pipe(num, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), ghost: v.string(), enabled: v.boolean(), yaw: num,
  anchor: v.strictObject({ x: num, y: num, z: num }), anchorBodyHandle: handle,
  climbAngle: num, slideAngle: num, result: v.strictObject({ grounded: v.boolean(), groundNormalY: num,
    downhillX: num, downhillZ: num, horizontalFreedom: num, groundColliderHandle: handle }) });
const Saved = v.strictObject({ version: v.literal(1), horse: v.nullable(v.string()), body: v.unknown(), motor: v.nullable(MotorState),
  decisionClock: num, walkingSpeed: num, rider: v.strictObject({ velocity: triple, onGround: v.boolean(), sprinting: v.boolean(), crouching: v.boolean(), speedFactor: num }),
  poses: v.pipe(v.array(v.tuple([v.string(), v.string()])), v.maxLength(64)) });

/** Trusted physical rider, not a presentation/taming stand-in. Mountable identities come from the page's actual camp roster. */
export interface NativeMountedPlayer {
  readonly body: MountedBody; readonly rider: MountedRider;
  readonly mounted: boolean; readonly horse: AnimalSim | null;
  readonly mount: (id: string, breaking?: boolean) => boolean;
  /** Only the taming owner may register/retire an actually adopted horse. */
  readonly addMountable: (id: string) => void; readonly removeMountable: (id: string) => void; readonly dismount: (thrown?: boolean) => void;
  /** Actual registration order, for the page's strict nearest ride-action selector. */
  readonly mountables: readonly AnimalSim[];
  readonly phase: (id: string) => number;
}
const installed = new WeakMap<SimHost, NativeMountedPlayer>();
/** Read this host's owned riding law; no page/global singleton. */
export function mountedPlayerOf(host: SimHost): NativeMountedPlayer | undefined { return installed.get(host); }

/** The page's native reins/body and gait phase under the host's single physics authority. The ordinary player driver
 * remains authoritative on foot. Companions, taming and the weapons are subsequent installs, never simulated here. */
export function installMountedPlayer(host: SimHost, profile: unknown): NativeMountedPlayer {
  const rows = v.parse(NativeRidingSchema, profile), { herds } = nativeHerdCollection(host, rows.herds);
  const mask = (encoded: string): ((x: number, z: number) => number) => {
    const bytes = unzlibSync(Uint8Array.from(atob(encoded), value => value.codePointAt(0) ?? 0));
    if (bytes.byteLength !== rows.world.res * rows.world.res * 4) throw new Error('Invalid riding terrain channel');
    const values = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    if (values.some(value => !Number.isFinite(value))) throw new Error('Invalid riding terrain sample');
    return bakedSamplers({ res: rows.world.res, size: rows.world.size, seed: 0, landscapeHash: 0, heights: values, splat: new Uint8Array(0), undergrowth: null }).heightAt;
  };
  const wet = mask(rows.world.wet), pond = mask(rows.world.pond);
  const heightAt = (x: number, z: number): number => host.groundHeightAt(x, z);
  const waterLevel = (): number => rows.world.water;
  const surfaceAt = (x: number, z: number): number | null => pond(x, z) > 0 ? rows.world.water : null;
  const wetAt = (x: number, z: number): boolean => wet(x, z) > .5;
  const inBounds = (x: number, z: number, margin: number): boolean => Math.abs(x) < rows.world.size / 2 - margin && Math.abs(z) < rows.world.size / 2 - margin;
  if (installed.has(host)) throw new Error('Native mounted player already installed');
  host.modes.register({ id: 'ride', hud: 'ride' }, host.scope);
  const rules = ReturnProgram.native(host, rows.program);
  const body = new MountedBody(rows.speeds), rider: MountedRider = { position: host.player.position, velocity: new Vector3(),
    onGround: true, sprinting: false, crouching: false, speedFactor: 1 };
  let decisionClock = 0;
  const walking = { speed: host.level.player.speed, crouching: false }, previousFoot = new Vector3();
  let horse: AnimalSim | null = null, savedMotor: v.InferOutput<typeof MotorState> | null = null;
  const poses = new Map<string, AnimalPoseLaw>();
  const horses = [...host.entities.values()].filter(actor => rows.kinds.includes(actor.kind));
  if (horses.length > 64 || herds.length > 64) throw new Error('Native mounted roster exceeds its bound');
  for (let i = 0; i < Math.min(64, horses.length); i++) {
    const actor = horses[i]; if (actor === undefined) throw new Error('Missing mounted roster actor');
    poses.set(actor.entityId, new AnimalPoseLaw({ dims: actor.dims, custom: true,
      ...rows.pose }));
  }
  const byHerd = new Map<AnimalSim, (typeof herds)[number]>();
  for (let i = 0; i < Math.min(64, herds.length); i++) {
    const h = herds[i]; if (h === undefined || h.members.length > 256) throw new Error('Invalid mounted herd');
    for (let j = 0; j < Math.min(256, h.members.length); j++) {
      const a = h.members[j]; if (a === undefined) throw new Error('Missing mounted herd member'); byHerd.set(a, h);
    }
  }
  const herd = (a: AnimalSim) => byHerd.get(a) ?? null;
  const phase = (id: string): number => { const pose = poses.get(id); if (pose === undefined) throw new Error('Missing mounted horse phase'); return pose.phase; };
  const available = new Set(rows.mountable);
  if (rows.mountable.length > 64 || available.size !== rows.mountable.length) throw new Error('Invalid Native mountable roster');
  for (let i = 0; i < Math.min(64, rows.mountable.length); i++) {
    const id = rows.mountable[i]; if (id === undefined || !poses.has(id)) throw new Error('Invalid Native mountable identity');
  }
  const mountables = rows.mountable.map(id => { const a = host.entities.get(id); if (a === undefined) throw new Error('Missing native mountable'); return a; });
  const poseRows = [...poses].map(([id, pose]) => ({ id, pose }));
  const dismount = (thrown = false): void => {
    const a = horse; if (a === null) return;
    a.position.copy(body.feet); a.yaw = body.heading; a.driven = false; a.levelGround = false;
    a.yOffset = Math.max(0, body.feet.y - heightAt(body.feet.x, body.feet.z));
    body.motor?.dispose(); body.motor = null;
    const site = rules.project('dismount', { x: a.position.x, z: a.position.z, yaw: a.yaw, thrown: Number(thrown) });
    let x = site['x'] ?? a.position.x, z = site['z'] ?? a.position.z;
    if (!inBounds(x, z, 3)) { x = site['altX'] ?? x; z = site['altZ'] ?? z; }
    rider.position.set(x, Math.max(heightAt(x, z), body.onDeck ? body.feet.y : -Infinity), z);
    rider.velocity.set(0, 0, 0); rider.onGround = true; rider.speedFactor = 1;
    host.player.motor.setEnabled(true); host.playerFall.grounded = true; host.playerFall.vy = 0;
    horse = null; body.breaking = false; host.modes.exit('ride');
    const h = herd(a); if (h?.ridden === a) h.setRidden(null); else a.mem['ridden'] = 0;
    a.setMotion(a.yaw, 0, 2); a.mem['rear'] = 0; a.mem['buck'] = 0; a.mem['turnLead'] = 0;
    body.gait = 'stand';
  };
  const world: MountedWorld = { get physics() { return host.physics; }, heightAt, waterLevel,
    wetAt, stampede: owner => {
      if (!(owner instanceof AnimalSim) || owner === horse) return null;
      const h = herd(owner);
      return h !== null && (h.stampeding || (owner === h.stallion && h.stallionState === 'charge')) ? owner : null;
    }, thrown: () => {
      dismount(true);
      host.combat.hit({ source: 'env', sourceTags: [], target: host.player.health, amount: rows.thrownDamage, point: host.player.position,
        dir: rider.velocity, cause: { kind: 'env.ride', label: rows.thrownLabel, text: rows.thrownLabel } });
    } };
  const frame: { -readonly [K in keyof ReinsFrame]: ReinsFrame[K] } = {
    forward: 0, turn: 0, touchX: 0, touchY: 0, gallop: false, jump: false, drawing: false, moveScale: 1,
    phase: 0, feet: body.feet, roads: rows.roads, inBounds, refuses: () => false, wet: false };
  const motion = { velocityX: 0, velocityZ: 0, grounded: true, swimming: false, hover: false };
  const sampleMotion = (): SimPlayerMotionSample => {
    // MountedBody owns carrier velocity; neither corrected feet displacement nor the on-foot approximation supplies it.
    motion.velocityX = rider.velocity.x; motion.velocityZ = rider.velocity.z; motion.grounded = rider.onGround;
    return motion;
  };
  const driver: SimPlayerDriver = { walking, motionSample: sampleMotion, input: (command, dt) => {
    if (horse?.alive === false) dismount(true);
    previousFoot.copy(host.player.position);
    const a = horse;
    if (a === null) {
      const versioned = command?.commandVersion === 1;
      const board = command?.hover === true ? !host.playerBoard.on : host.playerBoard.on;
      const surface = surfaceAt(rider.position.x, rider.position.z);
      const depth = surface === null ? 0 : Math.max(0, surface - rider.position.y);
      const forward = command === undefined ? 0 : -Math.sin(command.yaw) * command.moveX - Math.cos(command.yaw) * command.moveZ;
      decisionClock += dt;
      if (decisionClock + 1e-9 >= .1) {
        decisionClock = 0;
        const row = rules.project('walk', { version: Number(versioned), board: Number(board), swim: Number(host.playerSwim.on), depth, forward, crouched: Number(command?.crouch === true), sprint: Number(command?.sprint === true), grounded: Number(host.playerFall.grounded) });
        rider.crouching = row['crouched'] === 1; rider.sprinting = row['sprinting'] === 1;
        walking.speed = versioned ? walkingSpeed(rider.crouching, rider.sprinting, row['wade'] ?? 0, 1, 1) : host.level.player.speed;
        walking.crouching = rider.crouching;
      }
      return false;
    }
    if (command !== undefined && (command.commandVersion !== 1 || command.steer === undefined)) throw new Error('Mounted reins require versioned raw local controls');
    if (command !== undefined) host.player.yaw = command.yaw;
    host.playerImpulse.set(0, 0, 0); rider.crouching = false;
    frame.forward = command?.steer?.keyY ?? 0; frame.turn = command?.steer?.keyX ?? 0;
    frame.touchX = command?.steer?.stickX ?? 0; frame.touchY = command?.steer?.stickY ?? 0;
    frame.gallop = command?.sprint === true; frame.jump = command?.jump === true; frame.phase = phase(a.entityId);
    frame.wet = wetAt(body.feet.x, body.feet.z) || heightAt(body.feet.x, body.feet.z) < waterLevel() - 0.2;
    body.read(dt, frame); a.mem['turnLead'] = body.turnLead; a.lookWeight = 0;
    return true;
  }, step: dt => {
    const a = horse; if (a === null) return;
    body.stepBody(dt, a, rider, world);
    if (horse !== null) body.placeRider(dt, 1, a, rider, world);
  } };
  host.usePlayerDriver(driver);
  const mount = (id: string, breaking = false): boolean => {
    const a = host.entities.get(id);
    const allowed = rules.project('mount', { mounted: Number(horse !== null), present: Number(a !== undefined), alive: Number(a?.alive === true), driven: Number(a?.driven === true), available: Number(available.has(id)), breaking: Number(breaking), stallion: Number(herds.some(h => h.stallion === a)) });
    if (allowed['accept'] !== 1 || a === undefined) return false;
    host.setBoard(false); horse = a;
    const h = herd(a); if (h !== null) h.setRidden(a); else a.mem['ridden'] = 1;
    a.setMotion(a.yaw, 0, 2); body.heading = a.yaw; body.speed = 0; body.wUp = 0; body.yawRate = 0;
    body.breaking = breaking;
    body.target = 0; body.rateIn = 0; body.turnIn = 0; body.sector = 2; body.jumpQueued = false;
    a.driven = true; a.yOffset = 0; body.feet.copy(a.position);
    body.jostles = 0; body.shoveX = body.shoveZ = 0; body.jolt = 0;
    body.cruise = 0; body.gallopWas = false; body.sectorWas = 2; body.skidT = 0; body.panicT = 0; body.panicRear = 0; body.onRoad = false;
    body.spur.reset(); body.spur.good = 0; body.lastPhase = phase(id);
    body.motor = withOwner(null, () => new CharacterMotor(host.physics, mountedMotorOptions(a.scale, a)));
    body.settleBody(); body.landBody(world); body.eyeY = body.feet.y;
    host.player.motor.setEnabled(false);
    host.modes.enter('ride', driver);
    return true;
  };
  const missingPose = new Error('Missing mounted pose actor');
  host.onStep(rows.step, dt => {
    if (horse === null) {
      rider.velocity.set((rider.position.x - previousFoot.x) / dt, host.playerFall.vy, (rider.position.z - previousFoot.z) / dt);
      rider.onGround = host.playerFall.grounded;
    }
    for (let i = 0; i < Math.min(64, poseRows.length); i++) {
      const row = poseRows[i]; if (row === undefined) throw missingPose;
      const { id, pose } = row;
      const a = host.entities.get(id); if (a === undefined) throw missingPose;
      const bodyDt = host.bodyDt(id); if (bodyDt <= 0) continue;
      const input = pose.input;
      a.samplePose(input); input.speed = a.speed; input.strafe = a.strafe; input.scale = a.scale; input.seed = a.seed;
      input.state = a.state; input.alive = a.alive; input.position = a.position; input.lookTarget = a.lookTarget;
      input.yaw = a.yaw; input.lookWeight = a.lookWeight; input.levelGround = a.levelGround;
      input.flying = a.flying; input.advanceAttack = false; input.desiredSpeed = a.desiredSpeed;
      pose.advance(bodyDt, host.clock.now, false);
    }
  }, {
    snapshot: (): SimValue => {
      const state = body.snapshotBody(), motor = body.motor?.snapshot();
      return { version: 1, decisionClock, walkingSpeed: walking.speed, horse: horse?.entityId ?? null, body: { ...state, reins: { ...state.reins, spur: { ...state.reins.spur } } },
        motor: motor === undefined ? null : { ...motor, anchor: { ...motor.anchor }, result: { ...motor.result } },
        rider: { velocity: rider.velocity.toArray(), onGround: rider.onGround, sprinting: rider.sprinting,
          crouching: rider.crouching, speedFactor: rider.speedFactor }, poses: [...poses].map(([id, pose]) => [id, pose.snapshot()]) };
    }, restore: value => {
      const state = v.parse(Saved, value), checked = new MountedBody(rows.speeds); checked.restoreBody(state.body);
      const a = state.horse === null ? null : host.entities.get(state.horse);
      if (a === undefined || (state.horse === null) !== (state.motor === null) || (a !== null && ((!available.has(a.entityId) && !(checked.breaking && herds.some(h => h.stallion === a))) || !a.driven))
        || state.poses.length !== poses.size || new Set(state.poses.map(([id]) => id)).size !== poses.size) throw new Error('Invalid mounted continuation identity');
      // Validate all pose wires before mutating the installed law.
      for (let i = 0; i < Math.min(64, state.poses.length); i++) {
        const row = state.poses[i]; if (row === undefined) throw new Error('Missing saved mounted pose');
        const [id, wire] = row;
        const known = poses.get(id); if (known === undefined) throw new Error('Invalid mounted pose identity');
        new AnimalPoseLaw(known.recipe).restore(wire);
      }
      body.restoreBody(state.body); decisionClock = state.decisionClock; walking.speed = state.walkingSpeed; walking.crouching = state.rider.crouching; horse = a; savedMotor = state.motor;
      rider.velocity.fromArray(state.rider.velocity); rider.onGround = state.rider.onGround; rider.sprinting = state.rider.sprinting;
      rider.crouching = state.rider.crouching; rider.speedFactor = state.rider.speedFactor;
      for (let i = 0; i < Math.min(64, state.poses.length); i++) {
        const row = state.poses[i]; if (row === undefined) throw new Error('Missing saved mounted pose');
        poses.get(row[0])?.restore(row[1]);
      }

      if (a === null) host.modes.exit('ride'); else host.modes.enter('ride', driver);
    }, physicsRestored: () => {
      if (horse === null || savedMotor === null) return;
      const native = host.physics.world, state = savedMotor;
      if (!native.colliders.contains(state.colliderHandle)) throw new Error('Missing mounted native collider');
      const c = native.getCollider(state.colliderHandle), opts = mountedMotorOptions(horse.scale, horse);
      const half = (opts.length ?? 0) / 2 - opts.radius;
      if (tagOf(c)?.owner !== horse || c.shapeType() !== host.physics.R.ShapeType.Capsule
        || Math.abs(c.halfHeight() - half) > 1e-6 || Math.abs(c.radius() - opts.radius) > 1e-6) throw new Error('Invalid mounted native capsule identity');
      body.motor = withOwner(null, () => new CharacterMotor(host.physics, opts, state)); savedMotor = null;
    },
  }, 'afterBodies');
  // The current motor changes after native restore. Capture the slot, not an expired wrapper/world.
  host.scope.onDispose(() => { body.motor?.dispose(); body.motor = null; poses.clear(); installed.delete(host); });
  const addMountable = (id: string): void => {
    const a = host.entities.get(id); if (a === undefined) throw new Error('Missing adopted mount');
    if (host.entities.get(a.entityId) !== a || a.kind !== rows.adopted.kind || a.variant !== rows.adopted.variant || available.has(a.entityId)
      || poses.size >= 64) throw new Error('Foreign Native adopted mount');
    const pose = new AnimalPoseLaw({ dims: a.dims, custom: true,
      ...rows.pose });
    a.mem['owned'] = 1; poses.set(a.entityId, pose); poseRows.push({ id: a.entityId, pose }); available.add(a.entityId); mountables.push(a);
  };
  const removeMountable = (id: string): void => {
    const a = host.entities.get(id); if (a === undefined) throw new Error('Missing adopted mount');
    if (host.entities.get(a.entityId) !== a || a === horse || a.kind !== rows.adopted.kind || a.variant !== rows.adopted.variant
      || !available.delete(a.entityId)) throw new Error('Foreign Native mount removal');
    const registered = mountables.indexOf(a); if (registered === -1) throw new Error('Missing adopted mount'); mountables.splice(registered, 1);
    poses.delete(a.entityId); const at = poseRows.findIndex(row => row.id === a.entityId); if (at === -1) throw new Error('Missing adopted pose');
    poseRows.splice(at, 1);
  };
  const out: NativeMountedPlayer = { body, rider, get horse() { return horse; }, get mounted() { return horse !== null; }, mount, dismount, phase, addMountable, removeMountable, mountables };
  installed.set(host, out); return out;
}
