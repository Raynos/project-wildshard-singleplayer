// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping method inventory.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the oracle's provenance fail-closed.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { Rng } from '../../../src/engine/core/rng';
import { variantMods, type VariantDef } from '../../../src/engine/entities/species/registry';
import { GHOSTRIDER_SPECIES } from '../../../src/shards/nalati-grasslands/species/ghostRider';
import { eliteRuleHolds } from '../../../src/shards/nalati-grasslands/combat/eliteRoster';
import { QaraKeeper, type QaraPorts } from '../../../src/shards/nalati-grasslands/runtime/qaraKeeper';
import { QaraOracle } from '../../fixtures/nalati-qara-oracle/shipping';
import bodies from '../../fixtures/nalati-qara-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-qara-oracle/source.json' with { type: 'json' };

function fixture() {
  const species = GHOSTRIDER_SPECIES, captain = species.variants.find(v => v.id === 'captain'), rider = species.variants.find(v => v.id === 'rider');
  if (captain === undefined || rider === undefined) throw new Error('missing actual ghost rows');
  const make = (variant: VariantDef, id: string): AnimalSim => {
    const model = species.build(variant, new Rng(19001));
    const actor = new AnimalSim({ kind: species.kind, variant: variant.id, label: variant.label || species.label, rarity: variant.rarity,
      hp: variant.hp ?? 70, aggressive: true, dims: model.dims, mods: variantMods(species, variant) }, 0.25, variant.scale[0], id,
    { heightAt: () => 0, random: () => 0.5 });
    for (const part of [...model.furParts, ...model.hardParts, ...model.eyeParts]) part.dispose();
    return actor;
  };
  const actor = make(captain, 'captain'), members = Array.from({ length: 9 }, (_, i) => make(rider, `rider:${String(i)}`));
  const player = { position: new Vector3() }, events: unknown[][] = [];
  let phase2 = false, kills = 4, next = 0;
  const ports: QaraPorts<AnimalSim> = { player, lair: { x: -100, z: 0 }, awareRadius: 90, phase2: () => phase2, heightAt: () => 0,
    crew: { get killsTonight() { return kills; }, spawnLine: count => {
      const line = members.slice(next, next + count); if (line.length !== count) throw new Error('fixture line exhausted');
      next += count; events.push(['line', count, ...line.map(a => a.entityId)]); return line;
    }, dissolve: a => { a.alive = false; events.push(['dissolve', a.entityId]); } }, resolve: id => members.find(a => a.entityId === id) ?? null,
    lane: { setTime: t => { events.push(['time', t]); }, hide: () => { events.push(['hide']); },
      lane: (x0, z0, x1, z1, width, alpha) => { events.push(['lane', x0, z0, x1, z1, width, alpha]); } },
    hurt: (_a, amount) => { events.push(['hurt', amount]); }, knock: (x, z) => { events.push(['knock', x, z]); },
    feed: text => { events.push(['feed', text]); }, sound: (cue, point) => { events.push(['sound', cue, ...point]); },
    signature: () => { events.push(['signature']); } };
  return { actor, members, player, ports, events, phase: (on: boolean): void => { phase2 = on; }, kills: (n: number): void => { kills = n; },
    crewState: () => ({ kills, next }), restoreCrew: (state: { kills: number; next: number }): void => { kills = state.kills; next = state.next; } };
}

it('matches the shipping five-kill night gate, charge lane, grounded contact, missed opening and paired-charge law', () => {
  const frozen = readFileSync('test/fixtures/nalati-qara-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-qara-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = fixture(), b = fixture(), keeper = new QaraKeeper(a.ports), old = new QaraOracle(b.ports, b.actor);
  expect(keeper.canSpawn()).toBe(false); expect(old.canSpawn()).toBe(false);
  a.kills(5); b.kills(5); expect(keeper.canSpawn()).toBe(true); expect(old.canSpawn()).toBe(true);
  expect(eliteRuleHolds('night', 'day', false)).toBe(false); expect(eliteRuleHolds('night', 'dusk', false)).toBe(false);
  expect(eliteRuleHolds('night', 'night', false)).toBe(true);
  const fallback = new QaraKeeper({ ...a.ports, crew: null }); expect(fallback.canSpawn()).toBe(true);
  const states = new Set(['wait']), outputs = new Set<string>();
  let time = 0;
  for (let tick = 0; tick < 2400; tick++) {
    const dt = tick % 7 === 0 ? 1 / 30 : 1 / 60; time += dt;
    const cycle = tick % 800, arm = Math.floor(tick / 800);
    if (cycle === 0) {
      a.actor.place(-100, 0, 0); b.actor.place(-100, 0, 0); a.phase(arm === 2); b.phase(arm === 2); keeper.spawned(); old.spawned();
    }
    for (const f of [a, b]) {
      f.player.position.set(0, arm === 1 ? 3 : 0, 0);
      if (arm === 0 && keeper.snapshot().st === 'charge') f.player.position.copy(f.actor.position);
    }
    keeper.tick(a.actor, dt, time, cycle >= 10 && cycle < 650, cycle >= 650); old.tick(dt, time, cycle >= 10 && cycle < 650, cycle >= 650);
    if (tick % 6 === 0) { keeper.think(a.actor, { player: a.player.position }); old.think(b.actor, { player: b.player.position }); }
    a.actor.step(dt); b.actor.step(dt);
    states.add(keeper.snapshot().st);
    for (const event of a.events) if (typeof event[0] === 'string') outputs.add(`${event[0]}:${String(event[1])}`);
    expect(a.events).toEqual(b.events); a.events.length = 0; b.events.length = 0;
    if (tick % 20 === 0) {
      expect(keeper.snapshot()).toEqual(old.snapshot()); expect(a.actor.snapshot()).toEqual(b.actor.snapshot());
      for (const point of [a.player.position, new Vector3(20, 0, 20)]) expect(keeper.damage(a.actor, point)).toBe(old.damage(b.actor, point));
    }
  }
  expect(states).toEqual(new Set(['wait', 'circle', 'wheel', 'charge', 'open', 'home']));
  expect(outputs.has('hurt:38')).toBe(true); expect(outputs.has('feed:He passes — his back is OPEN')).toBe(true);
  expect(outputs.has('line:3')).toBe(true); expect(outputs.has('sound:horse_squeal')).toBe(true);
});

it('restores a wheel with the exact living/dead companion identities and suffix; invalid states never mutate the keeper', () => {
  const a = fixture(), b = fixture(), keeper = new QaraKeeper(a.ports), restored = new QaraKeeper(b.ports);
  a.actor.place(-22, 0, 0); keeper.spawned();
  for (let tick = 0; tick < 190; tick++) keeper.tick(a.actor, 1 / 60, tick / 60, true, false);
  a.members[0]?.applyDamage(100_000, new Vector3(), new Vector3());
  const saved = keeper.snapshot(); expect(saved.st).toBe('wheel'); expect(saved.line).toEqual(['rider:0', 'rider:1', 'rider:2']);
  b.actor.restore(a.actor.snapshot()); a.members.forEach((body, i) => { b.members[i]?.restore(body.snapshot()); }); b.restoreCrew(a.crewState());
  restored.restore(saved); expect(b.events).toEqual([]); a.events.length = 0;
  for (let tick = 0; tick < 600; tick++) {
    const dt = tick % 7 === 0 ? 1 / 30 : 1 / 60;
    keeper.tick(a.actor, dt, (190 + tick) / 60, true, false); restored.tick(b.actor, dt, (190 + tick) / 60, true, false);
    keeper.think(a.actor, { player: a.player.position }); restored.think(b.actor, { player: b.player.position });
    a.actor.step(dt); b.actor.step(dt);
    expect(restored.snapshot()).toEqual(keeper.snapshot()); expect(b.actor.snapshot()).toEqual(a.actor.snapshot());
    expect(b.events).toEqual(a.events); a.events.length = 0; b.events.length = 0;
  }
  for (const invalid of [{ ...saved, extra: 1 }, { ...saved, st: 'fake' }, { ...saved, pairs: 2 }, { ...saved, chargeT: Number.NaN },
    { ...saved, line: ['missing'] }, { ...saved, line: ['rider:0', 'rider:0'] }]) {
    const before = restored.snapshot(); expect(() => restored.restore(invalid)).toThrow(); expect(restored.snapshot()).toEqual(before);
  }
  keeper.disposeLine(); restored.disposeLine();
  expect(a.events).toEqual([['hide'], ['dissolve', 'rider:1'], ['dissolve', 'rider:2']]); expect(b.events).toEqual(a.events);
  expect(keeper.snapshot().line).toEqual([]); expect(restored.snapshot().line).toEqual([]);
});
