// oxlint-disable-next-line import/no-nodejs-modules -- The ruler fixture writes its isolated, minimal output contract.
import { mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine each file to the caller's temporary fixture root.
import { dirname, join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Inventory hashes bind exactly the emitted fixture bytes.
import { createHash } from 'node:crypto';
import { emptyShardfile } from '../../src/sdk/author';
import { codeLines } from '../../scripts/shard-platform.mjs';

export function platformOutput(root:string,slug:string,files:Readonly<Record<string,string>>={},sections:Readonly<Record<string,string>>={}):void {
  const put=(path:string,value:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);};
  const measured=(path:string,text:string):{path:string;hash:string;bytes:number}=>({path,hash:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)});
  const runtime=Object.entries(files).map(([path,text])=>{put(`src/shards/${slug}/${path}`,text);put(`out/${slug}/${path}`,text);return {...measured(path,text),lines:codeLines(text,path)};});
  mkdirSync(join(root,'src/shards',slug),{recursive:true});
  const schemas:{path:string;hash:string;bytes:number}[]=[];
  const rows=Object.entries(sections).map(([name,text])=>{
    const path=`sections/${name}.json`;put(`out/${slug}/${path}`,text);
    const schema=name.startsWith('custom/')?`schemas/${name}.schema.json`:`wildshard:${name}@1`;
    if(name.startsWith('custom/')){put(`out/${slug}/${schema}`,'{}');schemas.push(measured(schema,'{}'));}
    return {name,...measured(path,text),schema};
  });
  const source=emptyShardfile({slug:slug==='_template'?'template':slug,name:'Fixture',author:'Test',revision:1,seed:1});
  put(`out/${slug}/shard.json`,JSON.stringify({format:'wildshard.shardfile',formatVersion:2,sdk:'0.2',version:source.version,
    identity:source.identity,build:{sourceHash:'0'.repeat(64),validator:'fixture'},requires:source.requires,
    admission:{budgets:source.budgets,serverBudget:source.serverBudget,authorCaps:source.authorCaps,critical:source.critical,library:source.library},
    sections:rows,schemas,files:[],runtime:runtime.length===0?null:{entry:runtime[0]?.path??'runtime/index.ts',trust:'first-party',files:runtime,lines:runtime.reduce((sum,row)=>sum+row.lines,0)}}));
}
