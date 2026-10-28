import {expect,test} from 'vitest';
import {parse} from 'valibot';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {nalatiGrassJson} from './fixtures/nalati-grass-bake';
import {nalatiLateGrassNames} from '../src/shards/nalati-grasslands/generators/modelBindings';

test('only exclusive desktop grass files defer; original phone and shared channels stay eager',()=>{
  const rows=parse(GrassPresentationSchema,nalatiGrassJson()),before=structuredClone(rows);
  const desktop=grassPresentationFiles(rows,'desktop'),phone=grassPresentationFiles(rows,'phone');
  expect(nalatiLateGrassNames(rows)).toEqual(desktop.filter(file=>!phone.includes(file)).sort());
  expect(nalatiLateGrassNames(rows)).toEqual(['look/grass/desktop-blades.bin','look/grass/desktop-cards.bin','look/grass/desktop-channels.bin','look/grass/desktop-flowers.bin']);
  expect(rows).toStrictEqual(before);
  const shared={...rows,desktop:{...rows.desktop,channels:rows.phone.channels}};
  expect(nalatiLateGrassNames(shared)).not.toContain(rows.phone.channels?.file);
  expect(()=>nalatiLateGrassNames({})).toThrow('Missing grass timing tiers');
});
