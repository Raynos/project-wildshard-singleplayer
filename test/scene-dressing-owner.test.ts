import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group } from 'three';
import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import type { ShardContext } from '../src/game/plugin/context';
import { Scope } from '../src/engine/app/scope';
import { enterOwner, ownerTask } from '../src/engine/app/ownership';
import { WorldRegistry } from '../src/engine/world/registry';
import { writeGeometry, join } from '../src/shards/nalati-grasslands/generators/geometryWriter';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

// 3fc133e001: a welded row (`expand`) draws through its own index, so the dressing's only frame turn here is its per-shape pause
test('a welded dressing row installs under its declared owner after await instead of borrowing the ambient owner', async () => {
  const scope = new Scope('dressing.owner'), foreign = new Scope('dressing.foreign'), root = new Group();
  const shape = new BufferGeometry();
  shape.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  shape.setIndex(Array.from({ length: 12288 }, (_, index) => index % 3));
  const blocks: Uint8Array[] = [], row = { ...writeGeometry(shape, blocks, 'owner-fixture'), expand: true }, bytes = join(blocks);
  type Runtime = NonNullable<ShardContext['game']['runtime']>;
  type World = NonNullable<Runtime['world']>;
  const world = legacyDouble<World>({ sky: legacyDouble<World['sky']>({}) });
  const product = legacyDouble<ShardContext['product']>({ slug: 'dressing-owner', hasFile: () => true, file: () => Promise.resolve(bytes) });
  const ctx = legacyDouble<ShardContext>({ scope, root, product, system: vi.fn<ShardContext['system']>(),
    app: legacyDouble<ShardContext['app']>({ registry: new WorldRegistry() }),
    game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<Runtime>({ world }) }) });
  const foreignTimeout = vi.spyOn(foreign, 'timeout'), ownedTimeout = vi.spyOn(scope, 'timeout');
  let time = 0; vi.spyOn(performance, 'now').mockImplementation(() => { time += 10; return time; });
  enterOwner(foreign);
  try {
    const dressing = await ownerTask(scope, () => SceneDressing.install(ctx, { name: 'owner-fixture', catalogues: [], packs: {},
      geometry: { shape: { kind: 'file', file: 'shape.bin', row } }, materials: {}, layers: [], statics: [], animations: [] }));
    expect(root.children).toContain(dressing.group);
    expect(foreignTimeout).not.toHaveBeenCalled();
    expect(ownedTimeout).toHaveBeenCalled();
  } finally { enterOwner(null); scope.dispose(); foreign.dispose(); shape.dispose(); vi.restoreAllMocks(); }
});
