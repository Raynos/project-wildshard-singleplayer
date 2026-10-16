// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths use the executing mirror, never the shared checkout.
import {cwd} from 'node:process';
import {expect,it} from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Small disposable schema fixtures, never repository copies.
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the fixture below the repository's ignored tmp/.
import {join} from 'node:path';
import {writeSectionSchemaBridge} from '../scripts/bake-section-schemas.mjs';
import {SECTIONS as runtime} from '../src/shards/pine-hollow/runtime/sections';
import {SECTIONS as generated,WIRE_SCHEMAS} from '../src/shards/pine-hollow/generators/sectionSchemas.generated';
import {encodeCanonicalJson} from '../src/sdk/immutable';
import {validateDefinedSection} from '../src/sdk/sections';

function fixture():{root:string;source:string} {
  mkdirSync(join(cwd(),'tmp'),{recursive:true});
  const root=mkdtempSync(join(cwd(),'tmp/section-schemas-'));
  mkdirSync(join(root,'src/format'),{recursive:true});
  writeFileSync(join(root,'src/format/package.json'),JSON.stringify({exports:{}}));
  mkdirSync(join(root,'src/shards/sample/runtime'),{recursive:true});
  return {root,source:join(root,'src/shards/sample/runtime/sections.ts')};
}

it('derives deterministic validator and disk schema bytes from the same registry',async()=>{
  const {root,source}=fixture();
  const registry="import * as v from 'valibot'; export const SECTIONS={'custom/probe':v.strictObject({n:v.pipe(v.number(),v.minValue(1))})};";
  try {
    writeFileSync(source,registry);
    const first=await writeSectionSchemaBridge(root,'sample'),bytes=readFileSync(first.path,'utf8');
    expect(first.schemas).toBe(1);expect(bytes).toContain(registry);expect(bytes).toContain('WIRE_SCHEMAS');
    expect(readFileSync((await writeSectionSchemaBridge(root,'sample')).path,'utf8')).toBe(bytes);
    writeFileSync(source,registry.replace('minValue(1)','minValue(2)'));
    const second=await writeSectionSchemaBridge(root,'sample');
    expect(second.sourceHash).not.toBe(first.sourceHash);
    expect(readFileSync(second.path,'utf8')).toContain('"minimum":2');
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('refuses runtime dependencies and unknown custom predicates instead of dropping checks',async()=>{
  const {root,source}=fixture();
  try {
    writeFileSync(source,"import value from './index'; export const SECTIONS=value;");
    await expect(writeSectionSchemaBridge(root,'sample')).rejects.toThrow('public format schemas');
    writeFileSync(source,"import * as v from 'valibot'; export const SECTIONS={'custom/probe':v.pipe(v.number(),v.check(n=>n>0))};");
    await expect(writeSectionSchemaBridge(root,'sample')).rejects.toThrow();
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('keeps Pine public semantic refusals in the generated producer validator',()=>{
  expect(Object.keys(generated)).toEqual(Object.keys(runtime));
  expect(Object.keys(WIRE_SCHEMAS)).toEqual(Object.keys(runtime));
  const program={id:'schema-case',reads:[],nodes:[{op:'constant',value:1}],channels:[{property:'x',value:0}]};
  const value=(row:unknown)=>({crossbow:[row],lever:[],crossbowParts:[],leverParts:[]});
  const key='custom/heldPlayback',schema=WIRE_SCHEMAS[key];if(schema===undefined)throw new Error('Missing generated disk schema');
  const bytes=new TextEncoder().encode(encodeCanonicalJson(schema));
  expect(v.parse(generated[key],value(program))).toEqual(v.parse(runtime[key],value(program)));
  expect(validateDefinedSection(bytes,value(program))).toEqual(value(program));
  // The structural disk document cannot express DAG ordering; both defining
  // parsers must retain that refusal instead of accepting a flattened schema.
  const cyclic={...program,nodes:[{op:'sin',a:0}]};
  for(const registry of [runtime,generated])expect(()=>v.parse(registry[key],value(cyclic))).toThrow();
  const invalid={...program,reads:[123]};
  expect(()=>validateDefinedSection(bytes,value(invalid))).toThrow();
});
