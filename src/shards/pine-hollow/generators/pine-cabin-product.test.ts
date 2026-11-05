import * as v from 'valibot';
import { expect, test } from 'vitest';
import { CabinAppearanceSchema as CabinRowsSchema } from './sections';
import { staticOutput } from './sourceOutput';
import { readImagePixels } from '@wildshard/sharddev/bake/image';
import { CABIN_LIFE } from './cabinLook';
import { CABIN_LIGHT } from './cabinAssembly';
import { HEARTH_LOOKS } from './hearthLook';
import { pineScriptSources } from './scriptSources.mjs';
import { forestPageRows, worldSceneRows } from '@wildshard/sharddev/worldScenes';
import { outputPlatformPayloads } from '@wildshard/sharddev/outputProduct';

// the program's sources (GR8 G37: the timber world is baked in the program, so no disk file holds it)
const output = await staticOutput(await pineScriptSources('pine-cabin-product-test'), readImagePixels);

test('native cabin carriers retain every authored material and life value and reject malformed rows', () => {
  expect(Object.hasOwn(output, 'custom')).toBe(false);
  const file = output.namedFiles.find(row => row.name === 'world/forest-page.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing defining forest page');
  const page = forestPageRows(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const scenes = worldSceneRows(outputPlatformPayloads(output.platform,['world/scenes']).get('world/scenes'));
  const look = (id:string):string => {
    const row = scenes.materials.find(material => material.id === id);
    if (row?.kind !== 'look') throw new Error(`Missing defining cabin material: ${id}`);
    return row.look;
  };
  const rows = v.parse(CabinRowsSchema,{CABIN_LIFE:page.buildings.life,CABIN_LIGHT:page.buildings.light,
    HEARTH_LOOKS:{smoke:look('cabin.smoke'),flame:look('cabin.flame'),ember:look('cabin.ember')}});
  expect(rows).toEqual({ CABIN_LIFE, CABIN_LIGHT, HEARTH_LOOKS });
  expect(() => v.parse(CabinRowsSchema, { ...rows, extra: true })).toThrow();
  expect(() => v.parse(CabinRowsSchema, { ...rows, CABIN_LIFE: { ...rows.CABIN_LIFE, fire: [0.7] } })).toThrow();
  expect(() => v.parse(CabinRowsSchema, { ...rows, CABIN_LIGHT: { ...rows.CABIN_LIGHT, count: 'two' } })).toThrow();
});
