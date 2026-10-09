import * as v from 'valibot';
import { Vector3 } from 'three';
import { applyQuestRewardPose, type QuestRewardOrigin, type QuestRewardPosePlayer, type QuestRewardPoseTarget } from '@wildshard/game/quest/rewardMotion';

/** The trusted player owner persists position, velocity and yaw; the reward owns pitch and its carry fence. */
export interface DriftwoodRewardPlayer extends QuestRewardPosePlayer { carried: boolean }
/** Actual page target and completion policy, supplied by the trusted finale owner, never inferred from the terrain. */
export interface DriftwoodRewardSpec extends QuestRewardPoseTarget {
  readonly when: () => boolean;
  readonly finish: () => boolean | undefined;
  readonly holdSeconds?: number;
}

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({
  elapsed: v.union([v.literal(-2), v.literal(-1), v.pipe(finite, v.minValue(0))]),
  carried: v.boolean(), player: v.strictObject({ pitch: finite, carried: v.boolean() }),
  from: v.strictObject({ x: finite, y: finite, z: finite, yaw: finite, pitch: finite, phase: finite }),
});

/**
 * The shipping QuestRewardBeat's nonvisual continuation: capture once, carry, advance the shared pose law, finish once
 * and release unless the completion owner takes over. No camera, caption, clock installation or gameplay grant. Its
 * caller registers snapshot/restore with the one host and disposes it with that scope. Restore never runs a decision,
 * pose step or completion callback; the host restores its own player pose and clock separately.
 */
export class DriftwoodReward {
  private readonly from: QuestRewardOrigin = { position: new Vector3(), yaw: 0, pitch: 0, phase: 0 };
  private elapsed = -1;
  private carried = false;
  private disposed = false;

  constructor(private readonly player: DriftwoodRewardPlayer, private readonly day: { phase: number } | null | undefined,
    private readonly spec: DriftwoodRewardSpec) {}

  get active(): boolean { return this.elapsed >= 0; }

  /** Same start/advance/finish order as the page, including an optional director-owned completion clock. */
  update(dt: number, authoritativeFinish?: boolean): void {
    if (this.disposed) return;
    if (this.elapsed === -1 && this.spec.when()) {
      this.elapsed = 0; this.carried = this.player.carried; this.player.carried = true;
      this.from.position.copy(this.player.position); this.from.yaw = this.player.yaw; this.from.pitch = this.player.pitch;
      this.from.phase = this.day?.phase ?? 0;
    }
    if (!this.active) return;
    this.elapsed += dt;
    applyQuestRewardPose(this.elapsed, this.from, this.spec, this.player, this.day);
    if (authoritativeFinish ?? this.elapsed > (this.spec.holdSeconds ?? 7)) {
      this.elapsed = -2;
      if (this.spec.finish() !== true) this.player.carried = this.carried;
    }
  }

  /** A copied, strictly decoded continuation; player position/velocity/yaw and day phase remain the host's state. */
  snapshot(): v.InferOutput<typeof Saved> {
    const { position, yaw, pitch, phase } = this.from;
    return { elapsed: this.elapsed, carried: this.carried, player: { pitch: this.player.pitch, carried: this.player.carried },
      from: { x: position.x, y: position.y, z: position.z, yaw, pitch, phase } };
  }

  /** Refuse malformed state before changing any field; reconnect the reward-owned pitch/carry without stepping. */
  restore(value: unknown): void {
    if (this.disposed) throw new Error('Driftwood reward is disposed');
    const saved = v.parse(Saved, value);
    if (saved.elapsed >= 0 && !saved.player.carried) throw new Error('Active Driftwood reward must own the player');
    this.elapsed = saved.elapsed; this.carried = saved.carried;
    this.from.position.set(saved.from.x, saved.from.y, saved.from.z);
    this.from.yaw = saved.from.yaw; this.from.pitch = saved.from.pitch; this.from.phase = saved.from.phase;
    this.player.pitch = saved.player.pitch; this.player.carried = saved.player.carried;
  }

  /** The page releases only an active beat; a finished completion card retains its own camera ownership. */
  dispose(): void {
    if (this.disposed) return;
    if (this.active) this.player.carried = this.carried;
    this.disposed = true;
  }
}
