import * as v from 'valibot';
import { Vector3 } from 'three';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { CombatTarget } from '@wildshard/engine/combat/pipeline';
import type { SimHost } from '@wildshard/engine/sim';
import { LashRuntime, lashSpec, lashVolumeHit, type LashMoves, type LashTiming, type LashWorldTarget } from './lash';

/** One player attack this tick: a light crack at the named target (the protocol's `player.attack`), or a heavy one. */
export interface LashCreatureCommand { readonly targetId: string; readonly heavy?: boolean }
/** A crack at a world target: `world` names the target row's act, whose spot the lash aims at. */
export interface LashWorldCommand { readonly world: number; readonly heavy: boolean }
/** Every lash command a tick carries, in tape order. */
export type LashCommand = LashCreatureCommand | LashWorldCommand;
/**
 * A world target the lash can reach (an interaction row's crack spot: a lever, a brazier): the act it answers and the
 * crack that reaches it (`light`: a crack's first lash; `heavy`: the double crack's second, its first wraps).
 */
export interface LashTargetRow { readonly act: number; readonly at: { readonly x: number; readonly y: number; readonly z: number }; readonly radius: number; readonly crack: 'light' | 'heavy' }
/** What a lash item in the renderer-free host is given: its declared weapon row, timing, moves, step and inputs. */
export interface LashHostSpec {
  /** The fixed-step id its continuation is kept under. */
  readonly step: string;
  /** The declared weapon row (its contact, damage, reach and cooldowns). */
  readonly row: ItemSpec;
  readonly timing: LashTiming;
  readonly moves: LashMoves;
  /** The player's eye above the feet: the lash leaves from it toward the target. */
  readonly eye: number;
  /** This tick's commands, in tape order. */
  readonly commands: () => readonly LashCommand[];
  /** The world targets it can crack. */
  readonly targets: readonly LashTargetRow[];
}
/** A lash item in the host: its runtime and the act its lash reached this tick (null: none). */
export interface LashHost { readonly lash: LashRuntime; readonly cracked: () => number | null }

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(2), cooldown: finite, crackT: finite, heavy: v.boolean(), landed: v.picklist([0, 1, 2]),
  target: v.nullable(v.string()), world: v.nullable(finite), dir: v.tuple([finite, finite, finite]) });

/**
 * A declared lash weapon in the renderer-free host (SHARD-PLATFORM SF27): the platform lash runtime on the row, locked
 * on — each lash leaves the eye toward the commanded creature's body as it stands then, or a world command's target
 * spot; a target gone keeps the last aim. A lash takes the first body it meets (the creatures' head balls and body
 * capsules), else a chest in its lane, else a target row's spot in its lane: a `light` row answers a crack's first lash,
 * a `heavy` row the double crack's second. The cooldowns refuse a swing; the lash and its aim are exact continuation
 * (`{ version: 2, …lash, target, world, dir }`).
 */
export function installLashHost(host: SimHost, spec: LashHostSpec): LashHost {
  const volumes = { head: new Vector3(), headRadius: 0, a: new Vector3(), b: new Vector3(), bodyRadius: 0 };
  const aimed = { target: null as string | null, world: null as number | null, dir: new Vector3(0, 0, -1) };
  const rows = spec.targets;
  let cracked: number | null = null;
  const port = (id: string): CombatTarget | null => {
    const actor = host.entities.get(id); return actor === undefined ? null : host.combat.targetPort(actor.combatActor(), actor, velocity => { actor.impulse(velocity); });
  };
  const world: LashWorldTarget[] = rows.map(entry => ({ at: new Vector3(entry.at.x, entry.at.y, entry.at.z), radius: entry.radius,
    crack: (heavy, second) => {
      if (entry.crack === 'light') { if (second) return false; cracked = entry.act; return true; }
      if (heavy && second) cracked = entry.act;
      return true;
    } }));
  const lash = new LashRuntime(lashSpec(spec.row, spec.timing, spec.moves), { source: host.player.health, hit: req => host.combat.hit(req), world: () => world,
    targets: () => [...host.entities.keys()].flatMap(id => { const p = port(id); return p === null ? [] : [p]; }),
    aim: (from, dir) => {
      from.copy(host.player.position); from.y += spec.eye;
      const actor = aimed.target === null ? undefined : host.entities.get(aimed.target), spot = aimed.world === null ? undefined : rows.find(entry => entry.act === aimed.world);
      if (actor !== undefined) dir.copy(actor.position).setY(actor.position.y + actor.dims.bodyY * actor.scale).sub(from);
      else if (spot !== undefined) dir.set(spot.at.x, spot.at.y, spot.at.z).sub(from);
      else dir.copy(aimed.dir);
      if (dir.lengthSq() < 1e-9) dir.copy(aimed.dir);
      dir.normalize(); aimed.dir.copy(dir); return true;
    },
    body: (from, dir, reach) => {
      let best: { port: CombatTarget; point: Vector3 } | null = null, bestT = Infinity;
      if (host.entities.size > 1024) throw new RangeError('Lash actor roster exceeds its bounded contact scan');
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
  host.onStep(spec.step, dt => {
    const list = spec.commands();
    cracked = null; lash.cool(dt);
    for (let i = 0; i < 1024; i++) {
      const command = list[i]; if (command === undefined) break;
      if (!('world' in command) && !host.entities.has(command.targetId)) continue;
      if (!lash.swing(command.heavy === true)) continue;
      aimed.target = 'world' in command ? null : command.targetId; aimed.world = 'world' in command ? command.world : null;
    }
    lash.advance(dt);
  }, { snapshot: () => JSON.stringify({ version: 2, ...lash.snapshot(), target: aimed.target, world: aimed.world, dir: aimed.dir.toArray() }), restore: value => {
    if (typeof value !== 'string') throw new Error(`Invalid ${spec.step} continuation`);
    const state = v.parse(Saved, JSON.parse(value));
    lash.restore(state); aimed.target = state.target; aimed.world = state.world; aimed.dir.fromArray(state.dir);
  } });
  return { lash, cracked: () => cracked };
}
