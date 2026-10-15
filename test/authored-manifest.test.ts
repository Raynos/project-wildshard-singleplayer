import { describe, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The Node fixture checks real authored and emitted asset files.
import { readFileSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files in this isolated source export.
import { resolve } from 'node:path';
import { parseManifestMetadata } from '@wildshard/format/minimap';
import { ShardfileSchema } from '@wildshard/format/shardSchema';
import { defineAuthoredShard } from '@wildshard/game/shard/manifest';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { MANIFEST as sky } from '../src/shards/far-reach/discovery.generated';
import { MANIFEST as signal } from '../src/shards/sunscar-dunes/discovery.generated';
import { MANIFEST as template } from '../src/shards/_template/discovery.generated';
import * as v from 'valibot';

const root = resolve(import.meta.dirname, '..');
const metadata = (slug: string): unknown => JSON.parse(readFileSync(resolve(root, `src/shards/${slug}/manifest.json`), 'utf8'));
describe('authored JSON discovery', () => {
  for (const manifest of [sky, signal, template]) test(`${manifest.slug} composes typed native bindings and complete images`, () => {
    const row = parseManifestMetadata(metadata(manifest.slug));
    expect(manifest.name).toBe(row.name); expect(manifest.spawn).toEqual(row.spawn);
    expect(manifest.bounds).toEqual(row.bounds); expect(manifest.sky).toEqual(row.sky);
    expect(manifest.pois).toEqual(row.pois); expect(manifest.minimap?.image).toBe(row.minimap.image);
    expect(existsSync(resolve(root, `src/shards/${manifest.slug}/manifest.ts`))).toBe(false);
    const source = authoredManifestSource(root, manifest.slug);
    for (const path of Object.values(row.card).concat(Object.values(row.explore.art))) {
      if (path.startsWith('/src/')) { expect(source).toContain(path); expect(existsSync(resolve(root, path.slice(1)))).toBe(true); }
      else expect(path.startsWith('data:image/')).toBe(true);
    }
    expect(manifest.card.thumb).toBeTruthy(); expect(manifest.card.portrait).toBeTruthy(); expect(manifest.card.landscape).toBeTruthy();
    expect(existsSync(resolve(root, 'public', row.minimap.image.slice(1)))).toBe(true);
    expect(manifest.load === undefined).toBe(manifest.slug === '_template');
  });
  test('refuses malformed authored data and unresolved source assets', () => {
    const row = parseManifestMetadata(metadata('far-reach'));
    expect(() => parseManifestMetadata({...row, spawn: {...row.spawn, y: Infinity}})).toThrow();
    expect(() => parseManifestMetadata({...row, card: {...row.card, thumb: 'https://example.com/image.jpg'}})).toThrow();
    expect(() => parseManifestMetadata({...row, sky: {...row.sky, typo: true}})).toThrow();
    expect(() => defineAuthoredShard(row, 'sunscar-dunes', {accent: 'pink', bootBindings: {files: []}}, {}, {})).toThrow(/identity/);
    expect(() => defineAuthoredShard(row, 'far-reach', {accent: 'pink', bootBindings: {files: []}}, {}, {})).toThrow(/not bundled/);
  });
  test('the full shardfile schema uses the same authored metadata contract', () => {
    const file = v.parse(ShardfileSchema, JSON.parse(readFileSync(resolve(root, 'public/shardfiles/_template/shard.json'), 'utf8')));
    const row = parseManifestMetadata(metadata('_template'));
    expect(v.parse(ShardfileSchema, {...file, manifest: row}).manifest).toEqual(row);
    expect(() => v.parse(ShardfileSchema, {...file, manifest: {...row, name: ''}})).toThrow();
  });
});
