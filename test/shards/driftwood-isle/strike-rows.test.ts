// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the immutable declaration oracle captured from shipping source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Source provenance is content-hashed.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve exact numeric continuation and signed zero.
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { StrikeRunner, type StrikeActor, type StrikeContext } from '../../../src/engine/ai/strikes';
import { DRIFTWOOD_STRIKES as oldRows } from '../../fixtures/species/driftwood';
import { DRIFTWOOD_STRIKES as currentRows } from '../../../src/shards/driftwood-isle/combat/strikes';
import provenance from '../../fixtures/species/driftwood-provenance.json' with { type: 'json' };

function body(events: unknown[]): StrikeActor {
  return { position: { x: 0, y: 0, z: 0 }, alive: true, scale: 1, yaw: 0,
    startAttack: seconds => { events.push(['start', seconds]); }, cancelAttack: () => { events.push(['cancel']); },
    setMotion: (yaw, speed, turn) => { events.push(['motion', yaw, speed, turn]); } };
}
function context(actor: StrikeActor, events: unknown[], tick: number): StrikeContext {
  const edge = [5 - Number.EPSILON * 4, 5, 5 + Number.EPSILON * 4, 0, 1.4, 1.9, 3.2, 7, 11.5, 17, 30, 40][tick % 12] ?? 0;
  return { actor, target: { x: actor.position.x, y: actor.position.y + (tick % 7 === 0 ? 8 : 0), z: actor.position.z + edge },
    airborne: tick % 3 === 0, ringRadius: (tick % 8) * 0.25,
    canReach: () => tick % 11 !== 0, hit: row => { events.push(['hit', row.id, row.damage, row.tags]); } };
}

describe('Driftwood authored strike rows', () => {
  it('pins the shipping declaration oracle and keeps every scalar and score exact', () => {
    expect(createHash('sha256').update(readFileSync(provenance.fixture)).digest('hex')).toBe(provenance.fixtureHash);
    expect(provenance.sourceHash).toMatch(/^[a-f0-9]{64}$/u);
    for (const id of Object.keys(oldRows) as (keyof typeof oldRows)[]) {
      const before = oldRows[id], after = currentRows[id];
      const { weight: _old, ...a } = before, { weight: _new, ...b } = after;
      expect(b).toEqual(a);
      for (let tick = 0; tick < 120; tick++) {
        const ctx = context(body([]), [], tick);
        expect(after.weight(ctx)).toBe(before.weight(ctx));
      }
    }
  });
  it('preserves 10k real runner selections, contacts, effects and mid-strike restore', () => {
    const old = Object.values(oldRows), current = Object.values(currentRows);
    const a = new StrikeRunner(), b = new StrikeRunner();
    const ae: unknown[] = [], be: unknown[] = [], aa = body(ae), ba = body(be);
    let starts = 0;
    for (let tick = 0; tick < 10000; tick++) {
      const ca = context(aa, ae, tick), cb = context(ba, be, tick);
      if (!a.busy) {
        const ap = a.pick(old, ca), bp = b.pick(current, cb);
        if (ap?.id !== bp?.id) throw new Error(`Pick changed at ${tick}`);
        if (ap !== null && bp !== null) { a.start(ap, aa, ca.target); b.start(bp, ba, cb.target); starts++; }
      }
      const dt = tick % 5 === 0 ? 1 / 30 : 1 / 60;
      a.update(dt, ca); b.update(dt, cb);
      if (!isDeepStrictEqual(a.snapshot(), b.snapshot()) || !isDeepStrictEqual(ae, be)) throw new Error(`Continuation changed at ${tick}`);
      ae.length = 0; be.length = 0;
      if (tick === 5000) { b.restore(a.snapshot(), current); expect(be).toEqual([]); }
    }
    expect(starts).toBeGreaterThan(10);
  });
});
