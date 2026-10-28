import {expect,test} from 'vitest';
import {parse} from 'valibot';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {nalatiGrassJson} from './fixtures/nalati-grass-bake';
import {nalatiLateGrassNames} from '../src/shards/nalati-grasslands/generators/modelBindings';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {GRASS_FILES} from './fixtures/nalatiGrass';

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

test('desktop timing hints retain the original complete scene and channel bytes',()=>{
  const pins=[
    ['look/grass/desktop-blades.bin',836,'2903222b4e9072885d98d9434933aaade07be95be3f7d99dca0a0b09842195ba'],
    ['look/grass/desktop-cards.bin',389,'4816316c024a1666da03e3d0f6d52737b361cbf9344ae14f0c4b94ca2de8ca64'],
    ['look/grass/desktop-flowers.bin',466,'9f47e3acdb952a17e7a24b50f579209a34667b0be61e6159ea31fb4d17209e3d'],
    ['look/grass/desktop-channels.bin',329113,'a89aeadca3519ca8ff4e67700fdff64d4009252d678175ee1909969ba0350117'],
  ]as const;
  for(const [file,bytes,hash]of pins){
    const source=GRASS_FILES.get(file);if(source===undefined)throw new Error('Missing original grass source');
    expect(source.byteLength).toBe(bytes);expect(hashImmutableBytes(source)).toBe(hash);
  }
});
