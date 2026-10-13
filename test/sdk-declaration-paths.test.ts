// oxlint-disable-next-line import/no-nodejs-modules -- This fixture checks the retained public package publication maps.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { skinnedGlb, sampleSkinClip } from '@wildshard/sdk/bake/export';
import { readRigRest, readRigMotion } from '@wildshard/sdk/bake/rig';
import { createCatalogue } from '@wildshard/commons/catalogue';
import { SkinLookParametersSchema } from '@wildshard/format/skins';

const published = v.object({ publishConfig: v.object({ exports: v.record(v.string(), v.object({ types: v.string(), default: v.string() })) }) });
const source = v.object({ exports: v.record(v.string(), v.string()) });

it('names the exact packaged SDK declaration entries for real GLB and rig bindings', () => {
  const sdk = v.parse(published, JSON.parse(readFileSync('src/sdk/package.json', 'utf8')));
  for (const path of ['glb', 'export', 'rig']) {
    expect(sdk.publishConfig.exports[`./bake/${path}`]?.types).toBe(`./dist/types/sdk/bake/${path}.d.ts`);
  }
  for (const binding of [staticGlb, skinnedGlb, sampleSkinClip, readRigRest, readRigMotion]) expect(typeof binding).toBe('function');
});

it('follows the defining format and commons exports rather than invented SDK filenames', () => {
  const format = v.parse(source, JSON.parse(readFileSync('src/format/package.json', 'utf8')));
  const commons = v.parse(source, JSON.parse(readFileSync('src/commons/package.json', 'utf8')));
  expect(format.exports['./skins']).toBe('./skins.ts');
  expect(commons.exports['./catalogue']).toBe('./catalogue.ts');
  expect(typeof createCatalogue).toBe('function');
  expect(v.safeParse(SkinLookParametersSchema, { skin: 'a'.repeat(64) }).success).toBe(true);
});
