import { expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { WorldRegistry } from '../src/engine/world/registry';
import { shardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { installDeckCameraSway } from '../src/game/systems/looks/deckCameraSway';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { emptyShardfile } from '../src/sdk/author';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import swaySource from '../src/shards/driftwood-isle/behaviour/bridgeSway.as?raw';

const s = page.sway;
/** views/bridge-sway.json's shape (sp-x6's generator): piece, system, order and the nine parameters in the module's order */
const rows = { piece: s.piece, system: page.systems.sway, before: page.systems.before,
  parameters: [s.height, s.ease, s.threshold, s.rate, s.speed, s.rollHz, s.roll, s.dipHz, s.dip] };

test('the bridge sway view module keeps the original camera sample, order and floor membership', async () => {
  const module = await compileScriptV2(swaySource, { lane: 'view', ioBytes: 4096 });
  const host = new App(), scope = new Scope('bridge-sway-view'), registry = new WorldRegistry(), camera = new PerspectiveCamera();
  const source = emptyShardfile({ slug: 'bridge-fixture', name: 'Bridge fixture', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(),
    read: () => Promise.reject(new Error('Bridge sway needs no file read')) });
  const level = createLevelInstallation(host, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, TEMPLATE, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } }, product);
  const player = { position: new Vector3(), velocity: new Vector3() };
  Object.defineProperty(ctx.game, 'runtime', { value: { world: { registry, player, game: { camera } } } });
  const systems: Parameters<typeof ctx.system>[0][] = [];
  const install = vi.spyOn(ctx, 'system').mockImplementation(row => { systems.push(row); });
  try {
    installDeckCameraSway(ctx, rows, module); expect(systems).toEqual([]);
    scope.run(() => { registry.add({ id: rows.piece, name: 'Rope deck', category: 'buildings', file: 'test/driftwood-bridge-sway-view.test.ts',
      floor: (x, z) => Math.abs(x) < 2 && Math.abs(z) < 2 ? 0 : undefined }); });
    installDeckCameraSway(ctx, rows, module);
    const system = systems[0]; if (system === undefined) throw new Error('Missing bridge sway system');
    expect(system.id).toBe('shard.driftwood.adventure.3'); expect(system.phase).toBe('update'); expect(system.before).toEqual(rows.before);
    system.run(.5, .5);
    // the original law's camera after one half-second step on the deck (test/driftwood-bridge-sway.test.ts)
    expect(camera.rotation.z).toBeCloseTo(.011318274432332433, 12);
    expect(camera.position.y).toBeCloseTo(.02444661506088291, 12);
    const roll = camera.rotation.z, dip = camera.position.y;
    player.position.x = 10; system.run(1, 1.5);
    expect(camera.rotation.z).toBe(roll); expect(camera.position.y).toBe(dip);
    expect(() => { installDeckCameraSway(ctx, { ...rows, parameters: rows.parameters.slice(1) }, module); }).toThrow();
  } finally { install.mockRestore(); scope.dispose(); }
});
