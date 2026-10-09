// oxlint-disable-next-line import/no-nodejs-modules -- Import the hunting brain in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

// SF72: the herds' hunting brain and placement recipe (src/engine/ai/hunt.ts) load and run in plain Node under the loader
// that refuses renderer modules: a trusted headless host places a shard's herds over native bodies from the level seed.
it('places herds over native bodies and thinks from a host\'s own species rows in plain Node, no DOM or renderer modules', () => {
  const script = `const { HuntBrain } = await import('./src/engine/ai/hunt.ts');
const { AnimalSim } = await import('./src/engine/entities/AnimalSim.ts');
const { Rng } = await import('./src/engine/core/rng.ts');
const { Vector3 } = await import('three');
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');
const ground = { heightAt: () => 0, normalY: () => 1, trailDistance: () => 30, cabinMask: () => 0, inChunk: (x, z, m) => Math.abs(x) < 250 - m && Math.abs(z) < 250 - m,
  streamAt: () => null, waterLevel: () => -10, pond: () => null, sea: () => false, wetAt: () => false, trees: () => [], treeless: () => true, terrain: () => true, chunkHalf: 250 };
const ports = { ground, nav: () => null, reach: () => true, wanderGoal: () => null, unaware: () => false, now: () => 0, sound: () => {}, charge: () => {} };
const dims = { bodyY: 1, bodyHalfLen: 0.8, bodyRadius: 0.4, headRadius: 0.2, legLen: 0.6, feet: [], halfWidth: 0.3 };
const mods = { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 10, relentless: false };
const place = (seed) => {
  const brain = new HuntBrain({ rng: new Rng(seed), fight: {}, faunaTuning: () => undefined }, ports, new Vector3());
  const plan = [{ kind: 'deer', count: 4, canopy: false, trailBand: [20, 40] }, { kind: 'boar', count: 3, canopy: false, trailBand: [20, 40] }];
  const out = [];
  for (const _ of brain.placeHerds(plan, { x: 0, z: 0 }, (kind, x, z, yaw) => {
    const a = Object.assign(new AnimalSim({ kind, label: kind, variant: kind, rarity: 'common', hp: 60, aggressive: false, dims, mods }, 0.5, 1, kind + out.length, { heightAt: () => 0, random: () => 0.5 }), { hidden: false, sampleTerrain() {} });
    a.place(x, z, yaw, 0); out.push([kind, x, z, yaw]); return a;
  })) { /* each herd */ }
  return { herds: brain.herds.map((h) => [h.kind, h.cx, h.cz, h.members.length]), out };
};
const a = place(31), b = place(31);
if (JSON.stringify(a) !== JSON.stringify(b) || a.herds.length !== 2 || a.out.length !== 7) throw new Error('placement ' + JSON.stringify(a));
// HuntConfig.species: the brain reads a renderer-free host's own data rows (no looks, no global registry)
const { BOAR } = await import('./src/game/systems/species/boar.ts');
const { DEER } = await import('./src/game/systems/species/deer.ts');
const rows = { boar: BOAR, deer: DEER };
const think = (species) => {
  const player = new Vector3(6, 0, 0), brain = new HuntBrain({ rng: new Rng(7), fight: {}, faunaTuning: () => undefined, ...(species ? { species } : {}) }, ports, player);
  const boar = Object.assign(new AnimalSim({ kind: 'boar', label: 'Boar', variant: 'boar', rarity: 'common', hp: 100, aggressive: true, dims, mods }, 0.5, 1, 'boar0', { heightAt: () => 0, random: () => 0.5 }), { hidden: false, sampleTerrain() {} });
  boar.place(0, 0, 0, 0); brain.adopt(boar, 0, 0);
  for (let i = 0; i < 600; i++) { player.x = 6 - i * 0.005; brain.think(boar, 0.1, player, false, 4.3); boar.step(0.1); }
  return boar.state;
};
think((kind) => rows[kind]);
let refused = false; try { think(undefined); } catch (error) { refused = String(error).includes('unknown animal kind'); }
if (!refused) throw new Error('the default resolver is the global registry');`;
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
