// oxlint-disable-next-line import/no-nodejs-modules -- Native ownership tests use the actual shipped Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { createNativeCreatureRoster } from '../src/game/shardfile/homeKeeper';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test('native replacement retains the recipe slot, herd/identity order and six spawn draws', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }), rng = new Rng(53), control = new Rng(53);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing real native recipe');
  const order: string[] = [], rows: { members: AnimalSim[] }[] = [{ members: [] }];
  const herds = { herds: rows, addHerd: (kind: string, x: number, z: number): number => {
    expect(kind).toBe(sample.spec.kind); expect([x, z]).toEqual([8, 8]); order.push('herd'); rows.push({ members: [] }); return rows.length - 1;
  } };
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec],
    variants: new Map([[sample.spec.kind, [{ id: sample.spec.variant, scale: [1, 2] as const }]]]),
    rng, herds, spawnY: 10, attackTurnCap: 1, attach: native => { order.push('attach'); return native; },
    joined: (body, actor) => { expect(rows[body.herd]?.members).toContain(actor); order.push('join'); },
    retired: body => { expect(host.entities.has(body.id)).toBe(false); expect(intake.byId.has(body.id)).toBe(false); order.push(`retire:${body.id}`); } });
  try {
    const body: Parameters<typeof intake.arrive>[0] = intake.body('old', sample.spec.kind, sample.spec.variant, 0, { x: 8, z: 8 }, 0);
    intake.arrive(body); const original = body.actor, recipe = body.recipe; order.length = 0;
    intake.refill(body, () => {
      expect(rows[0]?.members).toContain(original); expect(body.actor).toBeNull(); order.push('allocate'); return 'next';
    }, { x: 8, z: 8 });
    expect(order).toEqual(['retire:old', 'allocate', 'herd', 'attach', 'join']);
    expect(body.recipe).toBe(recipe); expect(body.id).toBe('next'); expect(recipe.id).toBe('next');
    expect(rows[0]?.members).toEqual([]); expect(rows[1]?.members).toEqual([body.actor]); expect(body.actor).not.toBe(original);
    const scale = control.range(1, 2); control.next(); const seed = control.next(); control.next(); control.next(); control.next();
    expect([recipe.scale, recipe.seed]).toEqual([scale, seed]); expect(rng.snapshot()).toEqual(control.snapshot());
    const before = rng.snapshot(), actor = body.actor; order.length = 0;
    expect(() => intake.retire({ ...body })).toThrow('Foreign');
    expect(() => intake.refill(body, () => 'bad', { x: Infinity, z: 0 })).toThrow('Invalid');
    expect(order).toEqual([]); expect(body.actor).toBe(actor); expect(rng.snapshot()).toEqual(before);
    intake.retireDead('missing'); intake.retireDead('next'); expect(body.actor).toBe(actor);
    if (actor === null) throw new Error('Missing replacement actor'); actor.alive = false;
    intake.retireDead('next'); expect(body.actor).toBeNull(); expect(rows[1]?.members).toEqual([]); expect(host.entities.has('next')).toBe(false);
    expect(() => intake.retire(body)).toThrow('Foreign'); expect(rng.snapshot()).toEqual(before);
  } finally { host.dispose(); }
});
