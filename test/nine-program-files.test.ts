// oxlint-disable-next-line import/no-nodejs-modules -- Verify the registered producers' actual outputs.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect,test,vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { hashImmutableBytes,encodeCanonicalJson } from '../src/sdk/immutable';
import { buildCourseProgram } from '../src/commons/practiceCourse';
import { admitScriptContract } from '../src/format/scriptContract';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { prepareClientReturnModules } from '../src/game/shardfile/clientReturnModules';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { clientNativeBook } from '../src/game/shardfile/clientNativeBook';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import * as descriptors from '../src/game/shardfile/outputDescriptor';
import type { OutputDescriptor } from '../src/game/shardfile/outputDescriptor';
import type { ShardContext } from '../src/game/plugin/context';
import { emptyShardfile } from '../src/sdk/author';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { ninePracticeRows,ninePracticeBytes } from './fixtures/nine-practice-modules';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { NINE_MOVERS_CONTRACT } from '../src/shards/nine-dragon-stack/generators/moversProgram';

const hash=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u)),count=v.pipe(v.number(),v.safeInteger(),v.minValue(1));
const compiled=v.strictObject({source:v.string(),bytes:count,hash});
test('both actual raw executables and complete original contracts remain byte-identical',async()=>{
  const practice=v.parse(v.strictObject({script:v.unknown(),bytes:v.literal(''),compiled}),JSON.parse(readFileSync('src/shards/nine-dragon-stack/behaviour/practice.generated.json','utf8')));
  expect(practice.compiled).toEqual({source:'behaviour/practice.generated.wasm',bytes:9786,hash:'6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102'});
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({script:practice.script})))).toBe('9127647ac9e42b887da2e4affd59f7e74e3a2d9c9e22263fa35991c20675e8a9');
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({lane:NINE_MOVERS_CONTRACT.lane,pages:NINE_MOVERS_CONTRACT.pages,ioBytes:NINE_MOVERS_CONTRACT.ioBytes})))).toBe('e3576adf14d47596fbd43c7c2dc7cb682d49ea8733fd0a05cc7af69bee8d0158');
  const view=await compileScriptV2(readFileSync('src/shards/nine-dragon-stack/behaviour/movers.as','utf8'),{lane:NINE_MOVERS_CONTRACT.lane,ioBytes:NINE_MOVERS_CONTRACT.ioBytes});
  expect(hashImmutableBytes(ninePracticeBytes)).toBe(practice.compiled.hash);expect(hashImmutableBytes(view)).toBe('3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276');expect(view.byteLength).toBe(4859);
  expect(()=>admitScriptContract(ninePracticeBytes,{abi:1,pages:1})).not.toThrow();
  expect(()=>admitScriptContract(view,{abi:2,lane:'view',pages:1,ioBytes:4096,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission})).not.toThrow();
});

test('the shared course compiler retains its complete legacy default and original binary',async()=>{
  const legacy=await buildCourseProgram('checkpoints'),raw=await buildCourseProgram('checkpoints',{},true);
  expect(Object.keys(legacy)).toEqual(['script','bytes']);expect(legacy.script).toEqual(ninePracticeRows.script);
  expect(Uint8Array.from(atob(legacy.bytes),value=>value.codePointAt(0)??0)).toEqual(ninePracticeBytes);
  expect(raw).toEqual({script:legacy.script,bytes:'',binary:ninePracticeBytes});
});

test('pure ABI1 page preparation lends the same map to both original scopes exactly once',async()=>{
  const root=new Scope('course-root'),scope=root.child('construction'),level=root.child('entered'),other=new Scope('unrelated-course');
  const row=ninePracticeRows.script,moduleHash=row.module.slice('blobs/wasm/'.length,-'.wasm'.length),name='behaviour/practice.wasm',read=vi.fn(()=>Promise.resolve(ninePracticeBytes));
  const source=emptyShardfile({slug:'finite-course',name:'Course',author:'Fixture',revision:1,seed:1});
  const product=createShardProduct({slug:'finite-course',revision:1,shardfile:source,sections:new Map([['actors/return-scripts',[row]]]),files:new Map([[name,{hash:moduleHash,url:'/fixture/course.wasm'}]]),read});
  const ctx=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world:legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>>({game:legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>['game']>({levelScope:level})})})})});
  const descriptor=vi.spyOn(descriptors,'outputDescriptor').mockReturnValue(legacyDouble<OutputDescriptor>({index:legacyDouble<OutputDescriptor['index']>({files:[legacyDouble<OutputDescriptor['index']['files'][number]>({kind:'wasm',hash:moduleHash,name,dependencies:[]})]})}));
  try{
    await prepareClientReturnModules(ctx);await prepareClientReturnModules(ctx);
    expect(read).toHaveBeenCalledTimes(1);expect(clientNativeBook(ctx).decisionAssets.get(moduleHash)).toBe(ninePracticeBytes);
    const frame=Object.fromEntries(Object.values(row.fields).map(field=>[field,0]));
    const inline=ReturnProgram.page({script:row,bytes:Buffer.from(ninePracticeBytes).toString('base64')});
    expect(ReturnProgram.page(ninePracticeRows,scope).project('reset',frame)).toEqual(inline.project('reset',frame));
    expect(ReturnProgram.page(ninePracticeRows,level).project('reset',frame)).toEqual(inline.project('reset',frame));
    expect(()=>ReturnProgram.page(ninePracticeRows,other)).toThrow('Missing admitted raw return module loan');
    root.dispose();expect(()=>ReturnProgram.page(ninePracticeRows,level)).toThrow('owner disposed');
  }finally{descriptor.mockRestore();root.dispose();other.dispose();}
});
