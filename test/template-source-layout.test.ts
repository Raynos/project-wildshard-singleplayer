// oxlint-disable-next-line import/no-nodejs-modules -- Own bounded author fixtures under the repository scratch root.
import { readdirSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve source and owned fixture paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { mapSettingsPath, mapStampPath, mapSettings } from '../scripts/map-hash.mjs';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';
import { simClosure, simRoot } from '../lint/sim-closure.mjs';
import { checkShards } from '../scripts/check-shards.mjs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';

const root = resolve('.');
test('Template author modules and temporary discovery have zero P0 and sim violations', () => {
  const entries: string[] = [];
  const visit = (folder: string): void => {
    for (const item of readdirSync(resolve(root, folder), { withFileTypes: true })) {
      const path = `${folder}/${item.name}`;
      if (item.isDirectory()) visit(path);
      else if (path.endsWith('.ts')) entries.push(path);
    }
  };
  visit('src/shards/_template/data'); visit('src/shards/_template/generators');
  visit('src/shards/_template/behaviour'); entries.push('src/shards/_template/shard.config.ts');
  for (const file of entries) expect(shardfileBoundaryViolations(root, file, readFileSync(file, 'utf8'))).toEqual([]);
  expect(simClosure(root, entries.filter(simRoot))).toEqual([]);
  const discovery = authoredManifestSource(root, '_template');
  expect(shardfileBoundaryViolations(root, 'src/shards/_template/discovery.generated.ts', discovery)).toEqual([]);
  expect(discovery).toContain('budgets: {');
  expect(discovery).not.toContain("from \"./data/budgets\"");
  expect(checkShards(root, new Set(['_template']))).toEqual([]);
  const template = resolve(root, 'src/shards/_template');
  expect(mapSettingsPath(template)).toBe(resolve(template, 'data/map.json'));
  expect(mapStampPath(template)).toBe(resolve(template, 'data/productMap.json'));
  expect(mapSettings(template).style?.kind).toBe('ground');
  expect(mapStampPath(resolve(root, 'src/shards/far-reach'))).toBe(resolve(root, 'src/shards/far-reach/look/map.baked.json'));
});
