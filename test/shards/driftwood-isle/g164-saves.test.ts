// SHARD-PLATFORM SF46 (G164 details, council C3-R2-C3): G164 bumps Driftwood's shardfile revision. A continuation saved
// before it (revision 1, the undropped world) restores through the approved logical migration: progress kept, held /
// pending actions dropped, the player at the (lowered) spawn, never refused; one saved at the current revision restores
// exactly. Shard-local poses ride `?at=` in the authored frame (g164-offsets.test.ts holds both directions of the toggle).
// oxlint-disable-next-line import/no-nodejs-modules -- Real admitted Driftwood assets and the shipped physics binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { SaveStore } from '../../../src/engine/saves/store';
import { instanceSave } from '../../../src/game/instanceSaves';
import { createShardfileSim } from '../../../src/game/shardfile/simulation';
import { captureClientState, clientStateSave, restoreClientState } from '../../../src/game/shardfile/clientState';
import type { Shardfile } from '../../../src/game/shardfile/schema';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { LOWERED_SEA } from '../../../src/shards/driftwood-isle/world/sea';
import { MemoryStorage } from '../../setup';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/driftwood-isle/assets/${file.hash}`)]));
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const boot = (declaration: Shardfile) => createShardfileSim(declaration, assets, { rapier, quest: { fact: () => undefined, coins: () => undefined } });
const preG164: Shardfile = { ...source, identity: { ...source.identity, revision: 1 } };

it('G164 bumped the revision; the spawn stands on the lowered deck', () => {
  expect(source.identity.revision).toBe(2);
  expect(source.spawn.y).toBeCloseTo(LOWERED_SEA + 1.2, 9);
});

it('a pre-G164 (revision 1) continuation restores through the logical migration, progress kept, never refused', () => {
  const before = boot(preG164), after = boot(source);
  try {
    before.host.flags.set('g164.fixture.progress');
    before.host.player.position.set(12, 2.0, -180); // a pose in the undropped world: never carried over
    const store = new SaveStore({ local: new MemoryStorage(), session: null }), slot = instanceSave(store, clientStateSave, { id: 'driftwood-isle', shard: 'driftwood-isle' });
    slot.write(captureClientState(preG164, before, new Map()));
    const saved = slot.read();
    expect(saved?.revision).toBe(1);
    expect(restoreClientState(source, after, new Map(), saved)).toBe(true);
    expect(after.host.flags.all).toContain('g164.fixture.progress');
    expect(after.host.player.position.y).toBe(source.spawn.y); expect(after.host.player.position.x).toBe(source.spawn.x);
  } finally { before.host.dispose(); after.host.dispose(); }
});

it('a current-revision continuation restores exactly, and a future one is refused without touching the world', () => {
  const first = boot(source), next = boot(source);
  try {
    first.host.flags.set('g164.fixture.exact');
    const checkpoint = captureClientState(source, first, new Map());
    expect(restoreClientState(source, next, new Map(), checkpoint)).toBe(true);
    expect(next.host.flags.all).toContain('g164.fixture.exact');
    const future = boot(source);
    try { expect(restoreClientState(source, future, new Map(), { ...checkpoint, revision: 3 })).toBe(false); expect(future.host.flags.all).not.toContain('g164.fixture.exact'); }
    finally { future.host.dispose(); }
  } finally { first.host.dispose(); next.host.dispose(); }
});
