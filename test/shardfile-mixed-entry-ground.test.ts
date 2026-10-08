// oxlint-disable-next-line import/no-nodejs-modules -- Compile the committed bounded lift fixture.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit the exact immutable WASM identity.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { liftShard } from './fixtures/socket-lift/shard';
import { loadRapier } from '../src/engine/physics/rapier';
import { floorBelow } from '../src/engine/physics/query';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { proveShardfileEntries } from '../src/game/shardfile/socketLiftProof';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let bytes = new Uint8Array(), rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  bytes = Uint8Array.from(await compileScript(readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8'), { maximumPages: 2 }));
  rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
});
function fixture() {
  const hash = createHash('sha256').update(bytes).digest('hex'), shard = liftShard(bytes, hash);
  if (shard.props === null) throw new Error('Missing fixture island');
  // The three plain entries depend on implicit ground, not authored stand-in road boxes.
  shard.props.colliders = shard.props.colliders.filter(row => row.id === 'island');
  return { shard, assets: new Map([[hash, bytes]]) };
}
describe('mixed lift and plain entry worlds', () => {
  it('walks three plain edges and boards a flush lift in a separate ground-free proof world', () => {
    const { shard, assets } = fixture(), sim = createShardfileSim(shard, assets, { rapier, groundResolution: 257 });
    try {
      expect(floorBelow(sim.host.physics, 100, 100, 1, 2)).toBeCloseTo(0, 6);
      expect(proveShardfileEntries(shard, sim, assets, { rapier, groundResolution: 257 })).toMatchObject({ lanes: 92, liftRides: 2, liftCalls: 2 });
    } finally { sim.dispose(); }
  });
  it('honours the proof override without removing the actual declared deck', () => {
    const { shard, assets } = fixture(), sim = createShardfileSim(shard, assets, { rapier, ground: false });
    try {
      expect(floorBelow(sim.host.physics, 100, 100, 1, 2)).toBeUndefined();
      expect(floorBelow(sim.host.physics, 0, 230, 1, 2)).toBeCloseTo(0, 6);
    } finally { sim.dispose(); }
  });
});
