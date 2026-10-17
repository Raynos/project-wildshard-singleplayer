import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { pineEliteScripts, type PineEliteWorld } from '../src/shards/pine-hollow/combat/eliteScripts';
import { pineEliteScripts as legacyScripts } from './fixtures/species-oracle/pineElites';
import { Lane } from '../src/shards/pine-hollow/combat/lane';

class Body {
  readonly position = new Vector3();
  readonly lookTarget = new Vector3();
  alive = true; hidden = false; hp = 100; maxHp = 100; lookWeight = 0;
  yaw = 0; speed = 0; seed = 0.37; lastHitT = -Infinity; state = 'sidestep'; scale = 1;
  constructor(readonly kind: string, readonly entityId: string) {}
  place(x: number, z: number, yaw: number, y = 0): void { this.position.set(x, y, z); this.yaw = yaw; }
  setMotion(yaw: number, speed: number, _turn: number): void { this.yaw = yaw; this.speed = speed; }
  attack = -1;
  startAttack(seconds: number): void { this.attack = seconds; }
  cancelAttack(): void { this.attack = -1; }
}
function world(): { env: PineEliteWorld<Body>; bodies: Body[]; events: unknown[] } {
  const bodies: Body[] = [], events: unknown[] = [];
  const env: PineEliteWorld<Body> = {
    player: { position: new Vector3(), yaw: 0.2 }, reach: () => true, god: false,
    trauma: k => { events.push(['trauma', k]); }, stun: seconds => { events.push(['stun', seconds]); },
    dusk: () => 1, night: () => 1,
    hurt: (a, amount, walls) => { events.push(['hurt', a.entityId, amount, walls]); },
    voice: (name, a) => { events.push(['voice', name, a.entityId]); },
    spawn: (kind, x, z, yaw, _variant) => {
      const a = new Body(kind, `creature:${String(bodies.length)}`); a.place(x, z, yaw); bodies.push(a); return a;
    },
    find: id => bodies.find(a => a.entityId === id) ?? null,
    own: () => undefined, release: () => undefined, retire: a => { a.alive = false; }, adopt: () => undefined,
    lane: row => new Lane<Body>(row),
    ring: () => ({ setTime: () => undefined, ring: () => undefined, hide: () => undefined }),
    heightAt: () => 0, inChunk: (x, z, margin) => Math.abs(x) < 250 - margin && Math.abs(z) < 250 - margin,
    show: () => undefined,
    fx: { fade: () => { events.push('fade'); }, reappear: () => { events.push('reappear'); }, burstOut: () => { events.push('burst'); }, roar: (_a, radius) => { events.push(['roar', radius]); } },
    signature: id => { events.push(['signature', id]); }, feed: text => { events.push(['feed', text]); },
  };
  return { env, bodies, events };
}
for (const seed of [1337, 9876]) it(`elite JSON preserves fights and old fields at seed ${String(seed)}`, () => {
  const before = world(), after = world(), old = legacyScripts(before.env, seed), current = pineEliteScripts(after.env, seed);
  for (const owner of [...old, ...current]) owner.spawn();
  const dt = 1 / 30;
  for (let tick = 0; tick < 1050; tick++) {
    for (const [i, script] of current.entries()) {
      const previous = old[i]; if (previous === undefined) throw new Error('Missing oracle');
      const p = previous.animal?.position; if (p === undefined) throw new Error('Missing body');
      before.env.player.position.set(p.x + Math.sin(tick / 80) * 15, 0, p.z + 8);
      after.env.player.position.copy(before.env.player.position);
      if (tick === 360) { previous.enterPhase2(); script.enterPhase2(); }
      if (tick === 600) { script.restoreFields(previous.brainState, previous.fields()); }
      previous.tick(dt, tick * dt, true, false); script.tick(dt, tick * dt, true, false);
      expect(script.fields()).toEqual(previous.fields());
      expect(script.brainState).toBe(previous.brainState);
      expect(script.lanes().map(lane => lane.snapshot())).toEqual(previous.lanes().map(lane => lane.snapshot()));
      expect(script.rngs().map(rng => rng.snapshot())).toEqual(previous.rngs().map(rng => rng.snapshot()));
    }
    for (const w of [before, after]) for (const a of w.bodies) {
      a.position.x += Math.sin(a.yaw) * a.speed * dt; a.position.z += Math.cos(a.yaw) * a.speed * dt;
    }
    expect(after.bodies).toEqual(before.bodies);
    expect(after.events).toEqual(before.events);
    before.events.length = 0; after.events.length = 0;
  }
});
