import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ToonLookSchema } from '../src/format/materialFamilies';
import { readPracticePresentation } from '../src/practicePresentation';
import { practiceLevel } from '../src/practiceLevel';
import { configurePracticeOcclusion, practiceHemisphere } from '../src/practiceLighting';
import presentation from '../src/shards/driftwood-isle/data/practiceLooks.json';
import profiles from '../src/shards/driftwood-isle/data/practiceLighting.json';
import manifest from '../src/shards/driftwood-isle/manifest.json';
import { createPufferPreviewOutput, createPufferPreviewSource } from '../src/shards/driftwood-isle/generators/pufferNativePreview';
import type { ProjectOutput } from '../src/sdk/projectOutput';

const light = { profile: 'neutral-studio-v1' as const, ...profiles['neutral-studio-v1'].hemisphere };
const occlusion = { profile: 'contact-v1' as const, ...profiles['contact-v1'] };

function looks(output: ProjectOutput): unknown {
  const file = output.namedFiles?.find(row => row.name === 'practice/looks.json');
  const bytes = file === undefined ? undefined : output.assets?.get(file.hash);
  if (bytes === undefined) throw new Error('Missing look blob');
  return JSON.parse(new TextDecoder().decode(bytes));
}

test('arena lighting and contact AO are separate strict optional data profiles', () => {
  expect(readPracticePresentation(presentation)).toEqual(presentation);
  expect(readPracticePresentation({ ...presentation, arenaLighting: light }).arenaOcclusion).toBeUndefined();
  expect(readPracticePresentation({ ...presentation, arenaLighting: light, arenaOcclusion: occlusion }).arenaOcclusion).toEqual(occlusion);
  for (const value of [undefined, null, true, {}, 'neutral', 'contact-v2']) {
    expect(() => readPracticePresentation({ ...presentation, arenaLighting: value })).toThrow();
    expect(() => readPracticePresentation({ ...presentation, arenaOcclusion: value })).toThrow();
  }
  for (const arenaLighting of [{ ...light, intensity: Infinity }, { ...light, sky: -1 }, { ...light, sky: .5 }, { ...light, camera: true }]) {
    expect(() => readPracticePresentation({ ...presentation, arenaLighting })).toThrow();
  }
  for (const arenaOcclusion of [{ ...occlusion, radius: -1 }, { ...occlusion, intensity: 5 }, { ...occlusion, enabled: true }]) {
    expect(() => readPracticePresentation({ ...presentation, arenaOcclusion })).toThrow();
  }
  expect(() => readPracticePresentation({ ...presentation, headlight: true })).toThrow();
});

test('omitted profile preserves outdoor sky and opt-in changes only the hemisphere fill', () => {
  const before = practiceLevel(), after = practiceLevel(light);
  expect(practiceHemisphere(undefined)).toBeUndefined();
  expect(before.sky.hemiSky).toBe(manifest.sky.hemiSky);
  expect(before.sky.hemiGround).toBe(manifest.sky.hemiGround);
  expect(before.sky.hemiIntensity).toBe(manifest.sky.hemiIntensity);
  expect(after.sky).toEqual({ ...before.sky, hemiSky: profiles['neutral-studio-v1'].hemisphere.sky,
    hemiGround: profiles['neutral-studio-v1'].hemisphere.ground, hemiIntensity: profiles['neutral-studio-v1'].hemisphere.intensity });
  expect(after.grade).toEqual(before.grade);
  expect(after.atmosphere).toEqual(before.atmosphere);
  expect(after.creatures).toEqual(before.creatures);
});

test('contact AO preserves absent phone pass and omitted desktop settings', () => {
  const pass = { configuration: { aoRadius: 2.5, intensity: 2.5, aoSamples: 16, halfRes: true }, enabled: true };
  configurePracticeOcclusion(null, occlusion);
  configurePracticeOcclusion(pass, undefined);
  expect(pass.configuration).toEqual({ aoRadius: 2.5, intensity: 2.5, aoSamples: 16, halfRes: true });
  configurePracticeOcclusion(pass, occlusion);
  expect(pass).toEqual({ configuration: { aoRadius: 0.4, intensity: 1, aoSamples: 16, halfRes: true }, enabled: true });
});

test('authored neutral fill changes only family toon lift and rim, never vertex palette or graph', () => {
  const before = createPufferPreviewSource(), after = createPufferPreviewSource('neutral-studio-v1');
  expect(after.look.materials).toEqual(before.look.materials);
  const originalToon = v.parse(ToonLookSchema, before.look.familyLooks.toon ?? {});
  expect(after.look.familyLooks.toon).toEqual({ ...originalToon, ...profiles['neutral-studio-v1'].toon });
  expect({ ...after, look: before.look }).toEqual(before);
  expect(createPufferPreviewSource()).toEqual(before);
});

test('lighting and AO opt-ins alter only presentation blob, retaining native pose and gameplay', () => {
  const before = createPufferPreviewOutput({ original: true }, 'gait5', 'authored-pose');
  expect(before.namedFiles?.find(row => row.name === 'practice/looks.json')?.hash)
    .toBe('a1914dcbd133b29c899818087e9682cf2ecc08408a80af3737bca539744af273');
  const lighting = createPufferPreviewOutput({ original: true }, 'gait5', 'authored-pose', 'neutral-studio-v1');
  const contact = createPufferPreviewOutput({ original: true }, 'gait5', 'authored-pose', 'neutral-studio-v1', 'contact-v1');
  expect(readPracticePresentation(looks(lighting)).arenaLighting).toEqual(light);
  expect(readPracticePresentation(looks(lighting)).arenaOcclusion).toBeUndefined();
  expect(readPracticePresentation(looks(contact)).arenaOcclusion).toEqual(occlusion);
  for (const after of [lighting, contact]) {
    expect(after.platform).toEqual(before.platform);
    expect(after.namedFiles?.filter(row => row.name !== 'practice/looks.json'))
      .toEqual(before.namedFiles?.filter(row => row.name !== 'practice/looks.json'));
  }
});
