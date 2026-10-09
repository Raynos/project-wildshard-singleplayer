import * as v from 'valibot';
import { Vector3 } from 'three';
import { ItemRuntime, type ItemSpec, type ItemState, type ItemTarget } from '@wildshard/engine/combat/items';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { lashContact } from '../weapons/lash';

/** The declared whip row's id (data/items.ts) and its fixed-step adapter id. */
export const WHIP_ID = 'weapon.sunscar-whip';
export const WHIP_STEP = `item.${WHIP_ID}`;
/** The browser player's eye above the feet (engine Player EYE): the lash leaves from the eye toward the crosshair. */
const EYE = 1.68;
/** The tick protocol's command allowance (sdk/tickProtocol.ts): a tick never carries more. */
const MAX_COMMANDS = 1024;
/** One player attack this tick: a light crack at the named target (the protocol's `player.attack`), or a heavy one. */
export interface WhipCreatureCommand { readonly targetId: string; readonly heavy?: boolean }
/** A crack at a world target (a lever, a brazier): `world` names it back to its owner, `at` is where the lash aims. */
export interface WhipWorldCommand { readonly world: number; readonly at: { readonly x: number; readonly y: number; readonly z: number }; readonly heavy: boolean }
/** Every whip command a tick carries, in tape order. */
export type WhipCommand = WhipCreatureCommand | WhipWorldCommand;
/** The whip in the host: its item, and the world target its crack reached this tick (null: none, or the lash was cooling). */
export interface SignalWhip { readonly item: ItemRuntime; readonly cracked: () => number | null }

const finite = v.pipe(v.number(), v.finite());
const Aim = v.strictObject({ x: finite, y: finite, z: finite });
const Saved = v.strictObject({ version: finite, id: v.string(), tick: finite, cooldown: finite, fuel: finite, lit: v.boolean(), held: v.boolean(), chargeTime: finite,
  pending: v.array(v.strictObject({ action: v.picklist([1, 2, 3, 4]), aim: v.nullable(v.strictObject({ origin: Aim, direction: Aim })) })) });

/**
 * Signal's bullwhip as its declared item row in the renderer-free host (SF72): the platform's own `ItemRuntime` with the
 * row's light (18) and heavy (16) contacts, reach, width and cooldowns, aimed from the player's eye at the commanded
 * target's body. A body's contact point is where the lash first meets its head ball or body capsule, the browser
 * whip's rule (weapons/lash.ts): the reach runs to her skin, never to her centre. The browser's trusted family (weapons/Bullwhip.ts) adds the lash's 0.12 s unroll, the heavy's second
 * lash, the pull and the stagger as presentation-timed extras; headless strikes are the row's single declared contacts,
 * never an invented one. Its cooldown and queued commands are exact continuation. A world crack (the well's crank, a
 * waymark's brazier) is the same item's crack aimed at its target, so the row's cooldown gates it as the browser's crack
 * does: it reaches the target only when the whip fires on it this tick (`cracked`).
 */
export function installSignalWhip(host: SimHost, row: ItemSpec, commands: () => readonly WhipCommand[]): SignalWhip {
  if (row.kind !== 'weapon' || row.id !== WHIP_ID) throw new Error('Signal declares its whip as a weapon row');
  const origin = new Vector3(), target = new Vector3(), eye = new Vector3(), ray = new Vector3();
  const volumes = { head: new Vector3(), headRadius: 0, a: new Vector3(), b: new Vector3(), bodyRadius: 0 };
  const reach = Math.max(row.light.range, row.heavy.range), width = row.light.width;
  // Each body's contact point: where a lash from the eye at its centre first meets its head ball or body capsule (or
  // its chest in the lane), the browser whip's rule (weapons/lash.ts); out of reach it stays the centre, which the
  // item's own range then refuses.
  const contact = (actor: AnimalSim): Vector3 => {
    const centre = actor.position.clone(); centre.y += actor.dims.bodyY * actor.scale;
    eye.copy(host.player.position); eye.y += EYE; ray.subVectors(centre, eye);
    const length = ray.length(); if (length < 1e-9) return centre;
    ray.multiplyScalar(1 / length);
    actor.headWorld(volumes.head); actor.bodyCapsule(volumes.a, volumes.b);
    volumes.headRadius = actor.dims.headRadius * actor.scale; volumes.bodyRadius = actor.dims.bodyRadius * actor.scale;
    const along = lashContact(eye, ray, reach, width, volumes, actor.position);
    return along === null ? centre : eye.clone().addScaledVector(ray, along);
  };
  const targets = (): readonly ItemTarget[] => [...host.entities.values()].map(actor =>
    Object.assign(host.combat.targetPort(actor.combatActor(), actor), { aimPoint: contact(actor) }));
  const whip = new ItemRuntime(row, { actor: host.player.health, combat: host.combat, hook: null, targets,
    effect: () => { throw new Error('The whip row declares no contact effect'); } });
  // the item copies the aim at its input boundary, so one buffer serves every command
  const aim = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 } };
  // The item drops every command it cannot fire, so within a tick only the first queued command can fire (the row's
  // cooldowns are positive): a world crack reached its target exactly when it was first and the whip fired.
  const shot = { fired: false }, fired = (): boolean => shot.fired;
  let first: WhipCommand | undefined, cracked: number | null = null;
  whip.observe(host.scope, phase => { if (phase === 'fire') shot.fired = true; });
  host.onStep(WHIP_STEP, dt => {
    const list = commands();
    first = undefined; shot.fired = false; cracked = null;
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      origin.copy(host.player.position); origin.y += EYE;
      if ('world' in command) target.set(command.at.x, command.at.y, command.at.z);
      else {
        const actor = host.entities.get(command.targetId); if (actor === undefined) continue;
        target.copy(actor.position); target.y += actor.dims.bodyY * actor.scale;
      }
      target.sub(origin);
      if (target.lengthSq() < 1e-9) continue;
      target.normalize();
      aim.origin.x = origin.x; aim.origin.y = origin.y; aim.origin.z = origin.z; aim.direction.x = target.x; aim.direction.y = target.y; aim.direction.z = target.z;
      first ??= command;
      whip.queue(command.heavy === true ? 2 : 1, aim);
    }
    whip.step(host.state.tick, dt);
    if (fired() && first !== undefined && 'world' in first) cracked = first.world;
  }, { snapshot: () => JSON.stringify(whip.snapshot()), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid Signal whip continuation');
    const state: ItemState = v.parse(Saved, JSON.parse(value)); whip.restore(state);
  } });
  return { item: whip, cracked: () => cracked };
}
