// oxlint-disable-next-line import/no-nodejs-modules -- Native ownership tests use the actual shipped Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { HuntBrain, type HuntBody } from '../src/engine/ai/hunt';
import { NativeManager } from '../src/game/population/nativeManager';
import { BOAR } from '../src/game/systems/species/boar';
import { Vector3 } from 'three';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { createNativeCreatureRoster } from '../src/game/shardfile/homeKeeper';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test('native replacement retains the recipe slot, herd/identity order and six spawn draws', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }), rng = new Rng(53), control = new Rng(53);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing real native recipe');
  const order: string[] = [], rows: { members: HuntBody[] }[] = [{ members: [] }];
  const hunt = { herds: rows, addHerd: (kind: string, x: number, z: number): number => {
    expect(kind).toBe(sample.spec.kind); expect([x, z]).toEqual([8, 8]); order.push('herd'); rows.push({ members: [] }); return rows.length - 1;
  }, adopt: (): void => { order.push('adopt'); }, forget: (actor: HuntBody): void => {
    expect(host.entities.has(actor.entityId)).toBe(true); order.push(`retire:${actor.entityId}`);
  } };
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec],
    variants: new Map([[sample.spec.kind, [{ id: sample.spec.variant, scale: [1, 2] as const }]]]),
    rng, hunt, hunted: 'every', spawnY: 10, attackTurnCap: 1 });
  try {
    const body: Parameters<typeof intake.arrive>[0] = intake.body('old', sample.spec.kind, sample.spec.variant, 0, { x: 8, z: 8 }, 0);
    intake.arrive(body); const original = body.actor, recipe = body.recipe; order.length = 0;
    const joined = intake.refill(body, () => {
      expect(rows[0]?.members).toContain(original); expect(body.actor).toBeNull(); expect(host.entities.has('old')).toBe(false); order.push('allocate'); return 'next';
    }, { x: 8, z: 8 });
    expect(order).toEqual(['retire:old', 'allocate', 'herd']); expect(rows[1]?.members).toContain(joined); expect(joined).toBe(body.actor);
    expect(body.recipe).toBe(recipe); expect(body.id).toBe('next'); expect(recipe.id).toBe('next');
    expect(rows[0]?.members).toEqual([]); expect(rows[1]?.members).toEqual([body.actor]); expect(body.actor).not.toBe(original);
    const scale = control.range(1, 2); control.next(); const seed = control.next(); control.next(); control.next(); control.next();
    expect([recipe.scale, recipe.seed]).toEqual([scale, seed]); expect(rng.snapshot()).toEqual(control.snapshot());
    const before = rng.snapshot(), actor = body.actor; order.length = 0;
    expect(() => intake.retire({ ...body })).toThrow('Foreign');
    expect(() => intake.refill(body, () => 'bad', { x: Infinity, z: 0 })).toThrow('Invalid');
    expect(order).toEqual([]); expect(body.actor).toBe(actor); expect(rng.snapshot()).toEqual(before);
    expect(intake.retireDead('missing')).toBeNull(); expect(intake.retireDead('next')).toBeNull(); expect(body.actor).toBe(actor);
    if (actor === null) throw new Error('Missing replacement actor'); actor.alive = false;
    expect(intake.retireDead('next')).toBe(body); expect(body.actor).toBeNull(); expect(rows[1]?.members).toEqual([]); expect(host.entities.has('next')).toBe(false);
    expect(() => intake.retire(body)).toThrow('Foreign'); expect(rng.snapshot()).toEqual(before);
  } finally { host.dispose(); }
});

test('native continuation resolves real identities and preserves detached ordered state', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }), rng = new Rng(71);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native recipe');
  const hunt = new HuntBrain<HuntBody>({ rng, fight: {}, faunaTuning: () => undefined, species: () => BOAR }, {
    ground: { heightAt: () => 0, normalY: () => 1, trailDistance: () => Infinity, cabinMask: () => 0,
      inChunk: () => true, streamAt: () => null, waterLevel: () => -20, pond: () => null, sea: () => false,
      wetAt: () => false, trees: () => [], treeless: () => true, terrain: () => true, chunkHalf: 16 },
    nav: () => null, reach: () => true, wanderGoal: () => null, unaware: () => false,
    now: () => 0, sound: () => undefined, charge: () => undefined,
  }, host.player.position);
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map(), rng, hunt, hunted: 'every', spawnY: 10 });
  try {
    const body = intake.body('first', sample.spec.kind, sample.spec.variant, 0, { x: 2, z: 3 }, 0, [1, 1]);
    const actor = intake.arrive(body); intake.remember(body);
    const memory = hunt.memory(actor);
    if (memory === undefined) throw new Error('Missing adopted memory');
    memory.path = [new Vector3(2, 0, 3)];
    const manager = new NativeManager(host, hunt, rng, { limit: 2, sightSlots: 2, initialSight: null });
    manager.advance(0.125); manager.sight[1] = true; manager.noise.prev.set(4, 0, 8);
    const saved = manager.snapshot([null, 'first'], ['first']), stream = rng.snapshot();
    expect(saved.memories[0]).toBeNull(); expect(saved.memories[1]?.['path']).toEqual([[2, 0, 3]]);
    memory.path[0]?.set(8, 0, 9); rng.next(); manager.advance(0.25); manager.noise.prev.set(0, 0, 0);
    manager.restore(saved, [null, 'first'], ['first']);
    expect(manager.snapshot([null, 'first'], ['first'])).toEqual(saved);
    expect(rng.snapshot()).toEqual(stream); expect(memory.path[0]).toEqual(new Vector3(2, 0, 3));
    expect(() => manager.restore(saved, [null, 'foreign'], ['foreign'])).toThrow('Foreign');
    expect(() => manager.restore(saved, ['first', 'first'], ['first'])).toThrow('roster');
    expect(() => manager.restore(saved, [null, 'first'], ['missing'])).toThrow('roster');
    expect(manager.snapshot([null, 'first'], ['first'])).toEqual(saved); expect(rng.snapshot()).toEqual(stream);
    expect([...host.entities.keys()]).toEqual(['first']);
  } finally { host.dispose(); }
});
