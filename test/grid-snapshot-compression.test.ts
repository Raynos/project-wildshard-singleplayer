// oxlint-disable-next-line import/no-nodejs-modules -- Test the shipped full template and exact native regional collider snapshots.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot, restoreSimHost, SIM_REGION_SNAPSHOT_CHAR_BUDGET } from '../src/engine/sim/snapshot';
import { generatePlatform } from '../src/engine/sim/strips';
import { GridAssembly } from '../src/game/grid/assembly';
import { createShardfileSim, bindShardfileSim } from '../src/game/shardfile/simulation';
import source from '../src/shards/_template/shard.config';
import { expectSameSimSnapshot } from './fake/simSnapshot';

it('fits the production eight-duplicate regional continuation without dropping geometry or future sim state', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  const quest = { fact: () => undefined, coins: () => undefined };
  const sim = createShardfileSim(source, assets, { rapier, quest });
  let restored: ReturnType<typeof restoreSimHost> | undefined;
  try {
    const assembly = new GridAssembly({ developer: false, devserver: false });
    const standaloneBytes = sim.host.physics.snapshot().length;
    const cells = assembly.cells.map((cell) => ({ ...cell, edges: source.edge }));
    const strips = generatePlatform(cells, assembly.emptyNeighbour.edge);
    let count = 0;
    for (const strip of strips) for (const duplicate of strip.duplicates) if (duplicate.instance === 'template-2') { installStripCollider(sim.host.physics, duplicate.mesh, sim.host.scope); count++; }
    expect(count).toBe(8);
    const basis = sim.host.physics.snapshot();
    expect(basis.length).toBeGreaterThan(standaloneBytes);
    for (let tick = 0; tick < 12; tick++) sim.host.step();
    const saved = snapshotSimHost(sim.host), text = serializeSimSnapshot(saved, basis);
    expect(text.length).toBeLessThan(SIM_REGION_SNAPSHOT_CHAR_BUDGET);
    const decoded = decodeSimSnapshot(text, basis); expect(decoded).toEqual(saved);
    restored = restoreSimHost(sim.host.level, { rapier }, decoded, (host) => { bindShardfileSim(host, source, assets, { rapier, quest, restoring: true }); });
    for (let tick = 0; tick < 30; tick++) { sim.host.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
  } finally { restored?.dispose(); sim.dispose(); }
}, 60_000); // Complete production Rapier BVHs plus exact restore/suffix verification on the CI runner.
