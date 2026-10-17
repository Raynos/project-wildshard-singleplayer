import type { Scope } from '@wildshard/engine/app/scope';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { Events } from '@wildshard/engine/events/events';

/** Reset the selected pouch before death presentation publishes the respawn refill. */
export function bindLoadoutDeath(events: Events, scope: Scope, health: Actor | null, ports: {
  active: () => boolean; reset: () => void;
}): void {
  events.on('player.died', ({ actor }) => {
    if (health !== null && actor === health && ports.active()) ports.reset();
  }, scope, { order: -10 });
}
