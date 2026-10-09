import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost, SimPlayerMotionSample, SimValue } from '@wildshard/engine/sim';
import { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { AnimalPoseLaw } from '@wildshard/engine/entities/animalPose';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { tagOf } from '@wildshard/engine/physics/surface';
import { withOwner } from '@wildshard/engine/app/ownership';
import { walkingSpeed } from '@wildshard/engine/player/walk';
import type { NalatiGroups } from './groups';
import { MountedBody, mountedMotorOptions, type MountedRider, type MountedWorld } from './rideBody';
import type { ReinsFrame } from './rideReins';
import type { RoadXZ } from '../ride/rideAssist';
import { HORSE_SPEED, HORSE_SPECIES } from '../species/horse';

const num = v.pipe(v.number(), v.finite()), triple = v.tuple([num, num, num]);
const handle = v.nullable(v.pipe(num, v.minValue(0)));
const MotorState = v.strictObject({ version: v.literal(1), colliderHandle: v.pipe(num, v.minValue(0)),
  filter: v.pipe(num, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), ghost: v.string(), enabled: v.boolean(), yaw: num,
  anchor: v.strictObject({ x: num, y: num, z: num }), anchorBodyHandle: handle,
  climbAngle: num, slideAngle: num, result: v.strictObject({ grounded: v.boolean(), groundNormalY: num,
    downhillX: num, downhillZ: num, horizontalFreedom: num, groundColliderHandle: handle }) });
const Saved = v.strictObject({ version: v.literal(1), horse: v.nullable(v.string()), body: v.unknown(), motor: v.nullable(MotorState),
  rider: v.strictObject({ velocity: triple, onGround: v.boolean(), sprinting: v.boolean(), crouching: v.boolean(), speedFactor: num }),
  poses: v.pipe(v.array(v.tuple([v.string(), v.string()])), v.maxLength(64)) });

/** Trusted physical rider, not a presentation/taming stand-in. Mountable identities come from the page's actual camp roster. */
export interface NalatiMountedPlayer {
  readonly body: MountedBody; readonly rider: MountedRider;
  readonly mounted: boolean; readonly horse: AnimalSim | null;
  readonly mount: (id: string) => boolean; readonly dismount: (thrown?: boolean) => void;
  readonly phase: (id: string) => number;
}
const installed = new WeakMap<SimHost, NalatiMountedPlayer>();
/** Read this host's owned riding law; no page/global singleton. */
export function nalatiMountedOf(host: SimHost): NalatiMountedPlayer | undefined { return installed.get(host); }

/** The page's native reins/body and gait phase under the host's single physics authority. The ordinary player driver
 * remains authoritative on foot. Companions, taming and the weapons are subsequent installs, never simulated here. */
export function installNalatiMountedPlayer(host: SimHost, ports: {
  readonly groups: NalatiGroups; readonly mountable: readonly string[];
  readonly heightAt: (x: number, z: number) => number; readonly waterLevel: () => number;
  readonly wetAt: (x: number, z: number) => boolean;
  readonly inBounds: (x: number, z: number, margin: number) => boolean;
  readonly roads?: readonly (readonly RoadXZ[])[];
}): NalatiMountedPlayer {
  if (installed.has(host)) throw new Error('Nalati mounted player already installed');
  const body = new MountedBody(HORSE_SPEED), rider: MountedRider = { position: host.player.position, velocity: new Vector3(),
    onGround: true, sprinting: false, crouching: false, speedFactor: 1 };
  const walking = { speed: host.level.player.speed, crouching: false }, previousFoot = new Vector3();
  let horse: AnimalSim | null = null, savedMotor: v.InferOutput<typeof MotorState> | null = null;
  const poses = new Map<string, AnimalPoseLaw>();
  const horses = [...host.entities.values()].filter(actor => actor.kind === 'horse' || actor.kind === 'argymaq');
  if (horses.length > 64 || ports.groups.herds.length > 64) throw new Error('Nalati mounted roster exceeds its bound');
  for (let i = 0; i < Math.min(64, horses.length); i++) {
    const actor = horses[i]; if (actor === undefined) throw new Error('Missing mounted roster actor');
    poses.set(actor.entityId, new AnimalPoseLaw({ dims: actor.dims, custom: true,
      ...(HORSE_SPECIES.gait === undefined ? {} : { gait: HORSE_SPECIES.gait }),
      ...(HORSE_SPECIES.pose === undefined ? {} : { pose: HORSE_SPECIES.pose }) }));
  }
  const byHerd = new Map<AnimalSim, (typeof ports.groups.herds)[number]>();
  for (let i = 0; i < Math.min(64, ports.groups.herds.length); i++) {
    const h = ports.groups.herds[i]; if (h === undefined || h.members.length > 256) throw new Error('Invalid mounted herd');
    for (let j = 0; j < Math.min(256, h.members.length); j++) {
      const a = h.members[j]; if (a === undefined) throw new Error('Missing mounted herd member'); byHerd.set(a, h);
    }
  }
  const herd = (a: AnimalSim) => byHerd.get(a) ?? null;
  const phase = (id: string): number => { const pose = poses.get(id); if (pose === undefined) throw new Error('Missing mounted horse phase'); return pose.phase; };
  const available = new Set(ports.mountable);
  if (ports.mountable.length > 64 || available.size !== ports.mountable.length) throw new Error('Invalid Nalati mountable roster');
  for (let i = 0; i < Math.min(64, ports.mountable.length); i++) {
    const id = ports.mountable[i]; if (id === undefined || !poses.has(id)) throw new Error('Invalid Nalati mountable identity');
  }
  const poseRows = [...poses].map(([id, pose]) => ({ id, pose }));
  const dismount = (thrown = false): void => {
    const a = horse; if (a === null) return;
    a.position.copy(body.feet); a.yaw = body.heading; a.driven = false; a.levelGround = false;
    a.yOffset = Math.max(0, body.feet.y - ports.heightAt(body.feet.x, body.feet.z));
    body.motor?.dispose(); body.motor = null;
    const side = thrown ? 2.2 : 1.15;
    let x = a.position.x + Math.cos(a.yaw) * side, z = a.position.z - Math.sin(a.yaw) * side;
    if (!ports.inBounds(x, z, 3)) { x = a.position.x - Math.cos(a.yaw) * side; z = a.position.z + Math.sin(a.yaw) * side; }
    rider.position.set(x, Math.max(ports.heightAt(x, z), body.onDeck ? body.feet.y : -Infinity), z);
    rider.velocity.set(0, 0, 0); rider.onGround = true; rider.speedFactor = 1;
    host.player.motor.setEnabled(true); host.playerFall.grounded = true; host.playerFall.vy = 0;
    horse = null; body.breaking = false;
    const h = herd(a); if (h?.ridden === a) h.setRidden(null); else a.mem['ridden'] = 0;
    a.setMotion(a.yaw, 0, 2); a.mem['rear'] = 0; a.mem['buck'] = 0; a.mem['turnLead'] = 0;
    ports.groups.env.playerMounted = false; body.gait = 'stand';
  };
  const world: MountedWorld = { get physics() { return host.physics; }, heightAt: ports.heightAt, waterLevel: ports.waterLevel,
    wetAt: ports.wetAt, stampede: owner => {
      if (!(owner instanceof AnimalSim) || owner === horse) return null;
      const h = herd(owner);
      return h !== null && (h.stampeding || (owner === h.stallion && h.stallionState === 'charge')) ? owner : null;
    }, thrown: () => {
      dismount(true);
      host.combat.hit({ source: 'env', sourceTags: [], target: host.player.health, amount: 10, point: host.player.position,
        dir: rider.velocity, cause: { kind: 'env.ride', label: 'Thrown from the saddle', text: 'Thrown from the saddle' } });
    } };
  const frame: { -readonly [K in keyof ReinsFrame]: ReinsFrame[K] } = {
    forward: 0, turn: 0, touchX: 0, touchY: 0, gallop: false, jump: false, drawing: false, moveScale: 1,
    phase: 0, feet: body.feet, roads: ports.roads, inBounds: ports.inBounds, refuses: () => false, wet: false };
  const mount = (id: string): boolean => {
    const a = host.entities.get(id);
    if (horse !== null || a === undefined || !a.alive || a.driven || !available.has(id)) return false;
    host.setBoard(false); horse = a;
    const h = herd(a); if (h !== null) h.setRidden(a); else a.mem['ridden'] = 1;
    a.setMotion(a.yaw, 0, 2); body.heading = a.yaw; body.speed = 0; body.wUp = 0; body.yawRate = 0;
    body.target = 0; body.rateIn = 0; body.turnIn = 0; body.sector = 2; body.jumpQueued = false;
    a.driven = true; a.yOffset = 0; body.feet.copy(a.position);
    body.jostles = 0; body.shoveX = body.shoveZ = 0; body.jolt = 0;
    body.cruise = 0; body.gallopWas = false; body.sectorWas = 2; body.skidT = 0; body.panicT = 0; body.panicRear = 0; body.onRoad = false;
    body.spur.reset(); body.spur.good = 0; body.lastPhase = phase(id);
    body.motor = withOwner(null, () => new CharacterMotor(host.physics, mountedMotorOptions(a.scale, a)));
    body.settleBody(); body.landBody(world); body.eyeY = body.feet.y;
    host.player.motor.setEnabled(false); ports.groups.env.playerMounted = true;
    return true;
  };
  const motion = { velocityX: 0, velocityZ: 0, grounded: true, swimming: false, hover: false };
  const sampleMotion = (): SimPlayerMotionSample => {
    // MountedBody owns carrier velocity; neither corrected feet displacement nor the on-foot approximation supplies it.
    motion.velocityX = rider.velocity.x; motion.velocityZ = rider.velocity.z; motion.grounded = rider.onGround;
    return motion;
  };
  host.usePlayerDriver({ walking, motionSample: sampleMotion, input: (command, dt) => {
    if (horse?.alive === false) dismount(true);
    previousFoot.copy(host.player.position);
    const a = horse;
    if (a === null) {
      const versioned = command?.commandVersion === 1;
      const board = command?.hover === true ? !host.playerBoard.on : host.playerBoard.on;
      const depth = Math.max(0, ports.waterLevel() - rider.position.y);
      const forward = command === undefined ? 0 : -Math.sin(command.yaw) * command.moveX - Math.cos(command.yaw) * command.moveZ;
      rider.crouching = versioned && !board && command.crouch === true;
      rider.sprinting = versioned && !board && depth < 0.6 && !rider.crouching && command.sprint === true && forward > 0;
      const wade = !board && host.playerFall.grounded ? Math.min(1, depth / 1.1) : 0;
      walking.speed = versioned ? walkingSpeed(rider.crouching, rider.sprinting, wade, 1, 1) : host.level.player.speed;
      walking.crouching = rider.crouching; ports.groups.env.playerCrouched = rider.crouching;
      return false;
    }
    if (command !== undefined && (command.commandVersion !== 1 || command.steer === undefined)) throw new Error('Mounted reins require versioned raw local controls');
    if (command !== undefined) host.player.yaw = command.yaw;
    host.playerImpulse.set(0, 0, 0); rider.crouching = false; ports.groups.env.playerCrouched = false;
    frame.forward = command?.steer?.keyY ?? 0; frame.turn = command?.steer?.keyX ?? 0;
    frame.touchX = command?.steer?.stickX ?? 0; frame.touchY = command?.steer?.stickY ?? 0;
    frame.gallop = command?.sprint === true; frame.jump = command?.jump === true; frame.phase = phase(a.entityId);
    frame.wet = ports.wetAt(body.feet.x, body.feet.z) || ports.heightAt(body.feet.x, body.feet.z) < ports.waterLevel() - 0.2;
    body.read(dt, frame); a.mem['turnLead'] = body.turnLead; a.lookWeight = 0;
    return true;
  }, step: dt => {
    const a = horse; if (a === null) return;
    body.stepBody(dt, a, rider, world);
    if (horse !== null) body.placeRider(dt, 1, a, rider, world);
  } });
  const missingPose = new Error('Missing mounted pose actor');
  host.onStep('nalati.mounted', dt => {
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
      return { version: 1, horse: horse?.entityId ?? null, body: { ...state, reins: { ...state.reins, spur: { ...state.reins.spur } } },
        motor: motor === undefined ? null : { ...motor, anchor: { ...motor.anchor }, result: { ...motor.result } },
        rider: { velocity: rider.velocity.toArray(), onGround: rider.onGround, sprinting: rider.sprinting,
          crouching: rider.crouching, speedFactor: rider.speedFactor }, poses: [...poses].map(([id, pose]) => [id, pose.snapshot()]) };
    }, restore: value => {
      const state = v.parse(Saved, value), checked = new MountedBody(HORSE_SPEED); checked.restoreBody(state.body);
      const a = state.horse === null ? null : host.entities.get(state.horse);
      if (a === undefined || (state.horse === null) !== (state.motor === null) || (a !== null && (!available.has(a.entityId) || !a.driven))
        || state.poses.length !== poses.size || new Set(state.poses.map(([id]) => id)).size !== poses.size) throw new Error('Invalid mounted continuation identity');
      // Validate all pose wires before mutating the installed law.
      for (let i = 0; i < Math.min(64, state.poses.length); i++) {
        const row = state.poses[i]; if (row === undefined) throw new Error('Missing saved mounted pose');
        const [id, wire] = row;
        const known = poses.get(id); if (known === undefined) throw new Error('Invalid mounted pose identity');
        new AnimalPoseLaw(known.recipe).restore(wire);
      }
      body.restoreBody(state.body); horse = a; savedMotor = state.motor;
      rider.velocity.fromArray(state.rider.velocity); rider.onGround = state.rider.onGround; rider.sprinting = state.rider.sprinting;
      rider.crouching = state.rider.crouching; rider.speedFactor = state.rider.speedFactor;
      for (let i = 0; i < Math.min(64, state.poses.length); i++) {
        const row = state.poses[i]; if (row === undefined) throw new Error('Missing saved mounted pose');
        poses.get(row[0])?.restore(row[1]);
      }
      ports.groups.env.playerMounted = a !== null;
      ports.groups.env.playerCrouched = rider.crouching;
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
  const out: NalatiMountedPlayer = { body, rider, get horse() { return horse; }, get mounted() { return horse !== null; }, mount, dismount, phase };
  installed.set(host, out); return out;
}
