import ecology from '../data/ecology.json' with { type: 'json' };
import { RespawnQueue } from '@wildshard/sdk/populationRespawn';
/**
 * Ecology — the island's enemies come back (DRIFTWOOD-REMASTER A6): a crab, monkey, boar or bear you kill is
 * replaced a few minutes later by a fresh one of the same kind + variant at its herd's home (the tidepool, the grove,
 * the beach), and the drowned sailor rises in the wreck's hold again after dark. A replacement only appears while you
 * are more than 60 m from where it would stand — nothing pops in in front of you.
 *
 *   RespawnQueue — the renderer-free queue (runtime/ecology.ts): `add(entry, now)` on a kill, `take(now, x, z, night)`
 *                  hands back the entries that are due, out of sight and (for night-only kinds) in the dark.
 *   installEcology(adv, world) — subscribes to ordered creature deaths, checks the queue once a second, spawns with
 *                  `animals.spawn` and puts the newcomer back into its herd.
 *
 * Per frame it does nothing but compare a timer; the queue is a plain array touched on kills and once a second.
 */
import type { AdvAnimal, AdventureWorld } from './adventure';
import { app } from '@wildshard/engine/app/runtime';

export function installEcology<A extends AdvAnimal>(w: AdventureWorld<A>, isLand: (x: number, z: number) => boolean): InstanceType<typeof RespawnQueue> {
  const random = (): number => app.rng.stream('spawn').next();
  const q = new RespawnQueue(ecology.rules, ecology.outOfSight, { order: 'reverse', limit: null, result: 'fresh' });
  let now = 0, checkT = 0;
  const killed = (a: A): void => {
    if (a.kind === 'captain' || !q.accepts(a.kind)) return;
    const h = a.herd >= 0 ? w.animals.herds?.[a.herd] : undefined;
    q.add(a.kind, a.variant, a.herd, h ? h.cx : a.position.x, h ? h.cz : a.position.z, now, random());
  };
  w.onDeath?.(killed, 20);
  w.game.onUpdate((dt) => {
    now += dt;
    if (now - checkT < 1) return;
    checkT = now;
    if (q.pending.length === 0 || !w.animals.spawn) return;
    const night = w.sky.dayNight?.night ?? 0;
    for (const e of q.take(now, w.player.position.x, w.player.position.z, night)) {
      // a spot on land a few metres round the herd's home (the home itself for the sailor: his hold)
      let x = e.x, z = e.z;
      if (e.kind !== 'sailor') for (let k = 0; k < 6; k++) { const ang = random() * Math.PI * 2, r = 1 + random() * 4; const tx = e.x + Math.cos(ang) * r, tz = e.z + Math.sin(ang) * r; if (isLand(tx, tz)) { x = tx; z = tz; break; } }
      if (!isLand(x, z) && e.kind !== 'sailor') { e.due = now + 60; q.pending.push(e); continue; }   // try again in a minute
      const a = w.animals.spawn(e.kind, x, z, random() * Math.PI * 2, e.variant);
      a.herd = e.herd;
      if (e.herd >= 0) w.animals.herds?.[e.herd]?.members.push(a);
    }
  }, 'shard.driftwood-isle.installEcology');
  return q;
}
