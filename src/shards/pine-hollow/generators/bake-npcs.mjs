import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {bakeNpcSkin} from './npcSkin.ts';

const out=new URL('../../../../public/assets/pine-hollow/npcs/',import.meta.url),rows={};
mkdirSync(out,{recursive:true});
for(const kind of ['ranger','trader','miller']) {
  rows[kind]={};
  for(const tier of ['desktop','phone']) {
    const source=`${kind}${tier==='phone'?'.phone':''}.glb`, made=await bakeNpcSkin(new Uint8Array(readFileSync(new URL(source,out))),{id:`pine.${kind}`,lantern:kind==='ranger'});
    const hash=createHash('sha256').update(made.glb).digest('hex'),file=`${kind}-skin-${hash}${tier==='phone'?'.phone':''}.glb`;
    writeFileSync(new URL(file,out),made.glb);
    rows[kind][tier]={material:`/assets/pine-hollow/npcs/${source}`,url:`/assets/pine-hollow/npcs/${file}`,...made.metadata};
    console.info(`${file} ${made.glb.length} B, ${made.geometry.getAttribute('position').count} vertices`);
    made.geometry.dispose();
  }
}
writeFileSync(new URL('../data/npcSkins.generated.json',import.meta.url),`${JSON.stringify(rows)}\n`);
