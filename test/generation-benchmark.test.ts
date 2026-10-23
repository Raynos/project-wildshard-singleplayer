import {expect,it,vi} from 'vitest';
import {generationBenchmarkOptions,measureGenerationPair} from '../scripts/benchmark-generation.mjs';

it('requires a full revision pin and bounded, unambiguous concurrency',()=>{
  expect(generationBenchmarkOptions([])).toEqual({revision:'HEAD',parallel:'4'});
  expect(generationBenchmarkOptions([`--rev=${'a'.repeat(40)}`,'--parallel=1'])).toEqual({revision:'a'.repeat(40),parallel:'1'});
  for(const args of [['--rev=short'],['--parallel=0'],['--parallel=5'],['--parallel=1','--parallel=2'],['--rev=HEAD','--rev=HEAD'],['--overlay=source.patch']]) {
    expect(()=>generationBenchmarkOptions(args)).toThrow('Expected');
  }
});
it('reports the initial and unchanged warm command walls independently',()=>{
  const run=vi.fn(),report=vi.fn(),clock=vi.fn<()=>number>().mockReturnValueOnce(100).mockReturnValueOnce(2100).mockReturnValueOnce(3100).mockReturnValueOnce(3600);
  measureGenerationPair(()=>{run();},clock,row=>{report(row);});
  expect(run).toHaveBeenCalledTimes(2);
  expect(report.mock.calls).toEqual([[{phase:'initial',seconds:2,success:true}],[{phase:'warm',seconds:.5,success:true}]]);
});
it.each([1,2])('reports failure and stops without retrying run %i',failure=>{
  let calls=0;
  const run=():void=>{calls++;if(calls===failure)throw new Error('producer refused');};
  const report=vi.fn();
  expect(()=>measureGenerationPair(run,()=>0,row=>{report(row);})).toThrow('producer refused');
  expect(calls).toBe(failure);
  expect(report).toHaveBeenLastCalledWith({phase:failure===1?'initial':'warm',seconds:0,success:false});
});
