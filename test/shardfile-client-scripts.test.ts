import { beforeAll, expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '../src/game/shardfile/schema';
import { createShardfileClientScripts } from '../src/game/shardfile/clientScripts';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { contentHash } from '@wildshard/sdk/project';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';
import { DeclaredScriptWorld } from '../src/engine/script/state';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the immutable authored template client module.
import { readFileSync } from 'node:fs';
import template from '../src/shards/_template/shard.config';
import { CLIENT_IDLE_HASH } from '../src/shards/_template/data/clientScripts';

let bytes: Uint8Array;
beforeAll(async () => { bytes = await compileScript(scriptSource('store<f64>(24576,104);store<f64>(24584,1);store<f64>(24592,load<f64>(16384+64)+1);', '', '1'), { maximumPages: 2 }); });
function source() {
  const s = emptyShardfile({ slug: 'client-test', name: 'Client test', author: 'Test', revision: 1, seed: 1 }), hash = contentHash(bytes);
  s.files.push({ hash, kind: 'wasm', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }); s.library.push(hash);
  s.budgets.library = { resident: bytes.length + 3 * 2 * 65536, compressed: bytes.length };
  s.state.shared.push({ id: 101, name: 'public', type: 'bool', privacy: 'public', default: false });
  s.state.player.push({ id: 202, name: 'owned', type: 'bool', privacy: 'owner', default: false });
  s.clientScripts = { divisor: 1, bindings: [{ module: hash, entity: 1001, name: 'dust', target: { kind: 'particles', id: 'dust', at: [0, 0, 0] }, reads: [{ scope: 'shared', id: 101 }], parameters: [], pose: false, maxOffset: 0, minScale: 1, maxScale: 1,
    emitters: [{ id: 1, recipe: 'platform.particles', perTick: 2, live: 4, lifetimeTicks: 2, colour: [1, 1, 1], size: 0.1, velocity: [0, 1, 0], gravity: 0 }] }] };
  return s;
}
function state() {
  return new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 2 }, [1, 2].map((id) => ({ id, name: String(id), fields: {}, position: [0, 0, 0], frozen: false, interactive: true })), {
    shared: [{ id: 101, name: 'public', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }], player: [{ id: 202, name: 'owned', type: 'bool', privacy: 'owner', default: 0, min: 0, max: 1 }],
  }, new Map([[1, 'alice'], [2, 'bob']]));
}
it('projects only the trusted actor view and cannot mutate shared/player state', () => {
  const s = source(), world = state(), before = world.checkpoint();
  world.prepare([{ op: 6, a: 202, b: 1, c: 0, d: 0 }], 2, 0, 0).commit();
  const b = s.clientScripts.bindings[0]; if (!b) throw new Error('Missing binding'); b.reads = [{ scope: 'player', id: 202 }];
  const client = createShardfileClientScripts(parseShardfile(s), new Map([[contentHash(bytes), bytes]]), { actorId: 'alice', state: world, observe: () => ({ position: [0, 0, 0], frozen: true }) });
  client.step(0); expect(client.lane.frames()[0]?.particles[0]?.count).toBe(1); expect(world.view('bob').player['owned']).toBe(1); expect(world.checkpoint().shared).toEqual(before.shared);
  expect(client.targets).toEqual([{ entity: 1001, target: b.target }]); client.dispose();
});
it('allows render-only frozen targets with no state world and refuses requested reads without one', () => {
  const s = source(), assets = new Map([[contentHash(bytes), bytes]]), ports = { actorId: 'alice', observe: () => ({ position: [0, 0, 0] as const, frozen: true }) };
  expect(() => createShardfileClientScripts(s, assets, ports)).toThrow('state view');
  const b = s.clientScripts.bindings[0]; if (!b) throw new Error('Missing binding'); b.reads = [];
  const client = createShardfileClientScripts(s, assets, ports); client.step(0); expect(client.lane.frames()[0]?.particles[0]?.count).toBe(1); client.dispose();
});
it('refuses hidden/string/missing fields, competing targets and unknown visual anchors', () => {
  for (const privacy of ['owner', 'host'] as const) { const s = source(), field = s.state.shared[0]; if (!field) throw new Error('Missing field'); field.privacy = privacy; expect(() => parseShardfile(s)).toThrow(); }
  const s = source(), b = s.clientScripts.bindings[0]; if (!b) throw new Error('Missing binding');
  b.reads = [{ scope: 'shared', id: 999 }]; expect(() => parseShardfile(s)).toThrow(); b.reads = [];
  b.target = { kind: 'creature', id: 'absent' }; expect(() => parseShardfile(s)).toThrow(); b.target = { kind: 'prop', id: 'absent' }; expect(() => parseShardfile(s)).toThrow();
  b.target = { kind: 'particles', id: 'dust', at: [0, 0, 0] }; s.clientScripts.bindings.push({ ...b, entity: 1002, name: 'other' }); expect(() => parseShardfile(s)).toThrow();
});
it('admits real Wasm once per module and reserves all three maximum guest copies in the library', () => {
  const s = source(), assets = new Map([[contentHash(bytes), bytes]]);
  expect(validateShardfileAssets(s, assets, contentHash)).toEqual(parseShardfile(s));
  s.budgets.library.resident--; expect(() => validateShardfileAssets(s, assets, contentHash)).toThrow('client script memory'); s.budgets.library.resident++;
  const allocator = new ResidencyAllocator(), releases: (() => void)[] = [], ports = { allocator, owner: 'one', scope: { onDispose: (release: () => void) => { releases.push(release); return release; } } };
  leaseClientLibrary(s, assets, ports); leaseClientLibrary(s, assets, { ...ports, owner: 'two' });
  expect(allocator.entries().filter((claim) => claim.id.includes('client-memory'))).toHaveLength(2);
  expect(allocator.entries().reduce((n, claim) => n + claim.bytes, 0)).toBe(bytes.length + 2 * 3 * 2 * 65536);
  for (const release of releases) release(); expect(allocator.entries()).toEqual([]);
});
it('runs the actual template frozen idle declarations without a region and restores live identity poses', () => {
  const assets = new Map([[CLIENT_IDLE_HASH, readFileSync(`src/shards/_template/assets/${CLIENT_IDLE_HASH}`)]]);
  let frozen = true;
  const client = createShardfileClientScripts(template, assets, { actorId: 'actor.player', observe: () => ({ position: [0, 0, 0], frozen }) });
  client.step(0); const first = client.lane.frames();
  for (let tick = 2; tick <= 120; tick += 2) client.step(tick);
  expect(client.lane.frames()).not.toEqual(first);
  expect(client.lane.frames().some((frame) => frame.rotation.some((n) => n !== 0) || frame.scale.some((n) => n !== 1))).toBe(true);
  frozen = false; client.step(122);
  for (const frame of client.lane.frames()) expect(frame).toMatchObject({ offset: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], particles: [] });
  client.dispose();
});
