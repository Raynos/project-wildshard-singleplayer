// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping decisions.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the source-body inventory.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { variantMods } from '../../../src/engine/entities/species/registry';
import { Rng } from '../../../src/engine/core/rng';
import { EAGLE_SPECIES } from '../../../src/shards/nalati-grasslands/species/eagle';
import { QyranKeeper, type QyranPorts } from '../../../src/shards/nalati-grasslands/runtime/qyranKeeper';
import { QyranOracle } from '../../fixtures/nalati-qyran-oracle/shipping';
import bodies from '../../fixtures/nalati-qyran-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-qyran-oracle/source.json' with { type: 'json' };

function fixture() {
  const variant = EAGLE_SPECIES.variants.find(row => row.id === 'qyran');
  if (variant === undefined) throw new Error('Missing shipping Storm-Wing species');
  const hp = variant.hp, aggressive = EAGLE_SPECIES.aggressive;
  if (hp === undefined || aggressive === undefined) throw new Error('Incomplete shipping Storm-Wing species');
  // Read the actual authored rig dimensions; no renderer is constructed. Native deferred admission is a later slice.
  const rig = EAGLE_SPECIES.build(variant, new Rng(144));
  const dims = rig.dims;
  for (const part of [...rig.furParts, ...rig.hardParts, ...rig.eyeParts]) part.dispose();
  const heightAt = (x: number, z: number): number => x > 12 && z < -8 ? 30 : 0;
  const actor = new AnimalSim({ kind: 'eagle', label: variant.label, variant: variant.id, rarity: variant.rarity,
    hp, dims, mods: variantMods(EAGLE_SPECIES, variant), aggressive },
    0.4, 3, 'creature:qyran', { heightAt, random: () => 0.5 });
  const rng = new Rng(13709), player = { position: new Vector3() }, wind = { x: 0.2, z: -0.1 }, events: unknown[][] = [];
  let phase2 = false;
  const head = new Vector3();
  const ports: QyranPorts<AnimalSim> = { player, rock: { x: 0, z: 0, top: 50 }, phase2: () => phase2,
    heightAt, wind: () => wind, random: () => rng.next(), isHead: (a, p) => a.headWorld(head).distanceTo(p) < a.dims.headRadius * a.scale + 0.12,
    tell: { setTime: t => { events.push(['time', t]); }, aim: (from, to, alpha) => { events.push(['aim', ...from, ...to, alpha]); },
      hide: () => { events.push(['hide']); }, chevron: p => { events.push(p === null ? ['chevron', null] : ['chevron', ...p]); } },
    hurt: (_a, amount) => { events.push(['hurt', amount]); }, knock: (x, z) => { events.push(['knock', x, z]); },
    feed: text => { events.push(['feed', text]); }, sound: (cue, at) => { events.push(['sound', cue, ...at]); },
    signature: () => { events.push(['signature']); } };
  return { actor, player, wind, rng, events, ports, phase: (on: boolean): void => { phase2 = on; } };
}

it('matches the shipping orbit, tells, hit/miss stoops and phase-two cooldown with actual eagle state', () => {
  const frozen = readFileSync('test/fixtures/nalati-qyran-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-qyran-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = fixture(), b = fixture(), keeper = new QyranKeeper(a.ports), old = new QyranOracle(b.ports, b.actor);
  a.actor.place(26, 0, 0); keeper.spawned(a.actor); old.spawn();
  const states = new Set<string>(), outputs = new Set<string>(), damage = new Set<number>();
  let time = 0, dives = 0, previous = 'soar';
  for (let tick = 0; tick < 2400; tick++) {
    const dt = tick % 7 === 0 ? 1 / 30 : 1 / 60; time += dt;
    if (tick === 1100) { a.phase(true); b.phase(true); }
    const state = keeper.snapshot().st;
    if (state === 'stoop' && previous !== 'stoop') dives++;
    previous = state;
    for (const f of [a, b]) {
      // Dodge every second stoop after its target is fixed; other stoops reach the real hurt/knock path.
      const dodge = dives > 0 && dives % 2 === 0 && state === 'stoop';
      f.player.position.set(dodge ? -30 : 0, 0, dodge ? 30 : 0);
      f.wind.x = Math.sin(time * 0.3) * 0.5; f.wind.z = Math.cos(time * 0.2) * 0.4;
    }
    keeper.tick(a.actor, dt, time, tick < 2100, tick >= 2100); old.tick(dt, time, tick < 2100, tick >= 2100);
    keeper.think(a.actor, { player: a.player.position }); old.think(b.actor, { player: b.player.position });
    a.actor.step(dt); b.actor.step(dt);
    states.add(keeper.snapshot().st);
    for (const event of a.events) { if (typeof event[0] === 'string') outputs.add(`${event[0]}:${String(event[1])}`); }
    expect(a.events).toEqual(b.events); a.events.length = 0; b.events.length = 0;
    if (tick % 20 === 0) {
      expect(keeper.snapshot()).toEqual(old.snapshot()); expect(a.actor.snapshot()).toEqual(b.actor.snapshot()); expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
      const head = a.actor.headWorld(new Vector3()), flank = new Vector3(a.actor.position.x + 5, a.actor.position.y, a.actor.position.z);
      for (const point of [head, flank]) { damage.add(keeper.damage(a.actor, point)); expect(keeper.damage(a.actor, point)).toBe(old.damage(b.actor, point)); }
    }
  }
  expect(states).toEqual(new Set(['soar', 'tell', 'stoop', 'climb', 'ground']));
  expect(outputs.has('hurt:30')).toBe(true); expect(outputs.has('feed:Qyran is GROUNDED')).toBe(true);
  expect(damage).toEqual(new Set([1, 2.5]));
});

it('restores the fixed stoop target, orbit and cooldown without draws and refuses malformed state before mutation', () => {
  const a = fixture(), b = fixture(), keeper = new QyranKeeper(a.ports), restored = new QyranKeeper(b.ports);
  a.actor.place(26, 0, 0); keeper.spawned(a.actor);
  let tick = 0;
  while (keeper.snapshot().st !== 'stoop' && tick < 700) { keeper.tick(a.actor, 1 / 60, tick / 60, true, false); a.actor.step(1 / 60); tick++; }
  expect(keeper.snapshot().st).toBe('stoop');
  const saved = keeper.snapshot(), before = b.rng.snapshot(); restored.restore(saved); expect(b.rng.snapshot()).toEqual(before);
  b.actor.restore(a.actor.snapshot()); b.rng.restore(a.rng.snapshot()); a.events.length = 0;
  for (let i = 0; i < 600; i++) {
    for (const f of [a, b]) { f.player.position.set(-30, 0, 30); }
    keeper.tick(a.actor, 1 / 60, (tick + i) / 60, true, false); restored.tick(b.actor, 1 / 60, (tick + i) / 60, true, false);
    a.actor.step(1 / 60); b.actor.step(1 / 60);
    expect(restored.snapshot()).toEqual(keeper.snapshot()); expect(b.actor.snapshot()).toEqual(a.actor.snapshot());
    expect(b.rng.snapshot()).toEqual(a.rng.snapshot()); expect(b.events).toEqual(a.events); a.events.length = 0; b.events.length = 0;
  }
  for (const invalid of [{ ...saved, extra: 1 }, { ...saved, st: 'fake' }, { ...saved, ang: Infinity }, { ...saved, centre: [0, Number.NaN, 0] }, { ...saved, tgt: [0, 0] }]) {
    const current = restored.snapshot(); expect(() => restored.restore(invalid)).toThrow(); expect(restored.snapshot()).toEqual(current);
  }
  keeper.reset(); expect(keeper.snapshot().st).toBe('climb'); keeper.disposeTell();
  expect(a.events.slice(-2)).toEqual([['hide'], ['chevron', null]]);
});
