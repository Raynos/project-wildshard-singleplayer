import type { Scope } from '@wildshard/engine/app/scope';
import type { CombatCues } from '@wildshard/engine/combat/cues';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { Events } from '@wildshard/engine/events/events';

/** Full draw is a state notification; the creak belongs only to the start of the draw. */
export function bindLongbowCharge(events: Events, scope: Scope, row: EquipmentRow, cues: CombatCues, recovered: (ok: boolean) => void): void {
  events.on('weapon.charge', ({ id, phase, value }) => {
    if (id !== row.id) return;
    if (phase === 'recover') recovered(value === 1);
    else if (phase !== 'draw' || value !== 1) cues.charge(row, phase);
  }, scope);
}

/** Reset the selected pouch before death presentation publishes the respawn refill. */
export function bindLoadoutDeath(events: Events, scope: Scope, health: Actor | null, ports: {
  active: () => boolean; reset: () => void;
}): void {
  events.on('player.died', ({ actor }) => {
    if (health !== null && actor === health && ports.active()) ports.reset();
  }, scope, { order: -10 });
}
