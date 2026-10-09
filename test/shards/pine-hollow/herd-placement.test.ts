// oxlint-disable-next-line import/no-nodejs-modules -- Place Pine's herds in plain Node under the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The trusted bake is read from the test checkout.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

// SF72: Pine Hollow's herd placement runs renderer-free and reproduces the page's. The creature manager's stream
// (Rng(1337 + 31)) through the hunting brain's recipe (HuntBrain.placeHerds, spawnRolls, adopt) over the baked ground
// (runtime/herds.ts: the terrain grid the page installs, the analytic trails / pads / water, the baked forest trunks) and
// the shard's one fauna plan (runtime/fauna.ts) must roll every body's kind, variant, scale and seed exactly as the trusted
// browser bake recorded them (runtime/physics.baked.json `actors`), herd by herd. The one roll the page then retires is the
// Den's rolled 'black-old' bear: combat/elites.ts swaps a rolled elite variant for an ordinary one (its replacement draws
// next on the same stream and is the bake's last herd body; that swap belongs to the elites' headless script).
// The kit's plain species rows stand in for Pine's (same weighted variants, in order) until the brain takes a species port.
it('rolls the page\'s 160 herd bodies in plain Node from the baked ground and the fauna plan', () => {
  const script = `const { readFileSync } = await import('node:fs');
const { HuntBrain, spawnRolls } = await import('./src/engine/ai/hunt.ts');
const { Rng } = await import('./src/engine/core/rng.ts');
const { setSpeciesResolver } = await import('./src/engine/entities/species/registry.ts');
const { parseBakedTerrain } = await import('./src/engine/world/BakedTerrain.ts');
const { DEER } = await import('./src/game/systems/species/deer.ts');
const { ELK } = await import('./src/game/systems/species/elk.ts');
const { BOAR } = await import('./src/game/systems/species/boar.ts');
const { BEAR } = await import('./src/game/systems/species/bear.ts');
const { PINE_FAUNA } = await import('./src/shards/pine-hollow/runtime/fauna.ts');
const { SPAWN } = await import('./src/shards/pine-hollow/layout.ts');
const { pineHuntGround, PINE_HERD_STREAM } = await import('./src/shards/pine-hollow/runtime/herds.ts');
const { Vector3 } = await import('three');
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');
const rows = new Map([DEER, ELK, BOAR, BEAR].map((row) => [row.kind, row])); setSpeciesResolver((kind) => rows.get(kind));
const bytes = readFileSync('public/assets/baked/pine-hollow/terrain.bin'), grid = parseBakedTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
if (grid === null) throw new Error('terrain.bin');
const rng = new Rng(PINE_HERD_STREAM), rolled = [];
const ports = { ground: pineHuntGround(grid), nav: () => null, reach: () => true, wanderGoal: () => null, unaware: () => false, now: () => 0, sound: () => {}, charge: () => {} };
const brain = new HuntBrain({ rng, fight: { telegraphed: false }, faunaTuning: () => undefined }, ports, new Vector3());
for (const _ of brain.placeHerds(PINE_FAUNA, SPAWN, (kind, x, z, yaw, variants) => {
  const r = spawnRolls(rng, kind, variants, rolled.some((a) => a.kind === kind && a.rarity === 'legendary'));
  const a = { kind, variant: r.variant.id, rarity: r.variant.rarity, scale: r.scale, seed: r.seed, position: { x, z }, herd: -1 };
  brain.adopt(a, x, z); rolled.push(a); return a;
})) { /* each herd */ }
console.log(JSON.stringify({ rolled: rolled.map(({ kind, variant, scale, seed, herd }) => ({ kind, variant, scale, seed, herd })), herds: brain.herds.map((h) => h.members.length) }));`;
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const out = JSON.parse(result.stdout) as { rolled: { kind: string; variant: string; scale: number; seed: number; herd: number }[]; herds: number[] };
  const bake = JSON.parse(readFileSync('src/shards/pine-hollow/runtime/physics.baked.json', 'utf8')) as
    { actors: { kind: string; variant: string; scale: number; seed: number; herd: number; scripted: boolean }[]; herds: { members: string[] }[] };
  const page = bake.actors.filter(a => !a.scripted).map(({ kind, variant, scale, seed, herd }) => ({ kind, variant, scale, seed, herd }));
  expect(out.rolled).toHaveLength(160); expect(out.herds).toEqual(bake.herds.map(h => h.members.length));
  const retired = out.rolled.findIndex(a => a.kind === 'bear' && a.variant === 'black-old');
  expect(retired).toBeGreaterThanOrEqual(0); expect(out.rolled.filter(a => a.variant === 'black-old')).toHaveLength(1);
  // every roll the page kept, in its own order, bit for bit; the elite swap's replacement is the page's last body
  expect(out.rolled.filter((_, i) => i !== retired)).toEqual(page.slice(0, 159));
  expect(page[159]).toMatchObject({ kind: 'bear', herd: out.rolled[retired]?.herd });
});
