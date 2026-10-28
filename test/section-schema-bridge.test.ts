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

it('derives identical complete tables from finite source-owned contracts and keeps file admission strict', async () => {
  const { root, source } = fixture();
  const registries = "export const SECTIONS={'custom/probe':ProbeSchema,'custom/floor':FloorSchema}; export const FILE_SCHEMAS={'data/probe.json':ProbeSchema};";
  const floor = "export const FloorSchema=native('sceneDressing.SceneFloorSchema');";
  try {
    mkdirSync(join(root, 'src/shards/sample/data'), { recursive: true });
    const data = join(root, 'src/shards/sample/data/probe.json');
    writeFileSync(data, '{"n":2,"at":[1,2]}');
    writeFileSync(source, `import * as v from 'valibot'; import {authorFormatSchema as native} from '@wildshard/sdk/formatJsonSchema'; export const ProbeSchema=v.strictObject({n:v.pipe(v.number(),v.finite(),v.minValue(1)),at:v.tuple([v.number(),v.number()]),maybe:v.exactOptional(v.boolean())});${floor}${registries}`);
    const before = await sectionSchemaTables(root, 'sample');
    writeFileSync(source, `import {authorFormatSchema as native,defineNamedRows as contract,type NamedRows,type NamedRowValue} from '@wildshard/sdk/formatJsonSchema'; import type {NamedRowInput,NamedJsonComposition} from '@wildshard/sdk/formatJsonSchema'; const shape={kind:'object',mode:'strict',entries:{n:{kind:'number',finite:true,min:1},at:{kind:'tuple',items:[{kind:'number'},{kind:'number'}]},maybe:{kind:'exact-optional',item:{kind:'boolean'}}}} as const satisfies NamedJsonComposition; type Input=NamedRowInput<typeof shape>; type Output=NamedRowValue<typeof shape>; export const ProbeSchema:NamedRows<Output,Input>['schema']=contract(shape).schema;${floor}${registries}`);
    const after = await sectionSchemaTables(root, 'sample');
    expect(after.report.schemas).toBe(2);
    expect(after.report.sourceHash).not.toBe(before.report.sourceHash);
    for (const [path, table] of Object.entries(before.tables))
      expect(after.tables[path]?.split('\n').slice(1).join('\n')).toBe(table.split('\n').slice(1).join('\n'));
    await writeSectionSchemaTables(root, 'sample');
    await writeSectionSchemaTables(root, 'sample', { check: true });
    writeFileSync(data, '{"n":2,"at":[1,2],"unregistered":true}');
    await expect(sectionSchemaTables(root, 'sample')).rejects.toThrow();
    writeFileSync(data, '{"n":2,"at":[1]}');
    await expect(sectionSchemaTables(root, 'sample')).rejects.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses unregistered SDK exports, value imports of types and unknown source refinements', async () => {
  const { root, source } = fixture();
  try {
    for (const binding of ['* as sdk', 'sdk', '{}', '{defineNamedRows,formatJsonSchema}', '{NamedRowValue}', 'type {Unregistered}']) {
      writeFileSync(source, `import ${binding} from '@wildshard/sdk/formatJsonSchema'; export const SECTIONS={};`);
      await expect(sectionSchemaTables(root, 'sample')).rejects.toThrow('finite author selector');
    }
    writeFileSync(source, "import {defineNamedRows} from '@wildshard/sdk/formatJsonSchema'; export const ProbeSchema=defineNamedRows({kind:'number'},n=>n>0,'positive').schema; export const SECTIONS={'custom/probe':ProbeSchema};");
    await expect(sectionSchemaTables(root, 'sample')).rejects.toThrow();
    writeFileSync(source, "import {defineNamedRows} from '@wildshard/sdk/formatJsonSchema'; const module=await import('./runtime'); export const SECTIONS={};");
    await expect(sectionSchemaTables(root, 'sample')).rejects.toThrow('dynamically import');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
