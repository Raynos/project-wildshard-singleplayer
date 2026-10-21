// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete and isolated generation input inventories.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Scratch stays under the repository's ignored tmp directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import settings from '../src/shards/pine-hollow/look/map.json' with { type: 'json' };
import { mapInputHashes, mapTilesHash } from '../scripts/map-hash.mjs';

test('Pine map stamps the exact complete mesh assembly in both isolated and full generation', () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/pine-map-inputs-'));
  const put = (path: string, value: string): void => { writeFileSync(resolve(root, path), value); };
  try {
    mkdirSync(resolve(root, 'look')); mkdirSync(resolve(root, 'data')); mkdirSync(resolve(root, 'assets'));
    put('look/map.json', JSON.stringify(settings));
    const pack = settings.painter.scenes.packs[0], recipe = settings.painter.scenes.recipes[0];
    if (pack === undefined || recipe === undefined) throw new Error('Missing defining map assembly');
    expect(settings.inputs).toEqual([recipe.file, pack.file]);
    put(recipe.file, '{"scene":[]}'); put(pack.file, 'exact mesh bytes');
    const isolated = mapTilesHash(root);
    expect(Object.keys(mapInputHashes(root))).toEqual([pack.file, recipe.file, 'look/map.json'].sort());
    // These outputs exist only in the complete export and are not painter reads.
    put('data/bootMetadata.generated.json', '{"version":1}'); put('assets/unrelated.wasm', 'guest');
    put('data/unrelated.d.json.ts', 'declare const rows: unknown;');
    expect(mapTilesHash(root)).toBe(isolated);
    put(pack.file, 'changed world triangles'); expect(mapTilesHash(root)).not.toBe(isolated);
    put(pack.file, 'exact mesh bytes'); expect(mapTilesHash(root)).toBe(isolated);
    put('look/map.json', JSON.stringify({ ...settings, style: { ...settings.style, shade: settings.style.shade + .1 } }));
    expect(mapTilesHash(root)).not.toBe(isolated);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
