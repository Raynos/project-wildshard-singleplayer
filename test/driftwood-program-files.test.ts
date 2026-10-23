// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual registered producer outputs.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {RETURN_PROGRAM} from '../src/shards/driftwood-isle/generators/returnProgram';
import {encodeCanonicalJson,hashImmutableBytes} from '../src/sdk/immutable';
import {admitScriptContract} from '../src/format/scriptContract';
import {SCRIPT_V2_REVISIONS} from '../src/format/scriptAdmissionV2';
import {driftwoodReturnBytes,lendDriftwoodReturns} from './fixtures/driftwood-return-modules';

const compiled=v.strictObject({source:v.string(),bytes:v.pipe(v.number(),v.safeInteger(),v.minValue(1)),hash:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))});
test('both raw files preserve the complete original contracts and admitted executable bytes',()=>{
  const returns=v.parse(v.strictObject({script:v.unknown(),bytes:v.literal(''),compiled}),JSON.parse(readFileSync('src/shards/driftwood-isle/behaviour/returns.generated.json','utf8')));
  const bridge=v.parse(v.strictObject({lane:v.literal('view'),pages:v.literal(1),ioBytes:v.literal(4096),bytes:v.literal(''),compiled}),JSON.parse(readFileSync('src/shards/driftwood-isle/behaviour/bridgeSway.generated.json','utf8')));
  expect(returns.compiled).toEqual({source:'behaviour/returns.generated.wasm',bytes:6740,hash:'ba3f8eb53873b6ef51fd116a03e9b2ebc96e68f211f2efe2f6421ee680ca99b1'});
  expect(bridge.compiled).toEqual({source:'behaviour/bridgeSway.generated.wasm',bytes:3027,hash:'693178e1cd72189bcd832d219511e7b357cf57281f8c17e342f3ae27ec9edb6d'});
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({script:returns.script})))).toBe('8c5fe348ed139458b08dcb868c7bb4a9660e3d2017f63e0dec674c7f8e7b9d04');
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({lane:bridge.lane,pages:bridge.pages,ioBytes:bridge.ioBytes})))).toBe('e3576adf14d47596fbd43c7c2dc7cb682d49ea8733fd0a05cc7af69bee8d0158');
  const view=new Uint8Array(readFileSync(`src/shards/driftwood-isle/${bridge.compiled.source}`));
  expect(driftwoodReturnBytes.byteLength).toBe(returns.compiled.bytes);expect(hashImmutableBytes(driftwoodReturnBytes)).toBe(returns.compiled.hash);
  expect(view.byteLength).toBe(bridge.compiled.bytes);expect(hashImmutableBytes(view)).toBe(bridge.compiled.hash);
  expect(()=>admitScriptContract(driftwoodReturnBytes,{abi:1,pages:1})).not.toThrow();
  expect(()=>admitScriptContract(view,{abi:2,lane:'view',pages:1,ioBytes:4096,compilerRevision:SCRIPT_V2_REVISIONS.compiler,admissionRevision:SCRIPT_V2_REVISIONS.admission})).not.toThrow();
});

test('the original scoped return owner reuses its raw executable and refuses missing or retired loans',()=>{
  const owner=new Scope('raw returns');
  try{
    expect(()=>ReturnProgram.page(RETURN_PROGRAM,owner)).toThrow('Missing admitted raw return module loan');
    lendDriftwoodReturns(owner);
    const program=ReturnProgram.page(RETURN_PROGRAM,owner);
    expect(ReturnProgram.page(structuredClone(RETURN_PROGRAM),owner)).toBe(program);
    expect(program.project('schedule',{now:7,minimum:2,maximum:6,draw:.5})).toEqual({due:11});
    owner.dispose();expect(()=>program.project('schedule',{now:7,minimum:2,maximum:6,draw:.5})).toThrow('disposed');
  }finally{owner.dispose();}
});
