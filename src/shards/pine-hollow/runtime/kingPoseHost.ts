import * as v from 'valibot';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { AnimalPoseLaw } from '@wildshard/engine/entities/animalPose';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { advanceKingPose, newPose, type KingPoseInput, type KingPoseRest } from '../combat/kingRig';
import type { KingCollisionJoints, KingCollisionVolumes } from './kingCollision';
import { KingQueryPose, type KingQueryPoseSaved } from './kingQueryPose';

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1), timers: v.pipe(v.string(), v.maxLength(8192)),
  query: v.unknown(), hits: v.unknown(), rootPitch: finite, rootRoll: finite });
const smooth01 = (n: number): number => n * n * (3 - 2 * n);
const INVALID_CLOCK = new RangeError('Invalid King pose clock');

/** One native King's custom scalar animation history, collision queries and root frame. The caller owns
 * body movement, near/far cadence and publication moments; this owner never creates a bone or a second actor. */
export class PineKingPose {
  readonly query: KingQueryPose;
  readonly hits: KingQueryPose;
  private readonly timers: AnimalPoseLaw;
  private readonly body: AnimalSim;
  private readonly rest: KingPoseRest;
  private readonly joints: KingCollisionJoints;
  private readonly volumes: KingCollisionVolumes;
  private readonly pose = newPose();
  private readonly input: KingPoseInput;
  private readonly frame = new Matrix4();
  private readonly angles = new Euler(0, 0, 0, 'YXZ');
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();
  private rootPitch = 0;
  private rootRoll = 0;

  constructor(body: AnimalSim, metadata: { rest: KingPoseRest; joints: KingCollisionJoints; volumes: KingCollisionVolumes }) {
    this.body = body; this.rest = metadata.rest; this.joints = metadata.joints; this.volumes = metadata.volumes;
    this.timers = new AnimalPoseLaw({ custom: true, dims: body.dims });
    this.query = new KingQueryPose(metadata.joints, metadata.volumes);
    this.hits = new KingQueryPose(metadata.joints, metadata.volumes);
    this.input = { dt: 0, t: 0, scale: body.scale, speed: 0, deathT: -1, flinch: 0, brace: 0, attack: -1,
      lookWeight: 0, yaw: body.yaw, mem: body.mem, position: body.position, lookTarget: body.lookTarget };
    this.sampleTerrain(); this.query.stage(this.pose); this.publish('head'); this.sampleHitboxes();
  }

  /** Same sampling boundary as AnimalManager.spawn/think and the fight's explicit terrain samples. */
  sampleTerrain(): void { this.body.samplePoseTerrain(this.timers); }

  /** Follow one actual body move; attack time already advanced in AnimalSim.step. Far bodies retain their local bones. */
  advance(dt: number, t: number, near: boolean): void {
    if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(t)) throw INVALID_CLOCK;
    const body = this.body, input = this.input;
    body.advancePose(this.timers, dt, t, near);
    const shared = this.timers.input;
    if (near) {
      input.dt = dt; input.t = t; input.scale = body.scale; input.speed = body.speed;
      input.deathT = shared.deathT; input.flinch = shared.flinch; input.brace = smooth01(shared.brace);
      input.attack = body.attackPhase; input.lookWeight = this.timers.lookAmt; input.yaw = body.yaw;
      input.mem = body.mem;
      advanceKingPose(input, this.rest, this.pose); this.query.stage(this.pose);
    }
    // AnimalView.applyRoot: a custom living rig applies recoil to its root as well as its custom local pose.
    const f = body.alive ? shared.flinch * 1.8 : 0;
    this.rootPitch = this.timers.tiltPitch + shared.flinchPitch * f;
    this.rootRoll = this.timers.tiltRoll + shared.flinchRoll * f;
  }

  /** Explicitly publish the exact consumer chain, using the latest moved/placed root and cached visual tilt. */
  publish(through: 'body' | 'ribs' | 'head'): void {
    this.rotation.setFromEuler(this.angles.set(this.rootPitch, this.body.yaw, this.rootRoll, 'YXZ'));
    this.scale.setScalar(this.body.scale);
    this.frame.compose(this.body.position, this.rotation, this.scale);
    this.query.publish(this.frame, through);
  }
  /** The live cage getter updates its root/chest parents immediately; head and body queries themselves stay passive. */
  ribs(out: Vector3): Vector3 { this.publish('ribs'); return this.query.ribs(out); }

  /** CreatureBodies.sync copies last-render queries before think/movement; later cage reads do not alter its colliders. */
  sampleHitboxes(): void { this.hits.copyFrom(this.query); }

  snapshot(): { version: 1; timers: string; query: KingQueryPoseSaved; hits: KingQueryPoseSaved; rootPitch: number; rootRoll: number } {
    return { version: 1, timers: this.timers.snapshot(), query: this.query.snapshot(), hits: this.hits.snapshot(),
      rootPitch: this.rootPitch, rootRoll: this.rootRoll };
  }
  /** Validate both clocks before mutation, and retain the exact pending/cached query difference. No terrain reads or ticks. */
  restore(input: unknown): void {
    this.prepareRestore(input)();
  }

  /** A roster validates every King's history before committing any of them. */
  prepareRestore(input: unknown): () => void {
    const saved = v.parse(Saved, input);
    const timers = new AnimalPoseLaw({ custom: true, dims: this.body.dims });
    const query = new KingQueryPose(this.joints, this.volumes);
    const hits = new KingQueryPose(this.joints, this.volumes);
    timers.restore(saved.timers); query.restore(saved.query); hits.restore(saved.hits);
    const validatedQuery = query.snapshot(), validatedHits = hits.snapshot();
    return () => {
      this.timers.restore(saved.timers); this.query.restore(validatedQuery); this.hits.restore(validatedHits);
      this.rootPitch = saved.rootPitch; this.rootRoll = saved.rootRoll;
    };
  }
}
