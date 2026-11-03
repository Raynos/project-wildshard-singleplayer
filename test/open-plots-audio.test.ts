// oxlint-disable-next-line import/no-nodejs-modules -- Admission controls use existing shipped AAC bytes, never generated substitutes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { prepareProjectOutput, mergeProjectBlobs } from '../src/sdk/projectOutput';
import { controlFileHashes } from '../src/format/admissionControl';
import { parseShardfile } from '../src/sdk/shardfile';
import type { ProjectGenerationContext } from '../src/sdk/projectGeneration';
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

test('every plot has five separate bounded probes and preserves deferred own audio', () => {
  for (const [idea, spots] of Object.entries(anchors)) {
    const audio = plotAudioData(idea, spots, { dir: `/assets/music/${idea}/`, manifestKey: idea });
    expect(audio.scene?.probes).toHaveProperty(spots[0]?.id ?? 'missing');
    expect(Object.keys(audio.scene?.probes ?? {})).toHaveLength(5);
    expect(audio.zones?.sampleMix?.beds.filter(row => row.panned)).toHaveLength(5);
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
