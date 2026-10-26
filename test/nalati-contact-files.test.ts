import { nalatiSpecimens } from './fixtures/nalati-specimens';
import { nalatiBalbal } from './fixtures/nalati-balbal';
import { nalatiRuntime } from './fixtures/nalati-runtime';
import { nalatiDecorative } from './fixtures/nalati-decorative';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare frozen native byte witnesses.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit source metadata without a large static JSON type.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import * as v from 'valibot';
import {unzlibSync} from 'fflate';
import {readNamedBlob} from '../src/sdk/blobs';
import {dressingScene,DRESSING_CONTACT_SOURCES} from '../src/shards/nalati-grasslands/generators/dressingScene';
import reference from './fixtures/nalati-contact-blocks.json' with {type:'json'};

const finite=v.pipe(v.number(),v.finite());
const paint=v.parse(v.object({contacts:v.record(v.string(),v.record(v.string(),v.object({file:v.string(),origins:v.array(v.tuple([finite,finite,finite,finite]))})))}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/poiPaint.json','utf8')));
const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');

test('both POI tiers preserve every packed point and ordered origin through named binary intake',async()=>{
  expect(DRESSING_CONTACT_SOURCES).toHaveLength(6);
  for(const before of reference){
    const contact=paint.contacts[before.tier]?.[before.key];if(contact===undefined)throw new Error('Missing native contact source');
    const source=DRESSING_CONTACT_SOURCES.find(row=>row.name===contact.file);if(source===undefined)throw new Error('Missing named contact block');
    const blob=await readNamedBlob('src/shards/nalati-grasslands',source.name,source.source,'bin',source.options),raw=unzlibSync(blob.bytes);
    expect(blob.bytes.length).toBe(before.bytes);expect(hash(blob.bytes)).toBe(before.hash);
    expect(blob.file.decoded).toBe(before.decoded);expect(raw.length).toBe(before.decoded);expect(hash(raw)).toBe(before.pointsHash);
    const origins=new Uint8Array(contact.origins.length*32),view=new DataView(origins.buffer);
    contact.origins.flat().forEach((value,index)=>{view.setFloat64(index*8,value,true);});expect(hash(origins)).toBe(before.originsHash);
    const tier=before.tier;if(tier!=='phone'&&tier!=='desktop')throw new Error('Unknown original contact tier');
    const layer=dressingScene(tier,nalatiDecorative,nalatiRuntime,nalatiBalbal,nalatiSpecimens).layers.find(row=>row.id===`nalati-dress-${before.key}`);
    expect(layer?.contacts).toEqual({kind:'packed-hulls',file:contact.file,origins:contact.origins,surface:'rock'});
  }
});
