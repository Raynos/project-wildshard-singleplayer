import { HeldEquipmentSchema } from '../src/format/heldEquipment';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths use the executing mirror, never the shared checkout.
import {cwd} from 'node:process';
import {expect,it} from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Small disposable schema fixtures, never repository copies.
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the fixture below the repository's ignored tmp/.
import {join} from 'node:path';
import {sectionSchemaTables,writeSectionSchemaTables} from '../scripts/bake-section-schemas.mjs';
import {sectionType} from '../scripts/section-types.mjs';
import {SECTIONS as runtime} from '../src/shards/pine-hollow/generators/sections';
import {WIRE_SCHEMAS} from '../src/shards/pine-hollow/generators/sectionSchemas';

function fixture():{root:string;source:string} {
  mkdirSync(join(cwd(),'tmp'),{recursive:true});
  const root=mkdtempSync(join(cwd(),'tmp/section-schemas-'));
  mkdirSync(join(root,'src/format'),{recursive:true});
  writeFileSync(join(root,'src/format/package.json'),JSON.stringify({exports:{}}));
  mkdirSync(join(root,'src/shards/sample/generators'),{recursive:true});
  return {root,source:join(root,'src/shards/sample/generators/sections.ts')};
}

it('derives deterministic plain schema tables from the same registry',async()=>{
  const {root,source}=fixture();
  const registry="import * as v from 'valibot'; export const SECTIONS={'custom/probe':v.strictObject({n:v.pipe(v.number(),v.minValue(1))})};";
  try {
    writeFileSync(source,registry);
    const first=await writeSectionSchemaTables(root,'sample'),bytes=readFileSync(first.path,'utf8');
    expect(first.schemas).toBe(1);expect(bytes).not.toContain(registry);expect(bytes).toContain('WIRE_SCHEMAS');
    const declarations=readFileSync(join(root,'src/shards/sample/runtime/productSections.d.ts'),'utf8');
    expect(declarations).toContain('"custom/probe": { "n": number; };');
    expect(declarations).not.toContain('valibot');
    expect(readFileSync((await writeSectionSchemaTables(root,'sample')).path,'utf8')).toBe(bytes);
    expect((await sectionSchemaTables(root,'sample')).tables['src/shards/sample/generators/sectionSchemas.ts']).toBe(bytes);
    await writeSectionSchemaTables(root,'sample',{check:true});
    writeFileSync(source,registry.replace('minValue(1)','minValue(2)'));
    await expect(writeSectionSchemaTables(root,'sample',{check:true})).rejects.toThrow('Stale section schema tables');
    expect(readFileSync(first.path,'utf8')).toBe(bytes);
    const second=await writeSectionSchemaTables(root,'sample');
    expect(second.sourceHash).not.toBe(first.sourceHash);
    expect(readFileSync(second.path,'utf8')).toContain('"minimum":2');
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('preserves tuple, optional and union shapes and refuses unresolved declaration types',()=>{
  expect(sectionType({type:'object',properties:{at:{type:'array',items:[{type:'number'},{type:'number'}]},mode:{enum:['a','b']}},required:['at'],additionalProperties:false}))
    .toBe('{ "at": [number, number]; "mode"?: "a" | "b"; }');
  expect(sectionType({type:'array',items:{enum:['a','b']}})).toBe('("a" | "b")[]');
  expect(sectionType({type:'array',items:{type:'array',items:{type:'number'}}})).toBe('number[][]');
  expect(()=>sectionType({$ref:'#/missing'})).toThrow('Unresolved');
  expect(()=>sectionType({pattern:'unknown'})).toThrow('Unsupported');
});

it('validates authored JSON without emitting companion declaration shims',async()=>{
  const {root,source}=fixture();
  try {
    mkdirSync(join(root,'src/shards/sample/data'),{recursive:true});
    const data=join(root,'src/shards/sample/data/points.json');
    writeFileSync(data,'{"at":[1,2]}');
    writeFileSync(source,"import * as v from 'valibot'; export const SECTIONS={}; export const FILE_SCHEMAS={'data/points.json':v.strictObject({at:v.tuple([v.number(),v.number()])})};");
    await writeSectionSchemaTables(root,'sample');
    expect(existsSync(data.replace('.json','.d.json.ts'))).toBe(false);
    writeFileSync(data,'{"at":[1]}');
    await expect(writeSectionSchemaTables(root,'sample')).rejects.toThrow();
    writeFileSync(source,"import * as v from 'valibot'; export const SECTIONS={}; export const FILE_SCHEMAS={'../outside.json':v.number()};");
    await expect(writeSectionSchemaTables(root,'sample')).rejects.toThrow('Invalid typed JSON');
    writeFileSync(source,"export const SECTIONS={}; export const FILE_SCHEMAS=1;");
    await expect(writeSectionSchemaTables(root,'sample')).rejects.toThrow('FILE_SCHEMAS object');
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('refuses runtime dependencies and unknown custom predicates instead of dropping checks',async()=>{
  const {root,source}=fixture();
  try {
    writeFileSync(source,"import value from './index'; export const SECTIONS=value;");
    await expect(writeSectionSchemaTables(root,'sample')).rejects.toThrow('public format schemas');
    writeFileSync(source,"import * as v from 'valibot'; export const SECTIONS={'custom/probe':v.pipe(v.number(),v.check(n=>n>0))};");
    await expect(writeSectionSchemaTables(root,'sample')).rejects.toThrow();
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('admits only the finite defining author selector from the SDK',async()=>{
  const {root,source}=fixture();
  try {
    writeFileSync(source,"import {authorFormatSchema as schema} from '@wildshard/sdk/formatJsonSchema'; export const ProbeSchema=schema('sceneDressing.SceneFloorSchema'); export const SECTIONS={'custom/probe':ProbeSchema};");
    const first=await sectionSchemaTables(root,'sample');
    expect(first.report.schemas).toBe(1);
    expect(first.tables['src/shards/sample/generators/sectionSchemas.ts']).toContain('"custom/probe"');
    expect(first.tables['src/shards/sample/runtime/productSections.d.ts']).not.toContain('valibot');
    for(const binding of ['* as sdk','sdk','{formatJsonSchema}','{authorFormatSchema,formatJsonSchema}','{}']) {
      writeFileSync(source,`import ${binding} from '@wildshard/sdk/formatJsonSchema'; export const SECTIONS={};`);
      await expect(sectionSchemaTables(root,'sample')).rejects.toThrow('finite author selector');
    }
    writeFileSync(source,"import {authorFormatSchema} from '@wildshard/sdk/formatJsonSchema'; export const SECTIONS={'custom/probe':authorFormatSchema('missing.Schema')};");
    await expect(sectionSchemaTables(root,'sample')).rejects.toThrow('Unknown author format');
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('keeps held semantic refusals on the public platform schema',()=>{
  expect(Object.keys(WIRE_SCHEMAS)).toEqual(Object.keys(runtime));
  expect(Object.keys(WIRE_SCHEMAS)).toEqual(Object.keys(runtime));
  expect(Object.hasOwn(runtime,'custom/heldPlayback')).toBe(false);
  const program={id:'schema-case',reads:[],nodes:[{op:'constant',value:1}],channels:[{property:'x',value:0}]};
  const value=(row:unknown)=>({crossbow:[row],lever:[],crossbowParts:[],leverParts:[]});
  const schema=HeldEquipmentSchema.entries.playback;
  expect(v.parse(schema,value(program))).toEqual(value(program));
  expect(()=>v.parse(schema,value({...program,nodes:[{op:'sin',a:0}]}))).toThrow();
  expect(()=>v.parse(schema,value({...program,reads:[123]}))).toThrow();
});
