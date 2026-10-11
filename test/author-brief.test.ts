// oxlint-disable-next-line import/no-nodejs-modules -- Retained AssemblyScript is the fixture's author source.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { mesaProofExample } from './fixtures/author-mesa';
import { proveMesaOutpost } from '../scripts/docs/author-project/prove-mesa';
import { proveMesaNative, proveEquippedItemClient } from '../src/sdk/headless';

const plan = { goats: ['goat.0', 'goat.1', 'goat.2'] as const, hawk: 'hawk.0', beacon: 'beacon', beaconField: 'door.open', route: [] };
const absentPage = { evaluate: <T>(read: () => T): Promise<T> => Promise.resolve(read()) };
function product() { return mesaProofExample(readFileSync('test/fixtures/sdk-authored-world/door.as', 'utf8')); }
it('proves real goat flight, a diving landed hawk strike, reachable beacon state and an exact native suffix', async () => {
  const { shard, assets } = await product(), report = await proveMesaNative(shard, assets, { ...plan, route: Array.from({ length: 12 }, () => []) });
  expect(report.goats).toHaveLength(3); expect(report.goats.every(row => row.displacement > 10 && row.distance > 15)).toBe(true);
  expect(report.hawk.hit).toBe(true); expect(report.hawk.minimumHealth).toBeLessThan(report.hawk.initialHealth);
  expect(report.beacon.lit).toBe(true); expect(report.replay).toMatchObject({ suffixTicks: 30, exact: true });
}, 30_000);
it('refuses absent identities and a real occluding wall instead of passing declarations', async () => {
  const { shard, assets } = await product();
  await expect(proveMesaNative(shard, assets, { ...plan, hawk: 'missing' })).rejects.toThrow('required Mesa species');
  shard.props = { version: 1, family: 'toon', panels: [], models: [], tiles: [], textures: [], far: null,
    colliders: [{ id: 'wall', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 1.68, z: 0.5, hx: 3, hy: 2, hz: 0.05 }] }] };
  await expect(proveMesaNative(shard, assets, plan)).rejects.toThrow('reachable beacon interaction');
}, 15_000);
it('refuses an idle hawk even when every required creature is declared', async () => {
  const { shard, assets } = await product(); const brain = shard.creatures.brains[0]; if (brain?.kind !== 'diver') throw new Error('Fixture lacks diver'); brain.noticeRadius = 1;
  await expect(proveMesaNative(shard, assets, plan)).rejects.toThrow('Hawk dive and landed native attack');
}, 30_000);
it('requires the exact commons loadout and every charged catalogue byte before client proof', async () => {
  const { shard, assets } = await product(); shard.items.loadout.primary = null;
  await expect(proveMesaOutpost(shard, assets, absentPage, plan)).rejects.toThrow('exact commons spear');
  shard.items.loadout.primary = 'weapon.spear'; assets.delete(`commons:${shard.requires.commons[0]}`);
  await expect(proveMesaOutpost(shard, assets, absentPage, plan)).rejects.toThrow('catalogue closure');
  await expect(proveEquippedItemClient(absentPage, 'weapon.spear', 'missing')).rejects.toThrow();
});

it('rejects a route that pre-lights the beacon instead of proving the required gated interaction', async () => {
  const { shard, assets } = await product();
  await expect(proveMesaNative(shard, assets, { ...plan, route: [[{ kind: 'interact', id: 'beacon' }]] })).rejects.toThrow('before its required interaction');
}, 15_000);

it('refuses a timer-only light that coincides with the interaction window', async () => {
  const source = readFileSync('test/fixtures/sdk-authored-world/door.as', 'utf8')
    .replace('if (count === 1)', 'if (ticks === 2)').replace('store<f64>(24592, open)', 'count = 1; store<f64>(24592, 1)');
  const { shard, assets } = await mesaProofExample(source);
  await expect(proveMesaNative(shard, assets, plan)).rejects.toThrow('without its required interaction');
}, 15_000);
