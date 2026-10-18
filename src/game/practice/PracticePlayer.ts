import type { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Events } from '@wildshard/engine/events/events';
import { PlayerHealth } from '@wildshard/engine/combat/health';
import type { CombatPipeline, DeathCause } from '@wildshard/engine/combat/pipeline';
import type { Player } from '@wildshard/engine/player/Player';
import { PlayerHurt, type PlayerHurtPorts } from '@wildshard/engine/ui/playerHurt';
import { installPlayerDeath } from '@wildshard/engine/ui/playerDeath';

export interface PracticePlayerOptions {
  readonly owner: Scope;
  readonly events: Events;
  readonly combat: CombatPipeline;
  readonly player: Pick<Player, 'position' | 'yaw' | 'dodging' | 'shove' | 'impulse'>;
  readonly worldHealth?: PlayerHealth;
  readonly capExempt?: readonly string[];
  readonly now?: () => number;
  readonly presentation?: Omit<PlayerHurtPorts, 'player'>;
  readonly onDamage?: (amount: number, remaining: number) => void;
  readonly onDeath?: (cause: DeathCause | undefined) => void;
}

/** A bout owns real engine health and damage rules, never the world's player registration.
 * Copy admitted equipment attributes/tags, not world listeners, effects or persistence ports.
 * Death stays at zero until the caller creates a fresh bout; the practice UI owns retry/exit.
 */
export class PracticePlayer {
  readonly health: PlayerHealth;
  private readonly scope: Scope;
  private readonly hurtView: PlayerHurt;
  private dead = false;
  private elapsed = 0;

  constructor(private readonly options: PracticePlayerOptions) {
    this.scope = options.owner.child('practice-player');
    const { events, combat, player } = options;
    this.health = new PlayerHealth(events, {
      now: options.now ?? (() => this.elapsed * 1000), position: () => player.position,
      dodging: () => player.dodging, dodgeGuard: () => false,
      impulse: velocity => player.impulse(velocity),
    });
    if (options.worldHealth !== undefined) {
      Object.assign(this.health.attributes, options.worldHealth.attributes);
      this.health.effectTags = [...options.worldHealth.effectTags];
    }
    this.health.attributes.health = this.health.attributes.maxHealth;
    combat.playerRules(this.scope, { target: this.health, capExempt: options.capExempt ?? [] });
    const noop = (): void => undefined;
    this.hurtView = new PlayerHurt(events, this.scope, combat, this.health, {
      player, directional: () => false, flash: noop, toast: noop, combat: noop,
      hurt: noop, land: noop, arc: noop, trauma: noop, ...options.presentation,
    });
    events.on('damage.dealt', ({ req, dealt }) => {
      if (req.target === this.health) options.onDamage?.(dealt, this.health.attributes.health);
    }, this.scope);
    installPlayerDeath(events, this.scope, this.health, {
      position: () => player.position,
      died: cause => {
        if (this.dead) return;
        this.dead = true;
        this.health.attributes.health = 0;
        options.onDeath?.(cause);
      },
    });
  }

  /** Includes a lethal hit before queued death presentation has been flushed. */
  get defeated(): boolean { return this.dead || !this.health.alive; }

  hurt(creature: { kind: string; label: string; position: Vector3 }, amount: number): void {
    if (this.scope.disposed || this.defeated || !Number.isFinite(amount) || amount <= 0) return;
    this.hurtView.creature(creature, amount);
  }

  land(hard: boolean): void {
    if (!this.scope.disposed && !this.defeated) this.hurtView.fall(hard);
  }

  update(dt: number): void {
    if (this.scope.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    // Present queued hits before PlayerHealth resets its internal health for its respawn event.
    this.options.events.flush('update');
    if (!this.dead) this.health.update(dt);
    this.options.events.flush('update');
  }

  dispose(): void { this.scope.dispose(); }
}
