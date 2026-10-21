import {expect,it} from 'vitest';
import {chromiumProcessPeaks,ownedResidencyBytes} from '../scripts/grid-ready-memory.mjs';

it('reads hexadecimal CDP footprint bytes and sums simultaneous renderer processes',()=>{
 const names=['Browser','Renderer','Renderer','GPU Process'].map((name,pid)=>({name:'process_name',pid,args:{name}}));
 const row=(pid:number,bytes:string,id='1')=>({ph:'v',pid,id,args:{dumps:{process_totals:{private_footprint_bytes:bytes}}}});
 expect(chromiumProcessPeaks([...names,row(0,'100'),row(1,'200'),row(2,'300'),row(3,'400'),row(1,'600','2')]))
  .toEqual({browser:256,renderer:1536,gpu:1024});
 expect(()=>chromiumProcessPeaks([...names,row(0,'100'),row(1,'200')])).toThrow('required process');
});

it('counts effective own-cell bytes and its product once without page or other-cell charges',()=>{
 const claims=[{id:'sim:template-2',owner:'template-2',accountedBytes:100},
  {id:'library:covered',owner:'template-2',accountedBytes:0},
  {id:'product:grid:_template',owner:'grid',accountedBytes:20},
  {id:'sim:other',owner:'other',accountedBytes:900},
  {id:'page:programs',owner:'platform',accountedBytes:700}];
 expect(ownedResidencyBytes(claims,'template-2','_template')).toBe(120);
 expect(()=>ownedResidencyBytes([{id:'bad',owner:'template-2',accountedBytes:-1}],'template-2','_template')).toThrow('Invalid owned');
});
