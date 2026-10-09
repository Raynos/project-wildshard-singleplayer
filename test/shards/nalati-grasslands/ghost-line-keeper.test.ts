// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the shipping method inventory.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the oracle's fail-closed provenance.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { Rng } from '../../../src/engine/core/rng';
import { variantMods } from '../../../src/engine/entities/species/registry';
import { GHOSTRIDER_SPECIES } from '../../../src/shards/nalati-grasslands/species/ghostRider';
import { GhostLineKeeper, thinkGhostBody, type GhostLine } from '../../../src/shards/nalati-grasslands/runtime/ghostLineKeeper';
import { GhostLineOracle, ridgeAt, nearestS, farthestS, thinkGhost } from '../../fixtures/nalati-ghost-line-oracle/shipping';
import bodies from '../../fixtures/nalati-ghost-line-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-ghost-line-oracle/source.json' with { type: 'json' };

function fixture() {
  const species = GHOSTRIDER_SPECIES, variant = species.variants.find(v => v.id === 'rider');
  if (variant === undefined) throw new Error('Missing real ghost rider row');
  const rig = species.build(variant, new Rng(919));
  const dims = rig.dims;
  for (const part of [...rig.furParts, ...rig.hardParts, ...rig.eyeParts]) part.dispose();
  const riders = Array.from({ length: 3 }, (_, slot) => {
    const a = new AnimalSim({ kind: species.kind, variant: variant.id, label: variant.label, rarity: variant.rarity,
      hp: variant.hp ?? 70, aggressive: true, dims, mods: variantMods(species, variant) }, 0.37 + slot * 0.1, 1, `ghost:${String(slot)}`,
    { heightAt: () => 27, random: () => 0.5 });
    a.place(174 - slot * 8, 27, 24); return { a, slot, dead: false };
  });
  const line: GhostLine<AnimalSim> = { riders, s: 10, mode: 'patrol', theta: 0, dir: -1, engagedT: 0 };
  const player = { position: new Vector3(0, 27, 24) };
  return { riders, line, player, keeper: new GhostLineKeeper(line, player), old: new GhostLineOracle({ player }) };
}
function oldState(f: ReturnType<typeof fixture>) {
  const l = f.line; return { s: l.s, mode: l.mode, theta: l.theta, dir: l.dir, engagedT: l.engagedT,
    riders: l.riders.map(r => ({ id: r.a.entityId, slot: r.slot, dead: r.dead })) };
}
function movePlayer(f: ReturnType<typeof fixture>, tick: number): void {
  const lead = f.riders.find(r => !r.dead);
  if (tick < 400 || (tick >= 2400 && tick < 3000)) f.player.position.set(0, 27, -300);
  else if (lead !== undefined) f.player.position.copy(lead.a.position).add(new Vector3(25, 0, 0));
  if (tick >= 1100 && tick < 1700) f.player.position.y = 18;
  if (tick === 2000 || tick === 3900) {
    for (const r of tick === 2000 ? f.riders.slice(0, 1) : f.riders) { r.dead = true; r.a.applyDamage(100_000, new Vector3(), new Vector3()); }
  }
}

it('matches the exact authored ridge, plateau engage/disengage, lead death and actual ghost-species steering', () => {
  const frozen = readFileSync('test/fixtures/nalati-ghost-line-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-ghost-line-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = fixture(), b = fixture(), point = new Vector3(), oldPoint = new Vector3(), states = new Set<string>(), speeds = new Set<number>();
  for (let i = -100; i < 300; i++) {
    expect(a.keeper.ridgeAt(i * 17.2, point)).toEqual(ridgeAt(i * 17.2, oldPoint));
    const x = Math.sin(i) * 220, z = Math.cos(i) * 100;
    expect(a.keeper.nearestS(x, z)).toBe(nearestS(x, z)); a.player.position.set(x, 27, z);
    expect(a.keeper.farthestS()).toBe(farthestS(a.player.position));
  }
  for (const f of [a, b]) f.player.position.set(0, 27, 24);
  // The species also runs before a puppet has a target: preserve its no-motion branch.
  for (const r of a.riders) thinkGhostBody(r.a, { player: a.player.position });
  for (const r of b.riders) thinkGhost(r.a, { player: b.player.position });
  for (let tick = 0; tick < 4200; tick++) {
    movePlayer(a, tick); movePlayer(b, tick);
    const dt = tick % 7 === 0 ? 1 / 30 : 1 / 60;
    a.keeper.step(dt); b.old.steerLine(b.line, dt); states.add(a.line.mode);
    for (let i = 0; i < 3; i++) {
      const ar = a.riders[i], br = b.riders[i]; if (ar === undefined || br === undefined) throw new Error('Missing actual rider');
      if (!ar.dead) { thinkGhostBody(ar.a, { player: a.player.position }); thinkGhost(br.a, { player: b.player.position }); }
      ar.a.step(dt); br.a.step(dt);
      if (ar.a.mem['v'] !== undefined) speeds.add(ar.a.mem['v']);
      if (tick % 20 === 0) expect(ar.a.snapshot()).toEqual(br.a.snapshot());
    }
    if (tick % 20 === 0) expect(a.keeper.snapshot()).toEqual(oldState(b));
  }
  expect(states).toEqual(new Set(['patrol', 'engage'])); expect(speeds).toEqual(new Set([8.5, 11.5]));
  expect(a.riders.every(r => r.dead)).toBe(true);
});

it('restores the exact line phase and rider identities without changing bodies; malformed identities refuse atomically', () => {
  const a = fixture(), b = fixture();
  const step = (f: ReturnType<typeof fixture>, tick: number): void => {
    movePlayer(f, tick); f.keeper.step(1 / 60);
    for (const r of f.riders) { if (!r.dead) thinkGhostBody(r.a, { player: f.player.position }); r.a.step(1 / 60); }
  };
  for (let tick = 0; tick < 650; tick++) step(a, tick);
  const saved = a.keeper.snapshot(); expect(saved.mode).toBe('engage');
  const before = b.riders.map(r => r.a.snapshot()); b.keeper.restore(saved);
  expect(b.riders.map(r => r.a.snapshot())).toEqual(before);
  a.riders.forEach((r, i) => { b.riders[i]?.a.restore(r.a.snapshot()); }); b.player.position.copy(a.player.position);
  for (let tick = 650; tick < 2600; tick++) {
    step(a, tick); step(b, tick);
    expect(b.keeper.snapshot()).toEqual(a.keeper.snapshot());
    if (tick % 20 === 0) expect(b.riders.map(r => r.a.snapshot())).toEqual(a.riders.map(r => r.a.snapshot()));
  }
  for (const bad of [{ ...saved, extra: 1 }, { ...saved, theta: Infinity }, { ...saved, dir: 0 }, { ...saved, mode: 'fake' },
    { ...saved, riders: saved.riders.slice(1) }, { ...saved, riders: saved.riders.map((r, i) => ({ id: i === 0 ? 'missing' : r.id, slot: r.slot, dead: r.dead })) },
    { ...saved, riders: saved.riders.map((r, i) => ({ id: r.id, slot: i === 0 ? 1 : r.slot, dead: r.dead })) }]) {
    const unchanged = b.keeper.snapshot(); expect(() => b.keeper.restore(bad)).toThrow(); expect(b.keeper.snapshot()).toEqual(unchanged);
  }
  expect(() => new GhostLineKeeper({ ...a.line, riders: [a.riders[0], a.riders[0]].filter(r => r !== undefined) }, a.player)).toThrow();
});
