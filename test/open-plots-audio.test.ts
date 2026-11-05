// oxlint-disable-next-line import/no-nodejs-modules -- Admission controls use existing shipped AAC bytes, never generated substitutes.
import { readFileSync, readdirSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare admitted recording identity against its original AAC bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Match the author compiler's exact module entry resolution.
import { resolve } from 'node:path';
import { build } from 'vite';
import { BoxGeometry, Matrix4, MeshStandardMaterial } from 'three';
import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sharddev/author';
import { staticGlb } from '../src/sharddev/bake/glb';
import { bakeAuthoredWorld } from '../src/sharddev/bake/authoredWorld';
import { validateProject } from '../src/sharddev/project';
import { prepareProjectOutput, mergeProjectBlobs } from '../src/sharddev/projectOutput';
import { indexRecordingAac } from '@wildshard/format/aacIndex';
import { controlFileHashes } from '@wildshard/format/admissionControl';
import { parseShardfile } from '../src/sdk/shardfile';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sharddev/projectGeneration';
import { generatePlotAudioProject, type PlotAudioBinding } from '../src/shards/open-plots/generators/audioProject';
import { plotAudioData } from '../src/shards/open-plots/generators/audio';
import anchors from '../src/shards/open-plots/data/audioAnchors.json' with { type: 'json' };

const controls = ['horse_squeal-3-d3ec1b12.m4a', 'king_hurt-3-170faca9.m4a', 'bowTwang-1-66536b93.m4a',
  'swordHeavy-3-1bed510f.m4a', 'footstep-gravel-1-19e4eea2.m4a', 'dive-1-4b978224.m4a', 'king_call-2-be937d44.m4a'];
const base = (): ReturnType<typeof emptyShardfile> => emptyShardfile({ slug: 'audio-control', name: 'Audio control', author: 'Test', revision: 1, seed: 1 });
const binding = (): PlotAudioBinding => ({ idea: 'lantern-bayou', source: { dir: '/assets/music/lantern-bayou/', manifestKey: 'lantern-bayou' },
  sfxDir: '/assets/sfx/lantern-bayou/', spots: anchors['lantern-bayou'], files: Object.fromEntries(['score', 'ambience', ...anchors['lantern-bayou'].map(row => row.id)].map(id => [id, `${id}-control.m4a`])) });
function context(missing = false): Pick<ProjectGenerationContext, 'cached'> {
  return { cached: (step, generate) => Promise.resolve(generate(new Map((step.inputs ?? []).flatMap((path, index) => {
    if (missing && index === 6) return [];
    const file = controls[index]; if (file === undefined) throw new Error('Missing real AAC control');
    return [[path, new Uint8Array(readFileSync(`public/assets/sfx/best/${file}`))]];
  })))) };
}

test('every plot has its separate bounded probes and preserves deferred own audio', () => {
  for (const [idea, spots] of Object.entries(anchors)) {
    const audio = plotAudioData(idea, spots, { dir: `/assets/music/${idea}/`, manifestKey: idea });
    expect(audio.scene?.probes).toHaveProperty(spots[0]?.id ?? 'missing');
    expect(spots.length).toBeGreaterThanOrEqual(4);
    expect(spots.length).toBeLessThanOrEqual(8);
    expect(Object.keys(audio.scene?.probes ?? {})).toHaveLength(spots.length);
    expect(audio.zones?.sampleMix?.beds.filter(row => row.panned)).toHaveLength(spots.length);
    expect(audio.samples?.catalogue?.loopOrder).toHaveLength(spots.length + 1);
    expect(audio.cues).toEqual([]); expect(audio.routing).toEqual([]);
    expect(audio.samples?.bed).toBe('none'); expect(audio.music?.bootSlots).toEqual(['title']);
    expect(audio.music?.setPlayback?.waitForBank).toBe(true);
  }
});

test('real AAC controls survive native recording admission and stay outside first control', async () => {
  const project = await generatePlotAudioProject(context(), base(), binding());
  expect(() => parseShardfile(project.shard)).not.toThrow();
  const output = await prepareProjectOutput('src/shards/open-plots', project.output);
  const merged = mergeProjectBlobs(project.shard, new Map(), output.blobs, output.options.namedFiles, output.late);
  expect(merged.shard.files).toHaveLength(7); expect(merged.shard.library).toHaveLength(7);
  expect(merged.shard.late).toHaveLength(7); expect(controlFileHashes(merged.shard).size).toBe(0);
  expect(Object.keys(merged.shard.audio.recordings ?? {})).toHaveLength(7);
  expect(merged.shard.budgets.library.resident).toBeGreaterThan(0);
  expect(merged.shard.budgets.library.compressed).toBeGreaterThan(0);
});

test('missing recordings, path escape, duplicate anchors and precharged declarations refuse', async () => {
  await expect(generatePlotAudioProject(context(true), base(), binding())).rejects.toThrow('Missing plot recording');
  const escaped = { ...binding(), files: { ...binding().files, score: '../outside.m4a' } };
  await expect(generatePlotAudioProject(context(), base(), escaped)).rejects.toThrow('Invalid plot recording filename');
  const duplicate = { ...binding(), spots: [...binding().spots, ...binding().spots] };
  await expect(generatePlotAudioProject(context(), base(), duplicate)).rejects.toThrow('Invalid plot audio anchors');
  const charged = base(); charged.budgets.library.resident = 1;
  await expect(generatePlotAudioProject(context(), charged, binding())).rejects.toThrow('unbaked world declaration');
});

test('the audio recipe stays inside the real one-module author boundary', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/open-plots/generators/audioProject.ts'), formats: ['es'], fileName: 'config' },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing author module output');
  expect(built.output.map(row => row.type)).toEqual(['chunk']);
});

test('the real generation cache admits URL inputs and stores only relative recording names', async () => {
  mkdirSync('tmp', { recursive: true });
  const folder = resolve(mkdtempSync('tmp/ob7-cache-control-')), project = resolve(folder, 'project'), media = resolve(folder, 'media');
  mkdirSync(project); mkdirSync(media);
  try {
    const row = binding();
    Object.values(row.files).forEach((file, index) => {
      if (typeof file !== 'string') throw new Error('Fixture requires local recording names');
      const control = controls[index]; if (control === undefined) throw new Error('Missing AAC cache control');
      writeFileSync(resolve(media, file), readFileSync(`public/assets/sfx/best/${control}`));
    });
    const roots = [{ prefix: row.source.dir, directory: media }, { prefix: row.sfxDir, directory: media }];
    const make = (): ProjectGenerationContext => createProjectGeneration(project, '0'.repeat(64), new Map(), resolve(folder, 'cache'), roots);
    const first = await generatePlotAudioProject(make(), base(), row);
    const second = await generatePlotAudioProject(make(), base(), row);
    expect(first.shard.audio.recordings).toEqual(second.shard.audio.recordings);
    expect(Object.keys(second.shard.audio.recordings ?? {})).toHaveLength(7);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('a shared bed uses its canonical source URL and unchanged admitted bytes', async () => {
  const row = binding(), requested: string[] = [];
  const canonical = '/assets/sfx/coral-drift/shared-bed.m4a';
  const reference = { set: 'coral-drift', dir: '/assets/sfx/coral-drift/', file: 'shared-bed.m4a' };
  const shared = { ...row, files: { ...row.files, ambience: reference } };
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: (step, generate) => {
    requested.push(...step.inputs ?? []);
    return context().cached(step, generate);
  } };
  const project = await generatePlotAudioProject(ctx, base(), shared);
  expect(requested).toContain(canonical);
  expect(requested).not.toContain('/assets/sfx/lantern-bayou/shared-bed.m4a');
  const bytes = readFileSync(`public/assets/sfx/best/${controls[1]}`);
  expect(project.shard.audio.recordings?.[canonical]).toBe(createHash('sha256').update(bytes).digest('hex'));
  const scoreReference = { ...row, files: { ...shared.files, score: reference } };
  await expect(generatePlotAudioProject(context(), base(), scoreReference)).rejects.toThrow('Invalid plot recording');
  const escaped = { ...row, files: { ...row.files, ambience: { ...reference, set: '../outside' } } };
  await expect(generatePlotAudioProject(context(), base(), escaped)).rejects.toThrow('Invalid plot recording');
});

test('an authored world keeps its real coarse-near bake and complete audio byte admission', async () => {
  const geometry = new BoxGeometry(10, 1, 10), floor = new BoxGeometry(500, 1, 500), materials = Array.from({ length: 4 }, (_, index) => {
    const material = new MeshStandardMaterial(); material.name = `Control${index}`; return material;
  });
  try {
    const world = staticGlb(['collide_floor', 'detail_box', 'coarse_box', 'far_box'].map((name, index) => {
      const material = materials[index]; if (material === undefined) throw new Error('Missing control material');
      return { geometry: index === 0 ? floor : geometry, material, name, transform: new Matrix4().makeTranslation(index * 12, -0.5, 0) };
    }));
    const source = { ...base(), world: { glb: 'world.glb', colliders: 'nodes:collide_', detail: 'detail_', coarse: 'coarse_',
      far: 'far_', farMode: 'replace', near: 'coarse', materials: Object.fromEntries(materials.map(material => [material.name, 'pbr'])) } };
    const made = await generatePlotAudioProject(context(), source, binding());
    const baked = await bakeAuthoredWorld(made.shard, world);
    const output = await prepareProjectOutput('src/shards/open-plots', made.output);
    const merged = mergeProjectBlobs(baked.shard, baked.assets, output.blobs, output.options.namedFiles, output.late);
    expect(() => validateProject(merged.shard, merged.assets)).not.toThrow();
    expect(Object.keys(merged.shard.audio.recordings ?? {})).toHaveLength(7);
    expect(merged.shard.late).toHaveLength(7);
  } finally { geometry.dispose(); floor.dispose(); materials.forEach(material => material.dispose()); }
});

// Exercise shipped bytes, including the alternate score, rather than only old controls.
test('published OB7 AAC candidates have continuous native packet timing', () => {
  for (const idea of Object.keys(anchors)) {
    for (const kind of ['music', 'sfx']) {
      const directory = `public/assets/${kind}/${idea}`;
      let names: string[];
      try { names = readdirSync(directory); } catch { continue; }
      for (const name of names.filter(file => file.endsWith('.m4a'))) {
        const index = indexRecordingAac(new Uint8Array(readFileSync(`${directory}/${name}`)));
        expect(index.mediaFrames).toBeGreaterThan(index.primingFrames);
      }
    }
  }
});
