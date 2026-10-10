// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping scalar law.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Preserve its fail-closed provenance.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { Rng } from '../../../src/engine/core/rng';
import { variantMods } from '../../../src/engine/entities/species/registry';
import { GHOSTRIDER_SPECIES } from '../../../src/shards/nalati-grasslands/species/ghostRider';
import { GhostVolleyKeeper, type GhostVolleyPorts } from '../../../src/shards/nalati-grasslands/runtime/ghostVolleyKeeper';
import { GhostVolleyOracle } from '../../fixtures/nalati-ghost-volley-oracle/shipping';
import bodies from '../../fixtures/nalati-ghost-volley-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-ghost-volley-oracle/source.json' with { type: 'json' };

function fixture() {
  const species = GHOSTRIDER_SPECIES, variant = species.variants.find(row => row.id === 'rider');
  if (variant === undefined) throw new Error('Missing actual ghost rider row');
  const rig = species.build(variant, new Rng(7101));
  const actors = [0, 1].map(i => new AnimalSim({ kind: species.kind, label: variant.label, variant: variant.id, rarity: variant.rarity,
    hp: variant.hp ?? 70, aggressive: true, dims: rig.dims, mods: variantMods(species, variant) }, 0.41, 1 + i * 0.12, `creature:${String(i)}`,
  { heightAt: () => 27, random: () => 0.5 }));
  for (const geometry of [...rig.furParts, ...rig.hardParts, ...rig.eyeParts]) geometry.dispose();
  actors.forEach((a, i) => { a.place(15 + i * 7, 27, -13); });
  const player = { position: new Vector3() }, rng = new Rng(19317), launches: { origin: number[]; velocity: number[] }[] = [];
  let draws = 0, borrowed: Vector3 | null = null, seatCalls = 0;
  const ports: GhostVolleyPorts<AnimalSim> = { player, random: () => { draws++; return rng.next(); },
    // The solver receives a published socket. Collision pose/socket publication is a separate owner, never replaced by this fixture.
    seat: (a, out) => { seatCalls++; out.copy(a.position).add(new Vector3(0.3, 1.8, -0.2)); },
    launch: (origin, velocity) => { if (borrowed !== null) expect(origin).toBe(borrowed); borrowed = origin;
      launches.push({ origin: origin.toArray(), velocity: velocity.toArray() }); },
    resolve: id => actors.find(a => a.entityId === id) ?? null };
  return { actors, player, rng, launches, ports, keeper: new GhostVolleyKeeper(ports), oracle: new GhostVolleyOracle(ports),
    draws: () => draws, seatCalls: () => seatCalls };
}
function input(f: ReturnType<typeof fixture>, tick: number): void {
  const period = tick % 400;
  // Includes moving lead, a teleport (>20 m/s), vertical velocity, unreachable ballistic targets and coincident x/z.
  if (period < 100) f.player.position.set(45 + period / 10, 28 + period / 100, 30);
  else if (period < 200) f.player.position.set(2000, 500, 1700);
  else if (period < 300) f.player.position.set(15, 90, -13);
  else f.player.position.set(45 - (period - 300) / 12, 27, 30);
}
function state(f: ReturnType<typeof fixture>) {
  const old = f.oracle;
  return { version: 1, lastPlayer: old.lastPlayer.toArray(), playerVelocity: old.playerVel.toArray(), shooter: old.shooter?.entityId ?? null };
}

it('matches the shipping velocity clamp, ballistic fallback, shoulder scale and exact two-draw spread', () => {
  const frozen = readFileSync('test/fixtures/nalati-ghost-volley-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-ghost-volley-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const current = fixture(), old = fixture();
  for (let tick = 0; tick < 2400; tick++) {
    input(current, tick); input(old, tick);
    const dt = tick % 31 === 0 ? 0 : tick % 17 === 0 ? -1 / 60 : tick % 7 === 0 ? 1 / 30 : 1 / 60;
    current.keeper.update(dt); old.oracle.update(dt);
    const a = current.actors[tick % 2], b = old.actors[tick % 2];
    if (a === undefined || b === undefined) throw new Error('Missing real shooter');
    current.keeper.shoot(a); old.oracle.shoot({ a: b });
    expect(current.launches.at(-1)).toEqual(old.launches.at(-1));
    expect(current.keeper.snapshot()).toEqual(state(old));
    expect(current.rng.snapshot()).toEqual(old.rng.snapshot());
  }
  expect(current.draws()).toBe(4800); expect(current.seatCalls()).toBe(2400);
});

it('continues the lead history and retired last shooter exactly; restoring does not launch or consume RNG', () => {
  const a = fixture(), b = fixture(), first = a.actors[0], restored = b.actors[0];
  if (first === undefined || restored === undefined) throw new Error('Missing real shooter');
  for (let tick = 0; tick < 89; tick++) { input(a, tick); a.keeper.update(1 / 60); }
  a.keeper.shoot(first); first.alive = false; restored.alive = false;
  const saved = a.keeper.snapshot(), rng = b.rng.snapshot(), actor = restored.snapshot();
  b.keeper.restore(saved);
  expect(b.keeper.lastShooter).toBe(restored); expect(restored.snapshot()).toEqual(actor);
  expect(b.rng.snapshot()).toEqual(rng); expect(b.launches).toEqual([]); expect(b.seatCalls()).toBe(0);
  b.rng.restore(a.rng.snapshot());
  for (let tick = 89; tick < 1000; tick++) {
    input(a, tick); input(b, tick); a.keeper.update(1 / 60); b.keeper.update(1 / 60);
    const left = a.actors[tick % 2], right = b.actors[tick % 2];
    if (left === undefined || right === undefined) throw new Error('Missing restored shooter');
    if (tick % 3 === 0) { a.keeper.shoot(left); b.keeper.shoot(right); expect(b.launches.at(-1)).toEqual(a.launches.at(-1)); }
    expect(b.keeper.snapshot()).toEqual(a.keeper.snapshot()); expect(b.rng.snapshot()).toEqual(a.rng.snapshot());
  }
});

it('refuses malformed history or missing/mismatched shooter identity before changing its continuation', () => {
  const f = fixture(), a = f.actors[0]; if (a === undefined) throw new Error('Missing shooter');
  f.keeper.shoot(a); const saved = f.keeper.snapshot();
  for (const bad of [{ ...saved, extra: true }, { ...saved, version: 2 }, { ...saved, shooter: 'missing' },
    { ...saved, lastPlayer: [0, 0] }, { ...saved, playerVelocity: [0, Number.NaN, 0] }, { ...saved, lastPlayer: [Infinity, 0, 0] }]) {
    expect(() => { f.keeper.restore(bad); }).toThrow(); expect(f.keeper.snapshot()).toEqual(saved);
  }
  const mismatch = new GhostVolleyKeeper({ ...f.ports, resolve: () => a });
  expect(() => { mismatch.restore({ ...saved, shooter: 'different' }); }).toThrow();
  expect(mismatch.snapshot().shooter).toBeNull();
});
