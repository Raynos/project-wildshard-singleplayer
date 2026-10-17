import { expect, test } from 'vitest';
import * as v from 'valibot';
import { NATIVE_VIEW } from '../src/shards/pine-hollow/generators/nativeView';
import { NativeViewSchema } from '../src/shards/pine-hollow/runtime/sections';
import { admitPineView, pineView } from '../src/shards/pine-hollow/runtime/world/context';
import { output } from '../src/shards/pine-hollow/generators/output';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { resolveBootSources, type BootFileRecipes } from '../src/engine/boot/filePolicy';
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from '../src/shards/pine-hollow/generators/bootFiles';
import metadata from '../src/shards/pine-hollow/data/bootMetadata.generated.json' with { type: 'json' };
import explorer from '../src/shards/pine-hollow/data/explorerMetadata.generated.json' with { type: 'json' };
import { FINISH_CARDS } from '../src/shards/pine-hollow/generators/finishCards';
import coatPages from '../src/shards/pine-hollow/data/coatPages.generated.json' with { type: 'json' };
import authored from '../src/shards/pine-hollow/data/timberWorld.generated.json' with { type: 'json' };
import { GPU_FILES } from '../src/shards/pine-hollow/ktx2.generated';
import { ASTC6_PHONE } from '../src/shards/pine-hollow/runtime/boot/astc6/ktx2.generated';
import { bootSources, usePineGpuFiles } from '../src/shards/pine-hollow/runtime/boot/files';

test('world view rows come from the admitted named product', async () => {
  const file = output.namedFiles.find(row => row.name === 'look/native-view.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined) throw new Error('Missing Pine native view');
  const product = createShardProduct({ slug:'pine-hollow', revision:1,
    shardfile:emptyShardfile({ slug:'pine-hollow', name:'Pine', author:'Wildshard', revision:1, seed:1 }),
    sections:new Map(), files:new Map([['look/native-view.json', { hash:file.hash, url:file.path }]]), read:() => Promise.resolve(bytes) });
  await admitPineView(product);
  expect(pineView()).toEqual(NATIVE_VIEW);
  expect(() => v.parse(NativeViewSchema, { ...NATIVE_VIEW, KING_ARENA_FOG:'31' })).toThrow();
});

test('pre-admission metadata preserves Explorer identities and ordered boot recipes', () => {
  expect(explorer.cards).toEqual(FINISH_CARDS);
  expect(metadata).toEqual({ recipes:PINE_BOOT_FILES, sources:PINE_BOOT_SOURCES });
  const inputs = { pages:{ coats:coatPages.tiers }, aliases:{ props:authored.propMaterials } };
  try {
    for (const table of [GPU_FILES, { phone:{ ...GPU_FILES.phone, ...ASTC6_PHONE }, desktop:GPU_FILES.desktop }]) {
      usePineGpuFiles(table);
      for (const tier of ['phone','desktop'] as const) for (const tex of ['img','ktx2'] as const) {
        const expected = resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, tier, tex, table, inputs);
        expect(resolveBootSources(metadata.recipes as BootFileRecipes, metadata.sources, tier, tex, table, inputs)).toEqual(expected);
        expect(bootSources(tier, tex)).toEqual(expected);
      }
    }
  } finally { usePineGpuFiles(GPU_FILES); }
});
