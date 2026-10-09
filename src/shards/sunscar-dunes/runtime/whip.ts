import * as v from 'valibot';
import { Vector3 } from 'three';
import { ItemRuntime, type ItemSpec, type ItemState, type ItemTarget } from '@wildshard/engine/combat/items';
import type { SimHost } from '@wildshard/engine/sim';

/** The declared whip row's id (data/items.ts) and its fixed-step adapter id. */
export const WHIP_ID = 'weapon.sunscar-whip';
export const WHIP_STEP = `item.${WHIP_ID}`;
/** The browser player's eye above the feet (engine Player EYE): the lash leaves from the eye toward the crosshair. */
const EYE = 1.68;
/** The tick protocol's command allowance (sdk/tickProtocol.ts): a tick never carries more. */
const MAX_COMMANDS = 1024;
/** One player attack this tick: a light crack at the named target (the protocol's `player.attack`), or a heavy one. */
export interface WhipCommand { readonly targetId: string; readonly heavy?: boolean }

const finite = v.pipe(v.number(), v.finite());
const Aim = v.strictObject({ x: finite, y: finite, z: finite });
const Saved = v.strictObject({ version: finite, id: v.string(), tick: finite, cooldown: finite, fuel: finite, lit: v.boolean(), held: v.boolean(), chargeTime: finite,
  pending: v.array(v.strictObject({ action: v.picklist([1, 2, 3, 4]), aim: v.nullable(v.strictObject({ origin: Aim, direction: Aim })) })) });

/**
 * Signal's bullwhip as its declared item row in the renderer-free host (SF72): the platform's own `ItemRuntime` with the
 * row's light (18) and heavy (16) contacts, reach, width and cooldowns, aimed from the player's eye at the commanded
 * target's body. The browser's trusted family (weapons/Bullwhip.ts) adds the lash's 0.12 s unroll, the heavy's second
 * lash, the pull and the stagger as presentation-timed extras; headless strikes are the row's single declared contacts,
 * never an invented one. Its cooldown and queued commands are exact continuation.
 */
export function installSignalWhip(host: SimHost, row: ItemSpec, commands: () => readonly WhipCommand[]): ItemRuntime {
  if (row.kind !== 'weapon' || row.id !== WHIP_ID) throw new Error('Signal declares its whip as a weapon row');
  const origin = new Vector3(), target = new Vector3();
  const targets = (): readonly ItemTarget[] => [...host.entities.values()].map(actor =>
    Object.assign(host.combat.targetPort(actor.combatActor(), actor), { aimPoint: actor.position.clone().add(new Vector3(0, actor.dims.bodyY * actor.scale, 0)) }));
  const whip = new ItemRuntime(row, { actor: host.player.health, combat: host.combat, hook: null, targets,
    effect: () => { throw new Error('The whip row declares no contact effect'); } });
  // the item copies the aim at its input boundary, so one buffer serves every command
  const aim = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 } };
  host.onStep(WHIP_STEP, dt => {
    const list = commands();
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      const actor = host.entities.get(command.targetId); if (actor === undefined) continue;
      origin.copy(host.player.position); origin.y += EYE;
      target.copy(actor.position); target.y += actor.dims.bodyY * actor.scale; target.sub(origin);
      if (target.lengthSq() < 1e-9) continue;
      target.normalize();
      aim.origin.x = origin.x; aim.origin.y = origin.y; aim.origin.z = origin.z; aim.direction.x = target.x; aim.direction.y = target.y; aim.direction.z = target.z;
      whip.queue(command.heavy === true ? 2 : 1, aim);
    }
    whip.step(host.state.tick, dt);
  }, { snapshot: () => JSON.stringify(whip.snapshot()), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid Signal whip continuation');
    const state: ItemState = v.parse(Saved, JSON.parse(value)); whip.restore(state);
  } });
  return whip;
}
