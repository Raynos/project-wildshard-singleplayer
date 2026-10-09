// oxlint-disable-next-line import/no-nodejs-modules -- Place Pine's herds in plain Node under the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The trusted bake is read from the test checkout.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

interface Row { id: string; kind: string; variant: string; scale: number; seed: number; herd: number }

// SF72: Pine Hollow's boot roster runs renderer-free and reproduces the page's, id for id. The creature manager's stream
// (Rng(1337 + 31)) through the hunting brain's recipe (HuntBrain.placeHerds, spawnRolls, adopt) over the baked ground
// (runtime/herds.ts: the terrain grid the page installs, the analytic trails / pads / water, the baked forest trunks), the
// shard's one fauna plan (runtime/fauna.ts) and Pine's own creature rows (`pineSpawnSpecies`, through spawnRolls' species
// seam: no global registry) must roll every body's kind, variant, scale and seed exactly as the trusted browser bake
// recorded them (runtime/physics.baked.json), in the page's allocation order:
//   creature:0-159   the herds (the Den's rolled 'black-old' bear is creature:157);
//   creature:160     its ordinary replacement (combat/eliteRoster.ts swapRolledElites: one Old Blackpaw, at his lair);
//   creature:161-163 the Antler King's prewarm: his body, an elk thrall and a boar thrall, parked (bake `parked`);
//   creature:164-167 the four lair elites (Elites.initialize, in PINE_ELITE_DEFS order).
it('rolls the page\'s boot roster (herds, elite swap, King prewarm, lair elites) id for id in plain Node', () => {
  const script = `const { readFileSync } = await import('node:fs');
const { HuntBrain, spawnRolls } = await import('./src/engine/ai/hunt.ts');
const { Rng } = await import('./src/engine/core/rng.ts');
const { parseBakedTerrain } = await import('./src/engine/world/BakedTerrain.ts');
const { PINE_FAUNA } = await import('./src/shards/pine-hollow/runtime/fauna.ts');
const { SPAWN } = await import('./src/shards/pine-hollow/layout.ts');
const { pineHuntGround, pineSpawnSpecies, PINE_HERD_STREAM, PINE_KING_KIND } = await import('./src/shards/pine-hollow/runtime/herds.ts');
const { PINE_ELITE_DEFS, PINE_ELITE_ANIMALS, swapRolledElites } = await import('./src/shards/pine-hollow/combat/eliteRoster.ts');
const { Vector3 } = await import('three');
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');
const bake = JSON.parse(readFileSync('src/shards/pine-hollow/runtime/physics.baked.json', 'utf8'));
const king = bake.parked[0];
const species = pineSpawnSpecies({ id: king.variant, label: 'The Antler King', weight: 1, rarity: 'legendary', scale: [king.scale, king.scale] });
const bytes = readFileSync('public/assets/baked/pine-hollow/terrain.bin'), grid = parseBakedTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
if (grid === null) throw new Error('terrain.bin');
const rng = new Rng(PINE_HERD_STREAM), live = [], all = [];
const ports = { ground: pineHuntGround(grid), nav: () => null, reach: () => true, wanderGoal: () => null, unaware: () => false, now: () => 0, sound: () => {}, charge: () => {} };
const brain = new HuntBrain({ rng, fight: { telegraphed: false }, faunaTuning: () => undefined, species }, ports, new Vector3());
const spawn = (kind, x, z, yaw, variants) => {
  const r = spawnRolls(rng, kind, variants, live.some((a) => a.kind === kind && a.rarity === 'legendary'), species);
  const a = { id: 'creature:' + all.length, kind, variant: r.variant.id, rarity: r.variant.rarity, scale: r.scale, seed: r.seed, position: { x, z }, yaw, herd: -1 };
  brain.adopt(a, x, z); live.push(a); all.push(a); return a;
};
for (const _ of brain.placeHerds(PINE_FAUNA, SPAWN, spawn)) { /* each herd */ }
const swapped = swapRolledElites({ bodies: live, herds: brain.herds, retire: (a) => { live.splice(live.indexOf(a), 1); }, spawn });
const prewarm = [spawn(PINE_KING_KIND, 0, 0, 0, king.variant), spawn('elk', 0, 0, 0, 'thrall'), spawn('boar', 0, 0, 0, 'thrall')];
const elites = Object.keys(PINE_ELITE_DEFS).map((id) => { const e = PINE_ELITE_ANIMALS[id]; return spawn(e.kind, 0, 0, 0, e.variant); });
const row = ({ id, kind, variant, scale, seed, herd }) => ({ id, kind, variant, scale, seed, herd });
console.log(JSON.stringify({ swapped, herdBodies: live.filter((a) => a.herd >= 0).map(row), prewarm: prewarm.map(row), elites: elites.map(row), herds: brain.herds.map((h) => h.members.map((m) => m.id)) }));`;
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const out = JSON.parse(result.stdout) as { swapped: number; herdBodies: Row[]; prewarm: Row[]; elites: Row[]; herds: string[][] };
  const bake = JSON.parse(readFileSync('src/shards/pine-hollow/runtime/physics.baked.json', 'utf8')) as
    { actors: (Row & { scripted: boolean })[]; parked: (Omit<Row, 'herd'> & { spec: unknown })[]; herds: { members: string[] }[] };
  const row = ({ id, kind, variant, scale, seed, herd }: Row): Row => ({ id, kind, variant, scale, seed, herd });
  const page = bake.actors.filter(a => !a.scripted).map(row), lairs = bake.actors.filter(a => a.scripted).map(row);
  expect(out.swapped).toBe(1);
  // every herd body the page kept, its replacement included, bit for bit and under the same ids; every herd's members
  expect(out.herdBodies).toEqual(page); expect(page).toHaveLength(160); expect(page.at(-1)).toMatchObject({ id: 'creature:160', kind: 'bear' });
  expect(out.herds).toEqual(bake.herds.map(h => h.members));
  // the King's prewarm, then the lair elites
  expect(out.prewarm.map(({ herd: _herd, ...rest }) => rest)).toEqual(bake.parked.map(({ id, kind, variant, scale, seed }) => ({ id, kind, variant, scale, seed })));
  expect(out.elites.map(({ herd: _herd, ...rest }) => rest)).toEqual(lairs.map(({ herd: _herd, ...rest }) => rest));
  expect(lairs.map(a => a.id)).toEqual(['creature:164', 'creature:165', 'creature:166', 'creature:167']);
});
