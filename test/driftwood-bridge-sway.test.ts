// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { WorldRegistry } from '../src/engine/world/registry';
import { shardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import { installBridgeSway } from '../src/shards/driftwood-isle/quest/install';
import rows from '../src/shards/driftwood-isle/data/bridgeSway.json' with { type: 'json' };

test('listed rope deck keeps its update ordering, original camera sample and floor membership', () => {
  const host = new App(), scope = new Scope('bridge-sway'), registry = new WorldRegistry(), camera = new PerspectiveCamera();
  const source = emptyShardfile({ slug: 'bridge-fixture', name: 'Bridge fixture', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(),
    read: () => Promise.reject(new Error('Bridge projection needs no file read')) });
  const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, TEMPLATE, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const player = { position: new Vector3(), velocity: new Vector3() };
  Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry, player, game: { camera } } } });
  const systems: Parameters<typeof ctx.system>[0][] = [];
  const install = vi.spyOn(ctx, 'system').mockImplementation(row => { systems.push(row); });
  try {
    installBridgeSway(ctx, rows); expect(systems).toEqual([]);
    scope.run(() => { registry.add({ id: rows.piece, name: 'Rope deck', category: 'buildings', file: 'test/driftwood-bridge-sway.test.ts', floor: (x, z) => Math.abs(x) < 2 && Math.abs(z) < 2 ? 0 : undefined }); });
    installBridgeSway(ctx, rows);
    const system = systems[0]; if (system === undefined) throw new Error('Missing bridge projection');
    expect(system.id).toBe('shard.driftwood.adventure.3'); expect(system.phase).toBe('update'); expect(system.before).toEqual(rows.before);
    system.run(.5, .5);
    expect(camera.rotation.z).toBeCloseTo(.011318274432332433, 12);
    expect(camera.position.y).toBeCloseTo(.02444661506088291, 12);
    const roll = camera.rotation.z, dip = camera.position.y;
    player.position.x = 10; system.run(1, 1.5);
    expect(camera.rotation.z).toBe(roll); expect(camera.position.y).toBe(dip);
  } finally { install.mockRestore(); scope.dispose(); }
});
