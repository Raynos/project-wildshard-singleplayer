// oxlint-disable-next-line import/no-nodejs-modules -- Inspect retained producer source and exact shipped geometry bytes.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Give this producer its own empty cache for cold/forced checks.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only this test's own temporary cache and declared outputs.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare canonical binary digests across hosts.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the historical zlib/byte-lane format, without renderer services.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- The real generation driver receives the isolated test root.
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { writeNalatiParts, writeDressingScene } from '../src/shards/nalati-grasslands/generators/bake-nalati-places.mjs';
import { bakeDressing, dressingDescription } from '../src/shards/nalati-grasslands/generators/dressingBake';
import { readScene } from '@wildshard/sdk/scene';
import { restoreSceneGraph } from '@wildshard/sdk/sceneGraph';

const OUTPUTS = ['public/assets/nalati/baked/dressing.bin', 'src/shards/nalati-grasslands/data/dressingGeos.json',
  'src/shards/nalati-grasslands/data/dressing.scene.generated.json'];
const PINS = {
  [OUTPUTS[0] ?? '']: '61d680cdf497c9906df63cec350d3abc4606833fdf80cba2e4bcf4ab5a7ac1d3',
  [OUTPUTS[1] ?? '']: '09a991c2f8dbb8167631134e8293a48b273b2371cbfc704f596af9853e35eb98',
  [OUTPUTS[2] ?? '']: '19c1742728ee6b3dbb4db358029400c8482359eb8cd0a81a6a365520e6163c52',
};

function job() {
  const row = discoverGeneration(process.cwd()).jobs.find(item => item.id === 'nalati-dressing');
  if (row === undefined) throw new Error('Missing retained Nalati dressing job');
  return row;
}

describe('Nalati dressing models are authored without the runtime bridge', () => {
  it('keys the complete author-only closure and owns its historical binary plus standard Scene', () => {
    const row = job();
    const audits = [row.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(process.cwd(), 'nalati-grasslands', entry));
    expect(audits.flatMap(audit => audit.issues)).toEqual([]);
    expectKeyedClosure(row.inputRoots, audits.flatMap(audit => audit.files), 'nalati-grasslands');
    expect(row.command).toEqual(['--import', './src/sdk/bake/source-loader.mjs', row.entry]);
    expect(row.seedOutputs).toEqual([]);
    expect(row.platform).toBe('portable'); expect(row.outputs).toEqual(OUTPUTS);
    expect(row.buildOutputs).toEqual(PINS);
    const old = discoverGeneration(process.cwd()).jobs.find(item => item.id === 'nalati-places');
    expect(old?.outputs.filter(file => OUTPUTS.includes(file))).toEqual([]);
  });

  it('retains all thirteen tier variants and every historical attribute/index byte', () => {
    const made = bakeDressing(), packed = inflateSync(readFileSync(OUTPUTS[0] ?? ''));
    const raw = new Uint8Array(packed.length), n = raw.length / 4;
    for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) raw[i * 4 + b] = packed[b * n + i] ?? 0;
    expect(createHash('sha256').update(made.bin).digest('hex')).toBe(createHash('sha256').update(raw).digest('hex'));
    const envelope: unknown = JSON.parse(readFileSync(OUTPUTS[1] ?? '', 'utf8'));
    if (typeof envelope !== 'object' || envelope === null || !('rows' in envelope)) throw new Error('Missing historical dressing rows');
    expect(made.rows).toEqual(envelope.rows);
    expect(made.rows.map(row => row.key)).toEqual(['boulder:2', 'boulder:3', 'slab:2', 'slab:3', 'stone', 'juniper',
      'rose', 'rose:lite', 'willow', 'lupin', 'lupin:lite', 'daisy', 'reed']);
  });

  it('round-trips named three.js meshes and declared materials through scene.json exactly', () => {
    const description = dressingDescription();
    expect(readScene(restoreSceneGraph(description))).toEqual(description);
  });

  it('retains exact check-mode refusals without touching any shipped output', () => {
    const before = OUTPUTS.map(file => readFileSync(file));
    const made = bakeDressing(), bin = made.bin.slice(); bin[0] = (bin[0] ?? 0) ^ 1;
    expect(() => writeNalatiParts([{ name: 'dressing', json: 'dressingGeos.json', part: { rows: made.rows, bin } }], true)).toThrow('stale outputs');
    const scene = dressingDescription();
    expect(() => writeDressingScene({ ...scene, nodes: [] }, true)).toThrow('Scene is stale');
    expect(OUTPUTS.map(file => readFileSync(file))).toEqual(before);
  });

  it('cold-builds with no output seeds and reproduces every pin on forced comparison', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'nalati-dressing-author-'));
    try {
      const cold = await generateShardJob(process.cwd(), job(), { cacheDir });
      expect(cold.hit).toBe(false); expect(cold.hashes).toEqual(PINS);
      const compared = await generateShardJob(process.cwd(), job(), { cacheDir, forceCompare: true });
      expect(compared.hashes).toEqual(PINS);
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  }, 20_000);
});
