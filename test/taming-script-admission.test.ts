import {expect,test} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {scriptAdmissionRows,decisionModuleContracts} from '../src/format/scriptContract';
import {hashImmutableBytes} from '../src/sdk/immutable';
import {NALATI_SCRIPT_SECTIONS} from '../src/shards/nalati-grasslands/generators/scriptInventory';
import programs from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with {type:'json'};

test('mounted ABI2 replaces one executable in the complete return/spawn inventory and retains its ABI1 witness',()=>{
  const candidate=programs.approach.v2,bytes=Uint8Array.from(atob(candidate.bytes),value=>value.codePointAt(0)??0);
  expect(programs.approach.script.module).toBe('blobs/wasm/84bd39abf54a633b3946e0e1dea7c1816565609c034799f5310db55a7b65d4ca.wasm');
  expect(hashImmutableBytes(bytes)).toBe(candidate.artifact.hash);expect(candidate.artifact.pages).toBe(1);
  const rows=scriptAdmissionRows(NALATI_SCRIPT_SECTIONS),active=new Set(rows.filter(row=>row.side==='sim').map(row=>row.module));
  expect(active.size).toBe(8);expect(active.has(programs.approach.script.module)).toBe(false);
  const file=`blobs/wasm/${candidate.artifact.hash}.wasm`;expect(active.has(file)).toBe(true);expect(rows.filter(row=>row.module===file)).toHaveLength(1);
  expect(decisionModuleContracts(rows,rows.map(row=>({kind:'wasm',path:row.module,hash:row.module.slice(11,-5)}))).get(candidate.artifact.hash)).toMatchObject({abi:2,lane:'project',pages:1,ioBytes:candidate.artifact.ioBytes});
  const scope=new Scope('mounted.program');try{expect(ReturnProgram.page(programs.approach,scope)).toBe(ReturnProgram.page(programs.breaking,scope));expect(ReturnProgram.page(programs.riding,scope)).toBe(ReturnProgram.page(programs.approach,scope));}finally{scope.dispose();}
});
