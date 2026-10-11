// oxlint-disable-next-line import/no-nodejs-modules -- Admission fixtures read committed content-addressed bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Build refusal fixtures own isolated author folders.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate an isolated author project and its assets.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the admission graph fixture root.
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { simClosure } from '../lint/sim-closure.mjs';
import template from '../src/shards/_template/shard.config';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { validateSkinAssets, skinLookParameters, parseSkinFile } from '@wildshard/format/skinAssets';
import { assetCost } from '@wildshard/format/product';
import { buildProject, contentHash, validateProject } from '../src/sdk/project';

it('keeps the complete format and skin admission closure renderer-free', () => {
  expect(simClosure(cwd(), ['src/format/shardSchema.ts', 'src/format/assetAdmission.ts'])).toEqual([]);
});

it.each(['body', 'head'])('build and validate reject a missing creature %s before allocating a view', async (missing) => {
  const source = structuredClone(template);
  const assets = new Map(source.files.map(row => [row.hash, Uint8Array.from(readFileSync(`src/shards/_template/assets/${row.hash}`))]));
  const look = source.rows.looks[0]; if (look === undefined) throw new Error('Missing skin fixture');
  const originalHash = skinLookParameters(look).skin, original = assets.get(originalHash);
  if (original === undefined) throw new Error('Missing skin file');
  const file = parseSkinFile(original);
  file.row.rig.sockets = file.row.rig.sockets.filter(name => name !== missing);
  const bytes = new TextEncoder().encode(JSON.stringify(file)), hash = contentHash(bytes);
  const declared = source.files.find(row => row.hash === originalHash); if (declared === undefined) throw new Error('Missing file row');
  Object.assign(declared, { hash, compressed: bytes.length, ...assetCost('json', bytes) });
  assets.delete(originalHash); assets.set(hash, bytes);
  source.library = source.library.map(ref => ref === originalHash ? hash : ref);
  source.critical = source.critical.map(ref => ref === originalHash ? hash : ref);
  look.parameters = { ...look.parameters, skin: hash };
  expect(() => validateProject(source, assets)).toThrow(`missing required bone '${missing}'`);
  const root = mkdtempSync(resolve(tmpdir(), 'species-view-admission-'));
  try {
    mkdirSync(resolve(root, 'assets'));
    for (const [ref, data] of assets) writeFileSync(resolve(root, 'assets', ref), data);
    writeFileSync(resolve(root, 'shard.config.ts'), `export default ${JSON.stringify(source)};`);
    await expect(buildProject(root, resolve(root, 'product'), { client: null })).rejects.toThrow(`missing required bone '${missing}'`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses lying socket/joint/clip declarations against the actual admitted GLB', () => {
  const source = structuredClone(template);
  const assets = new Map(source.files.map(row => [row.hash, Uint8Array.from(readFileSync(`src/shards/_template/assets/${row.hash}`))]));
  const look = source.rows.looks[0]; if (look === undefined) throw new Error('Missing skin fixture');
  const hash = skinLookParameters(look).skin, original = assets.get(hash);
  if (original === undefined) throw new Error('Missing skin file');
  const file = parseSkinFile(original), joints = file.row.rig.joints[0];
  if (joints === undefined) throw new Error('Missing joints');
  joints.push('invented');
  assets.set(hash, new TextEncoder().encode(JSON.stringify(file)));
  expect(() => validateSkinAssets(source, assets)).toThrow('skin joint order differs');
  joints.pop(); file.row.rig.sockets.push('invented');
  assets.set(hash, new TextEncoder().encode(JSON.stringify(file)));
  expect(() => validateSkinAssets(source, assets)).toThrow('missing or ambiguous socket invented');
  file.row.rig.sockets.pop(); file.row.rig.clips.push('idle.invented');
  assets.set(hash, new TextEncoder().encode(JSON.stringify(file)));
  expect(() => validateSkinAssets(source, assets)).toThrow('missing or ambiguous clip idle.invented');
  assets.set(hash, original);
  const realFile = parseSkinFile(original), glb = assets.get(realFile.row.file);
  if (glb === undefined) throw new Error('Missing skin GLB');
  const changed = glb.slice(), length = new DataView(changed.buffer).getUint32(12, true);
  const json = new TextDecoder().decode(changed.subarray(20, 20 + length));
  expect(json).toContain('"name":"body"');
  // Same-length node rename preserves all geometry/accessor bytes; the metadata now lies about the actual bone.
  changed.set(new TextEncoder().encode(json.replaceAll('"name":"body"', '"name":"b0dy"')), 20);
  assets.set(realFile.row.file, changed);
  expect(() => validateSkinAssets(source, assets)).toThrow('skin joint order differs');
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
