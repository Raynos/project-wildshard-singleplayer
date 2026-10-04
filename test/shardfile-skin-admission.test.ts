// oxlint-disable-next-line import/no-nodejs-modules -- Admission fixtures read committed content-addressed bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the admission graph fixture root.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { simClosure } from '../lint/sim-closure.mjs';
import template from '../src/shards/_template/shard.config';
import { parseShardfile } from '../src/game/shardfile/schema';
import { validateSkinAssets, skinLookParameters, parseSkinFile } from '../src/game/shardfile/skins';

it('keeps the complete format and skin admission closure renderer-free', () => {
  expect(simClosure(cwd(), ['src/game/shardfile/schema.ts', 'src/game/shardfile/validate.ts'])).toEqual([]);
});
it('rejects skin references before allocation and charges numeric pose buffers', () => {
  const source = structuredClone(template), assets = new Map(source.files.map((row) => [row.hash, Uint8Array.from(readFileSync(`src/shards/_template/assets/${row.hash}`))]));
  expect(() => validateSkinAssets(source, assets)).not.toThrow();
  const look = source.rows.looks[0]; if (look === undefined) throw new Error('Missing skin fixture');
  const hash = skinLookParameters(look).skin;
  source.library = source.library.filter((id) => id !== hash);
  expect(() => parseShardfile(source)).toThrow();
  const original = assets.get(hash); if (original === undefined) throw new Error('Missing rig bytes');
  const originalFile = parseSkinFile(original), file = structuredClone(originalFile);
  file.row.file = '0'.repeat(64);
  assets.set(hash, new TextEncoder().encode(JSON.stringify(file)));
  expect(() => validateSkinAssets(template, assets)).toThrow('dependency mismatch');
  file.row.file = originalFile.row.file;
  file.row.cost.decoded = 0;
  assets.set(hash, new TextEncoder().encode(JSON.stringify(file)));
  expect(() => validateSkinAssets(template, assets)).toThrow('cost understated');
  const badFamily = structuredClone(originalFile);
  badFamily.binding.material = { family: 'arbitrary-shader' };
  assets.set(hash, new TextEncoder().encode(JSON.stringify(badFamily)));
  expect(() => validateSkinAssets(template, assets)).toThrow();
});
