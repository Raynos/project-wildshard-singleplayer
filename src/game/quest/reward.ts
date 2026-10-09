import { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { RewardCaption } from '@wildshard/engine/quest/view/ui';
import { applyQuestRewardPose, type QuestRewardOrigin, type QuestRewardPosePlayer, type QuestRewardPoseTarget } from './rewardMotion';

export interface QuestRewardPlayer extends QuestRewardPosePlayer { carried: boolean }
export interface QuestRewardSpec extends QuestRewardPoseTarget {
  kicker: string; title: string; subtitle: string;
  /** Start once this holds; the beat runs once per installation. Saved flags belong in this predicate. */
  when: () => boolean;
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
  private readonly from: QuestRewardOrigin = { position: new Vector3(), yaw: 0, pitch: 0, phase: 0 };
  private elapsed = -1;
  private carried = false;
  constructor(private readonly host: QuestRewardHost, private readonly spec: QuestRewardSpec) {
    this.caption = new RewardCaption(spec.kicker, spec.title, spec.subtitle);
    host.scope.onDispose(() => {
      if (this.elapsed >= 0) this.release();
      this.caption.scope.dispose();
    });
  }
  get active(): boolean { return this.elapsed >= 0; }
  /** An admitted director may supply completion explicitly; the local elapsed clock then serves presentation only. */
  update(dt: number, authoritativeFinish?: boolean): void {
    if (this.host.scope.disposed) return;
    const { player, dayNight, objective } = this.host;
    if (this.elapsed === -1 && this.spec.when()) {
      this.elapsed = 0; this.carried = player.carried; player.carried = true;
      this.from.position.copy(player.position); this.from.yaw = player.yaw; this.from.pitch = player.pitch;
      this.from.phase = dayNight?.phase ?? 0;
      this.caption.show(true); this.host.setViewmodel?.(false);
      objective?.classList.add('ws-quest-hide'); this.host.sting();
    }
    if (!this.active) return;
    this.elapsed += dt;
    applyQuestRewardPose(this.elapsed, this.from, this.spec, player, dayNight);
    if (authoritativeFinish ?? this.elapsed > (this.spec.holdSeconds ?? 7)) {
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
