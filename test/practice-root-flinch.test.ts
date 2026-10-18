import { expect, test } from 'vitest';
import { readPracticePresentation } from '../src/practicePresentation';
import presentation from '../src/shards/driftwood-isle/data/practiceLooks.json';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import type { ProjectOutput } from '../src/sdk/projectOutput';
import { createPufferPreviewOutput } from '../src/shards/driftwood-isle/generators/pufferNativePreview';

function lookBytes(output: ProjectOutput): Uint8Array {
  const file = output.namedFiles?.find(row => row.name === 'practice/looks.json');
  const bytes = file === undefined ? undefined : output.assets?.get(file.hash);
  if (bytes === undefined) throw new Error('Missing authored practice look');
  return bytes;
}

test('strict look admission leaves omitted recoil absent and accepts only the explicit policy enum', () => {
  expect(readPracticePresentation(presentation)).toEqual(presentation);
  const row = presentation.looks[0]; if (row === undefined) throw new Error('Missing fixture');
  for (const rootFlinch of ['engine', 'authored-pose']) {
    expect(readPracticePresentation({ ...presentation, looks: [{ ...row, rootFlinch }] }).looks[0]?.rootFlinch).toBe(rootFlinch);
  }
  for (const rootFlinch of [true, false, null, 0, 'none', 'disable', undefined]) {
    expect(() => readPracticePresentation({ ...presentation, looks: [{ ...row, rootFlinch }] })).toThrow();
  }
  expect(() => readPracticePresentation({ ...presentation, looks: [{ ...row, ignoreFlinch: true }] })).toThrow();
});

test('all default preview look bytes remain unchanged, including V57 gait5', () => {
  const expected = encodeCanonicalJson({ ...presentation, looks: presentation.looks.filter(row => row.kind === 'brine-puffer') });
  for (const mode of ['rest', 'inflate-105', 'inflate-110', 'attack', 'gait4', 'gait5'] as const) {
    const output = createPufferPreviewOutput({ test: true }, mode);
    expect(new TextDecoder().decode(lookBytes(output))).toBe(expected);
  }
});

test('explicit gait5 product adds only look policy and preserves pose, body and gameplay data', () => {
  const before = createPufferPreviewOutput({ test: true }, 'gait5');
  const after = createPufferPreviewOutput({ test: true }, 'gait5', 'authored-pose');
  const parsed = readPracticePresentation(JSON.parse(new TextDecoder().decode(lookBytes(after))));
  expect(parsed.looks.map(row => row.rootFlinch)).toEqual(['authored-pose']);
  expect(after.platform).toEqual(before.platform);
  expect(after.namedFiles?.filter(row => row.name !== 'practice/looks.json'))
    .toEqual(before.namedFiles?.filter(row => row.name !== 'practice/looks.json'));
  expect(() => createPufferPreviewOutput({ test: true }, 'attack', 'authored-pose')).toThrow('gait5');
});
