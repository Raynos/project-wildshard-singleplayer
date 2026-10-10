// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping roster law.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep its provenance fail-closed.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { Rng } from '../../../src/engine/core/rng';
import { variantMods } from '../../../src/engine/entities/species/registry';
import { GHOSTRIDER_SPECIES } from '../../../src/shards/nalati-grasslands/species/ghostRider';
import { GhostRosterKeeper, type GhostRosterPorts } from '../../../src/shards/nalati-grasslands/runtime/ghostRosterKeeper';
import { GhostRosterOracle, type Rider, type Line } from '../../fixtures/nalati-ghost-roster-oracle/shipping';
import bodies from '../../fixtures/nalati-ghost-roster-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-ghost-roster-oracle/source.json' with { type: 'json' };

function fixture() {
  const species = GHOSTRIDER_SPECIES, variant = species.variants.find(row => row.id === 'rider');
  if (variant === undefined) throw new Error('Missing actual ghost rider row');
  const rig = species.build(variant, new Rng(9101)), spec = { kind: species.kind, label: variant.label, variant: variant.id,
    rarity: variant.rarity, hp: variant.hp ?? 70, aggressive: true, dims: rig.dims, mods: variantMods(species, variant) };
  for (const geometry of [...rig.furParts, ...rig.hardParts, ...rig.eyeParts]) geometry.dispose();
  const player = { position: new Vector3() }, rng = new Rng(19001), riders: Rider[] = [], lines: Line[] = [], all: Rider[] = [], events: unknown[][] = [];
  const modes: { mode: 'patrol' | 'engage' }[] = [];
  let phase = 'night', next = 0, spawnCount = 0;
  const spawnLine = (): void => {
    spawnCount++; events.push(['spawn']); const mode: { mode: 'patrol' | 'engage' } = { mode: 'engage' }, line: Line = { riders: [] };
    modes.push(mode);
    for (let i = 0; i < 3; i++) {
      const a = Object.assign(new AnimalSim(spec, 0.5, 1, `creature:${String(next++)}`, { heightAt: () => 27, random: () => 0.5 }), { hidden: false });
      a.place(15 + i * 9, 27, -20);
      const row: Rider = { a, line: mode, quiet: spawnCount === 2 && i === 1, fade: 0, fadeTarget: 1, dying: 0,
        fireT: 2 + rng.next() * 2.5, dead: false, mats: [] };
      riders.push(row); all.push(row); line.riders.push(row);
    }
    lines.push(line);
  };
  const ports: GhostRosterPorts<typeof all[number]['a']> = { player, phase: () => phase, riders, lines, hidden: a => a.hidden,
    random: () => rng.next(), spawnLine, steer: () => undefined,
    // The separate volley keeper owns its exact two-draw solve; this clock owner only schedules it.
    shoot: r => { events.push(['shoot', r.a.entityId, rng.next(), rng.next()]); },
    retire: r => { r.a.hidden = true; events.push(['retire', r.a.entityId]); },
    killed: (a, count) => { events.push(['kill', a.entityId, count]); }, arrows: dt => { events.push(['arrows', dt]); } };
  return { player, rng, riders, lines, all, modes, events, spawnLine, ports, keeper: new GhostRosterKeeper(ports), oracle: new GhostRosterOracle(ports, riders, lines),
    phase: (value: string): void => { phase = value; }, spawnCount: () => spawnCount };
}
function oldState(f: ReturnType<typeof fixture>) {
  const o = f.oracle;
  return { version: 1, hold: o.hold, freeze: o.freeze, killsTonight: o.killsTonight, respawnT: o.respawnT,
    riders: f.riders.map(r => ({ id: r.a.entityId, quiet: r.quiet, fade: r.fade, fadeTarget: r.fadeTarget, dying: r.dying, fireT: r.fireT, dead: r.dead })),
    lines: f.lines.map(line => line.riders.map(r => ({ id: r.a.entityId, dead: r.dead }))) };
}
function scenario(f: ReturnType<typeof fixture>, tick: number, old: boolean): void {
  const control = old ? f.oracle : f.keeper;
  control.hold = tick >= 10 && tick < 70; control.freeze = tick >= 90 && tick < 110;
  f.player.position.set(tick % 250 < 100 ? 15 : tick % 250 < 150 ? 1000 : 40, 27, -20);
  for (const mode of f.modes) mode.mode = tick % 250 < 220 ? 'engage' : 'patrol';
  if (tick === 120) f.riders[0]?.a.applyDamage(100_000, new Vector3(), new Vector3());
  if (tick === 200 || tick === 4050) for (const r of f.riders) r.a.applyDamage(100_000, new Vector3(), new Vector3());
  if (tick === 4300) { f.phase('day'); control.dawn(); }
  if (tick === 4500) { f.phase('night'); control.night(); }
  if (tick === 4700) { const a = f.riders[0]?.a; if (a !== undefined) control.dissolve(a); }
}

it('matches attach/nightfall, hold/freeze, reverse deaths, fades, quiet volleys and the real 60-second replacement clock', () => {
  const frozen = readFileSync('test/fixtures/nalati-ghost-roster-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-ghost-roster-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = fixture(), b = fixture(); a.keeper.attach(); b.oracle.attach();
  for (let tick = 0; tick < 4800; tick++) {
    scenario(a, tick, false); scenario(b, tick, true);
    const dt = tick % 11 === 0 ? 1 / 30 : 1 / 60;
    a.keeper.update(dt); b.oracle.update(dt, tick / 60);
    expect(a.events).toEqual(b.events); a.events.length = 0; b.events.length = 0;
    if (tick % 20 === 0) {
      expect(a.keeper.snapshot()).toEqual(oldState(b)); expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
      expect(a.all.map(r => r.a.snapshot())).toEqual(b.all.map(r => r.a.snapshot()));
    }
  }
  expect(a.spawnCount()).toBe(3); expect(a.keeper.living()).toBe(2);
});

it('restores a partially retired line without callbacks, then continues the identical death/respawn suffix', () => {
  const a = fixture(), b = fixture();
  a.spawnLine(); b.spawnLine();
  const firstA = a.riders[0], firstB = b.riders[0]; if (firstA === undefined || firstB === undefined) throw new Error('Missing first rider');
  firstA.a.applyDamage(100_000, new Vector3(), new Vector3()); firstB.a.applyDamage(100_000, new Vector3(), new Vector3());
  for (let tick = 0; tick < 100; tick++) { a.keeper.update(1 / 60); b.keeper.update(1 / 60); }
  expect(a.riders).toHaveLength(2); expect(a.lines[0]?.riders).toHaveLength(3);
  const saved = a.keeper.snapshot();
  for (const r of b.all) { r.fade = 0; r.fireT = 0; r.dead = false; }
  b.keeper.hold = true; b.keeper.freeze = true;
  const rng = b.rng.snapshot(), before = b.all.map(r => r.a.snapshot()); b.events.length = 0;
  b.keeper.restore(saved);
  expect(b.events).toEqual([]); expect(b.rng.snapshot()).toEqual(rng); expect(b.all.map(r => r.a.snapshot())).toEqual(before);
  expect(firstB.dead).toBe(true); expect(b.keeper.snapshot()).toEqual(saved);
  a.events.length = 0;
  for (let tick = 0; tick < 4100; tick++) {
    if (tick === 15) for (const f of [a, b]) for (const r of f.riders) r.a.applyDamage(100_000, new Vector3(), new Vector3());
    a.keeper.update(1 / 60); b.keeper.update(1 / 60);
    expect(b.events).toEqual(a.events); a.events.length = 0; b.events.length = 0;
    if (tick % 20 === 0) { expect(b.keeper.snapshot()).toEqual(a.keeper.snapshot()); expect(b.rng.snapshot()).toEqual(a.rng.snapshot()); }
  }
  expect(a.spawnCount()).toBe(2); expect(b.spawnCount()).toBe(2);
});

it('rejects malformed identities and contradictory active/line death flags before mutation', () => {
  const f = fixture(); f.spawnLine(); const saved = f.keeper.snapshot();
  for (const bad of [{ ...saved, extra: true }, { ...saved, version: 2 }, { ...saved, killsTonight: -1 }, { ...saved, respawnT: Infinity },
    { ...saved, riders: saved.riders.map(r => ({ ...r, id: 'duplicate' })) }, { ...saved, riders: saved.riders.slice(1) },
    { ...saved, riders: saved.riders.map(r => ({ ...r, quiet: !r.quiet })) }, { ...saved, lines: [] },
    { ...saved, lines: saved.lines.map(line => line.map(r => ({ ...r, dead: true }))) }]) {
    expect(() => { f.keeper.restore(bad); }).toThrow(); expect(f.keeper.snapshot()).toEqual(saved);
  }
  expect(f.events).toEqual([['spawn']]);
});
