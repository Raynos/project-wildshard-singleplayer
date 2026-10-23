// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original admitted placement rows by their exact serialized hash.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual recorder around discovery compilation.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the tiny recorder fixture and remove it after the sample.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve bounded fixture and defining tool paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the original Node executable and trace environment.
import process from 'node:process';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { parseManifestMetadata } from '@wildshard/format/minimap';
import manifest from '../src/shards/driftwood-isle/manifest.json';
import { DRIFTWOOD_FAUNA_PLANS } from '../src/shards/driftwood-isle/generators/fauna';

test('retains all five original spawn rows and their placement order', () => {
  const admitted = parseManifestMetadata(manifest).spawns;
  expect(admitted).toHaveLength(5);
  expect(admitted).toEqual(DRIFTWOOD_FAUNA_PLANS);
  // Frozen before moving the original fauna.ts literals into manifest data.
  expect(createHash('sha256').update(JSON.stringify(admitted)).digest('hex'))
    .toBe('baa6797b000f00f0a09fbaf0c08fbfaced13491655dec3d1c69cc754da164752');
});

test('discovery compilation needs no opaque spawn-evaluation subprocess', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/driftwood-manifest-inputs-'));
  try {
    const receipt = resolve(root, 'reads.json');
    writeFileSync(resolve(root, 'entry.mjs'),
      `import {authoredManifestSource} from ${JSON.stringify(resolve('scripts/authored-manifest.mjs'))};` +
      `authoredManifestSource(${JSON.stringify(process.cwd())},'driftwood-isle',{generation:true,metadataOnly:true});`);
    const child = spawnSync(process.execPath, ['--import', resolve('scripts/generation-recorder.mjs'), 'entry.mjs'], {
      cwd: root, env: { ...process.env, WS_GENERATION_READ_RECEIPT: receipt }, encoding: 'utf8',
    });
    expect(child.status, child.stderr).toBe(0);
    const trace = v.parse(v.object({ opaque: v.array(v.string()) }), JSON.parse(readFileSync(receipt, 'utf8')));
    // The fixture reads the actual source outside its own root. Those reads
    // remain conservative; the eliminated subprocess is checked separately.
    expect(trace.opaque).not.toContain('child-process');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
