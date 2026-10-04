import { MathUtils, Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { RewardCaption } from '@wildshard/engine/quest/view/ui';

export interface QuestRewardPlayer {
  position: Vector3; velocity: Vector3; yaw: number; pitch: number; carried: boolean;
}
export interface QuestRewardSpec {
  kicker: string; title: string; subtitle: string;
  /** Start once this holds; the beat runs once per installation. Saved flags belong in this predicate. */
  when: () => boolean;
  at?: Vector3;
  yaw?: number;
  pitch?: number;
  phase?: number;
  holdSeconds?: number;
  /** Raise the reward flag / award loot here. Return true if a completion card takes camera ownership. */
  finish: () => boolean | undefined;
}
export interface QuestRewardHost {
  scope: Scope;
  player: QuestRewardPlayer;
  dayNight?: { phase: number } | null;
  objective?: HTMLElement;
  setViewmodel?: (on: boolean) => void;
  sting: () => void;
}

/** Wendell's held reward view: the same caption, 2.5 s camera ease, 3.5 s clock ease and 7 s hold. */
export class QuestRewardBeat {
  private readonly caption: RewardCaption;
  private readonly from = new Vector3();
  private elapsed = -1;
  private fromYaw = 0;
  private fromPitch = 0;
  private fromPhase = 0;
  private carried = false;
  constructor(private readonly host: QuestRewardHost, private readonly spec: QuestRewardSpec) {
    this.caption = new RewardCaption(spec.kicker, spec.title, spec.subtitle);
    host.scope.onDispose(() => {
      if (this.elapsed >= 0) this.release();
      this.caption.scope.dispose();
    });
  }
  get active(): boolean { return this.elapsed >= 0; }
  update(dt: number): void {
    if (this.host.scope.disposed) return;
    const { player, dayNight, objective } = this.host;
    if (this.elapsed === -1 && this.spec.when()) {
      this.elapsed = 0; this.carried = player.carried; player.carried = true;
      this.from.copy(player.position); this.fromYaw = player.yaw; this.fromPitch = player.pitch;
      this.fromPhase = dayNight?.phase ?? 0;
      this.caption.show(true); this.host.setViewmodel?.(false);
      objective?.classList.add('ws-quest-hide'); this.host.sting();
    }
    if (!this.active) return;
    this.elapsed += dt;
    const k = MathUtils.smoothstep(this.elapsed, 0, 2.5);
    if (this.spec.at !== undefined) player.position.lerpVectors(this.from, this.spec.at, k);
    player.velocity.set(0, 0, 0);
    const turn = (this.spec.yaw ?? this.fromYaw) - this.fromYaw;
    player.yaw = this.fromYaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * k;
    player.pitch = this.fromPitch + ((this.spec.pitch ?? this.fromPitch) - this.fromPitch) * k;
    if (dayNight && this.spec.phase !== undefined) {
      const ahead = ((this.spec.phase - this.fromPhase) % 1 + 1) % 1;
      dayNight.phase = (this.fromPhase + ahead * MathUtils.smoothstep(this.elapsed, 0, 3.5)) % 1;
    }
    if (this.elapsed > (this.spec.holdSeconds ?? 7)) {
      this.elapsed = -2; this.caption.show(false);
      if (this.spec.finish() !== true) this.release();
    }
  }
  private release(): void {
    this.host.player.carried = this.carried;
    this.host.setViewmodel?.(true);
    this.host.objective?.classList.remove('ws-quest-hide');
  }
}
