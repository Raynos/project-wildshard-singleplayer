// NATIVE: decode the same engine-owned source geometry, then capture inert card rows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pageScope } from '@wildshard/engine/app/resources';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = new URL('../../../../', import.meta.url), shard = new URL('../', import.meta.url);
const environment = installBakeEnvironment(fileURLToPath(root));
const geometry = new Map();
try {
  const [{ createOwnedGeometry }, { nativeSpecimenCatalogue }] = await Promise.all([
    import('@wildshard/engine/models/ownedGeometry'), import('./nativeSpecimens.ts'),
  ]);
  const read = name => JSON.parse(readFileSync(new URL(`data/${name}.json`, shard), 'utf8'));
  const inventory = read('fixedGeometry'), files = read('fixedBlobs.generated');
  const groups = inventory.groups.npc;
  const slots = ['hat', 'cape', 'tradeCounter', ...Object.values(groups.trader)];
  const library = [];
  for (const slot of new Set(slots)) {
    const draw = inventory.draws.find(row => row.slot === slot);
    if (draw === undefined) throw new Error(`Missing native card draw: ${slot}`);
    const name = files.byUrl[draw.source];
    const source = files.blobs.find(row => row.name === name);
    if (source === undefined) throw new Error(`Missing native card blob: ${slot}`);
    const attributes = Object.fromEntries(draw.channels);
    const intake = createOwnedGeometry(draw.source, attributes);
    // Named sources are shard-local; never consult an earlier built product.
    await intake.load(new Uint8Array(readFileSync(new URL(source.source, shard))));
    geometry.set(slot, intake.take());
    library.push({ id: slot, file: name, attributes });
  }
  const catalogue = nativeSpecimenCatalogue(geometry, groups);
  const writer = byteWriter(process.argv.includes('--check'), 'driftwood-native-specimens');
  writer.put(fileURLToPath(new URL('data/nativeSpecimens.generated.json', shard)), jsonBytes({
    catalogue, library: { id: 'native-specimens', kind: 'owned', models: library },
  }));
  writer.finish();
} finally {
  for (const value of geometry.values()) value.dispose();
  try { pageScope.dispose(); } finally { environment.dispose(); }
}
