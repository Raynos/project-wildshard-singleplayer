import type { Actor, Events, Scope } from '#engine';

/** Reset the selected pouch before death presentation publishes the respawn refill. */
export function bindLoadoutDeath(events: Events, scope: Scope, health: Actor | null, ports: {
  active: () => boolean; reset: () => void;
}): void {
  events.on('player.died', ({ actor }) => {
    if (health !== null && actor === health && ports.active()) ports.reset();
  }, scope, { order: -10 });
}
