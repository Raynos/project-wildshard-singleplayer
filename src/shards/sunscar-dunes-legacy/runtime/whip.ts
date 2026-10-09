import * as v from 'valibot';
import { Vector3 } from 'three';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { CombatTarget } from '@wildshard/engine/combat/pipeline';
import type { SimHost } from '@wildshard/engine/sim';
import { LashRuntime, lashSpec, lashVolumeHit, type LashWorldTarget } from '@wildshard/game/systems/items/lash';
import { WHIP_MOVES, WHIP_TIMING } from '../data/items';

/** The declared whip row's id (data/items.ts) and its fixed-step adapter id. */
export const WHIP_ID = 'weapon.sunscar-whip';
export const WHIP_STEP = `item.${WHIP_ID}`;
/** The browser player's eye above the feet (engine Player EYE): the lash leaves from the eye toward the crosshair. */
const EYE = 1.68;
/** One player attack this tick: a light crack at the named target (the protocol's `player.attack`), or a heavy one. */
export interface WhipCreatureCommand { readonly targetId: string; readonly heavy?: boolean }
/** A crack at a world target: `world` names the crack row's act, whose spot the lash aims at. */
export interface WhipWorldCommand { readonly world: number; readonly heavy: boolean }
/** Every whip command a tick carries, in tape order. */
export type WhipCommand = WhipCreatureCommand | WhipWorldCommand;
/** A world target the lash can reach (a crack row's spot): the act it answers and the crack that reaches it. */
export interface WhipWorldTarget { readonly act: number; readonly at: { readonly x: number; readonly y: number; readonly z: number }; readonly radius: number; readonly crack: 'light' | 'heavy' }
/** The whip in the host: the act its lash reached this tick (null: none). */
export interface SignalWhip { readonly lash: LashRuntime; readonly cracked: () => number | null }

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(2), cooldown: finite, crackT: finite, heavy: v.boolean(), landed: v.picklist([0, 1, 2]),
  target: v.nullable(v.string()), world: v.nullable(finite), dir: v.tuple([finite, finite, finite]) });

/**
 * Signal's bullwhip in the renderer-free host (SF72): the platform's lash runtime (`@wildshard/game/systems/items/lash`)
 * on the declared row, the browser Bullwhip's own crack: the lash lands 0.12 s after the swing, the heavy's second lash
 * at 0.32 s staggers a big creature, its first yanks a small one, and the row's cooldowns refuse a swing. The player's
 * whip is locked on (the row's `lockOn`): each lash leaves the eye toward the commanded target's body as it stands
 * then (a world crack toward its spot); a target gone keeps the last aim. A lash takes the first body it meets (the
 * creatures' head balls and body capsules), else a chest in its lane, else a crack row's spot in its lane: a `light`
 * row is reached by a crack's first lash, a `heavy` row by the double crack's second (its first wraps), as the
 * browser's levers and braziers answer. The lash and its aim are exact continuation.
 */
export function installSignalWhip(host: SimHost, row: ItemSpec, commands: () => readonly WhipCommand[], worldRows: readonly WhipWorldTarget[]): SignalWhip {
  if (row.kind !== 'weapon' || row.id !== WHIP_ID) throw new Error('Signal declares its whip as a weapon row');
  const volumes = { head: new Vector3(), headRadius: 0, a: new Vector3(), b: new Vector3(), bodyRadius: 0 };
  const aimed = { target: null as string | null, world: null as number | null, dir: new Vector3(0, 0, -1) };
  let cracked: number | null = null;
  const port = (id: string): CombatTarget | null => {
    const actor = host.entities.get(id); return actor === undefined ? null : host.combat.targetPort(actor.combatActor(), actor, velocity => { actor.impulse(velocity); });
  };
  const world: LashWorldTarget[] = worldRows.map(entry => ({ at: new Vector3(entry.at.x, entry.at.y, entry.at.z), radius: entry.radius,
    crack: (heavy, second) => {
      if (entry.crack === 'light') { if (second) return false; cracked = entry.act; return true; }
      if (heavy && second) cracked = entry.act;
      return true;
    } }));
  const lash = new LashRuntime(lashSpec(row, WHIP_TIMING, WHIP_MOVES), { source: host.player.health, hit: req => host.combat.hit(req), world: () => world,
    targets: () => [...host.entities.keys()].flatMap(id => { const p = port(id); return p === null ? [] : [p]; }),
    aim: (from, dir) => {
      from.copy(host.player.position); from.y += EYE;
      const actor = aimed.target === null ? undefined : host.entities.get(aimed.target), spot = aimed.world === null ? undefined : worldRows.find(entry => entry.act === aimed.world);
      if (actor !== undefined) dir.copy(actor.position).setY(actor.position.y + actor.dims.bodyY * actor.scale).sub(from);
      else if (spot !== undefined) dir.set(spot.at.x, spot.at.y, spot.at.z).sub(from);
      else dir.copy(aimed.dir);
      if (dir.lengthSq() < 1e-9) dir.copy(aimed.dir);
      dir.normalize(); aimed.dir.copy(dir); return true;
    },
    body: (from, dir, reach) => {
      let best: { port: CombatTarget; point: Vector3 } | null = null, bestT = Infinity;
      if (host.entities.size > 1024) throw new RangeError('Signal lash actor roster exceeds its bounded contact scan');
      const actors = host.entities.entries();
      for (let i = 0; i < Math.min(1024, host.entities.size); i++) {
        const next = actors.next(); if (next.done) break;
        const [id, actor] = next.value;
        const p = port(id); if (p === null || !p.hittable) continue;
        actor.headWorld(volumes.head); actor.bodyCapsule(volumes.a, volumes.b);
        volumes.headRadius = actor.dims.headRadius * actor.scale; volumes.bodyRadius = actor.dims.bodyRadius * actor.scale;
        const t = lashVolumeHit(from, dir, reach, volumes);
        if (t !== null && t < bestT) { best = { port: p, point: from.clone().addScaledVector(dir, t) }; bestT = t; }
      }
      return best;
    } });
  host.onStep(WHIP_STEP, dt => {
    const list = commands();
    cracked = null; lash.cool(dt);
    for (let i = 0; i < 1024; i++) {
      const command = list[i]; if (command === undefined) break;
      if (!('world' in command) && !host.entities.has(command.targetId)) continue;
      if (!lash.swing(command.heavy === true)) continue;
      aimed.target = 'world' in command ? null : command.targetId; aimed.world = 'world' in command ? command.world : null;
    }
    lash.advance(dt);
  }, { snapshot: () => JSON.stringify({ version: 2, ...lash.snapshot(), target: aimed.target, world: aimed.world, dir: aimed.dir.toArray() }), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid Signal whip continuation');
    const state = v.parse(Saved, JSON.parse(value));
    lash.restore(state); aimed.target = state.target; aimed.world = state.world; aimed.dir.fromArray(state.dir);
  } });
  return { lash, cracked: () => cracked };
}
