// oxlint-disable-next-line import/no-nodejs-modules -- Regression consumes the exact already-built Colossus product and native physics.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { borrowedDecisionAuthority } from '../src/game/shardfile/borrowedDecisions';
import { TIDAL_GIANTS_SPECIES } from '../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const savedControl = v.object({ decision: v.string(), strike: v.object({ phase: v.string() }) });
const savedDecision = v.object({ decision: v.object({ bindings: v.array(v.object({ pending: v.array(v.array(v.number())) })) }) });
function decisionQueue(value: unknown): number[][] {
  const control = v.parse(savedControl, JSON.parse(v.parse(v.string(), value)));
  return v.parse(savedDecision, JSON.parse(control.decision)).decision.bindings.flatMap(row => row.pending);
}
const productRoot = 'tmp/colossus-native-preview/motion1-build1/product';
async function fixture(mode: 'former-alive-gate' | 'retained-body') {
  const product = await loadHeadlessProduct(productRoot), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing exact product descriptor');
  expect(descriptor.index.build.sourceHash).toBe('7a4c5bc237574a93d7b5b6f3325a53cf0141054aafc86082f497baff24d905a5');
  const assets = new Map(descriptor.index.files.map(file => [file.hash, Uint8Array.from(readFileSync(`${productRoot}/${file.path}`))]));
  const base = SIM_LEVEL.entities[0], species = TIDAL_GIANTS_SPECIES.find(row => row.kind === 'tideRootColossus');
  if (base === undefined || species?.brain === undefined) throw new Error('Missing body/decision fixture');
  const host = createSimHost({ ...SIM_LEVEL, quests: [], entities: [{ id: 'practice.tideRootColossus', seed: 7001, scale: 1,
    at: { x: 0, y: 0, z: 5 }, yaw: Math.PI, spec: { ...base.spec, kind: 'tideRootColossus', hp: 480 } }] },
    { rapier: await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))) });
  const actor = host.entities.get('practice.tideRootColossus'); if (actor === undefined) throw new Error('No actual actor');
  const scope = host.scope.child('isolated-bout');
  const authority = borrowedDecisionAuthority(product.shardfile, assets, descriptor.sections, { scope, events: host.events,
    flags: host.flags, physics: host.physics, player: host.player, groundHeightAt: (x, z) => host.groundHeightAt(x, z),
    live: body => mode === 'former-alive-gate' ? body.alive && !scope.disposed : host.entities.get(body.entityId) === body && !scope.disposed,
    fixed: (id, run, fixedScope) => { fixedScope.onDispose(host.onStep(id, () => {
      if (mode === 'retained-body' || actor.alive) run();
    })); },
  });
  let strikeHits = 0;
  const control = authority.bind(actor, species.brain.data, species.body);
  control.observe({ calm: false, reach: () => true, claim: () => true, hurt: () => { strikeHits++; } });
  control.fighting = true;
  const events: { kind: string; target: string; amount?: number }[] = [];
  host.events.on('damage.dealt', ({ req, dealt }) => { events.push({ kind: 'hit', target: req.target.id, amount: dealt }); }, scope);
  host.events.on('actor.died', ({ actor: target }) => { events.push({ kind: 'death', target: target.id }); }, scope);
  const observations: { hp: number; alive: boolean; stage: number | undefined; snapshot: unknown }[] = [];
  const step = (count = 12) => { for (let i = 0; i < count; i++) { host.step(); observations.push({ hp: actor.hp, alive: actor.alive, stage: actor.mem['tg-state'], snapshot: control.snapshot() }); } };
  const hit = (target: typeof host.player.health | ReturnType<typeof actor.combatActor>, amount: number) => {
    host.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target, amount, point: new Vector3(), dir: new Vector3(0, 0, 1) });
    host.events.flush('update');
  };
  step();
  return { host, actor, scope, control, events, observations, step, hit, strikeHits: () => strikeHits };
}

test('borrowed Colossus ignores player hit and death subjects', async () => {
  const f = await fixture('retained-body');
  try {
    f.hit(f.host.player.health, 5); const nonlethalQueue = decisionQueue(f.control.snapshot()); f.step();
    expect(f.actor.hp).toBe(480); expect(f.actor.alive).toBe(true);
    f.hit(f.host.player.health, 1000); const lethalQueue = decisionQueue(f.control.snapshot()); f.control.observe({ calm: true, reach: () => true, claim: () => true, hurt: () => undefined }); writeFileSync('tmp/colossus-player-subject-queue.json', JSON.stringify(f.control.snapshot())); f.step(); writeFileSync('tmp/colossus-player-subject-steps.json', JSON.stringify({ events: f.events, nonlethalQueue, lethalQueue, observations: f.observations }));
    expect(f.events.map(row => [row.kind, row.target])).toContainEqual(['hit', f.host.player.id]);
    expect(f.events.map(row => [row.kind, row.target])).toContainEqual(['death', f.host.player.id]);
    expect.soft(nonlethalQueue.filter(row => row[0] === 7), 'Player hit must not enter the borrowed actor guest').toEqual([]);
    expect.soft(lethalQueue.filter(row => row[0] === 7 || row[0] === 9), 'Player lethal hit/death must not enter the borrowed actor guest').toEqual([]);
    expect(f.observations.some(row => row.stage === 6), JSON.stringify({ actor: f.actor.entityId, player: f.host.player.id, events: f.events, stages: f.observations.map(row => row.stage) })).toBe(false);
  } finally { f.host.dispose(); }
});

for (const mode of ['former-alive-gate', 'retained-body'] as const) test(mode === 'former-alive-gate' ? 'former alive-gate scheduler demonstrably strands own death (negative characterization)' : 'retained-body delivers own death, suppresses strikes and retires fixed callbacks', async () => {
  const f = await fixture(mode);
  try {
    f.hit(f.actor.combatActor(), 1000); f.step();
    expect(f.events.map(row => [row.kind, row.target])).toContainEqual(['hit', f.actor.entityId]);
    expect(f.events.map(row => [row.kind, row.target])).toContainEqual(['death', f.actor.entityId]);
    expect(f.actor.alive).toBe(false);
    if (mode === 'former-alive-gate') {
      expect(f.actor.mem['tg-state']).not.toBe(6);
      expect(decisionQueue(f.control.snapshot()).some(row => row[0] === 9)).toBe(true);
      return;
    }
    expect(f.actor.mem['tg-state'], JSON.stringify({ mode, actor: f.actor.entityId, events: f.events, memory: f.actor.mem })).toBe(6);
    expect(f.actor.mem['tg-awake']).toBe(0);
    const hits = f.strikeHits(); f.step(180); expect(f.strikeHits()).toBe(hits);
    const saved = v.parse(savedControl, JSON.parse(v.parse(v.string(), f.control.snapshot()))); expect(saved.strike.phase).toBe('idle');
    expect(f.host.hasStep('decision:driftwood.colossus')).toBe(true);
    f.scope.dispose(); expect(f.host.hasStep('decision:driftwood.colossus')).toBe(false);
    const memory = { ...f.actor.mem }; f.step(30); expect(f.actor.mem).toEqual(memory);
  } finally { f.host.dispose(); }
});


test('production practice source retains dead membership and drains fixed decisions after applied events', () => {
  const source = readFileSync('src/game/practice/PracticeCreature.ts', 'utf8');
  expect(source).toContain('live: body => !scope.disposed && this.targets.some(target => target === body)');
  const update = source.slice(source.indexOf('  update(dt: number): void {'), source.indexOf('  land(hard: boolean): void {'));
  expect(update).toContain('if (this.decision !== undefined) {');
  expect(update).not.toContain('this.decision !== undefined && animal.alive');
  expect(update).toContain('if (animal.alive) callbacks.act(animal, context);');
  const flush = update.indexOf("this.events?.flush('update');"), fixed = update.indexOf('for (const run of this.fixed) run();');
  expect(flush).toBeGreaterThanOrEqual(0); expect(fixed).toBeGreaterThan(flush);
  expect(source).toContain('fixedScope.onDispose(() => { this.fixed.delete(run); })');
});
