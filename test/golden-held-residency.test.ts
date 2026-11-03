// @vitest-environment happy-dom
import {afterEach,expect,test,vi} from 'vitest';
import {heldGoldenResidency} from '../scripts/goldens/native-residency.mjs';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(state='published',mutate=false):void {
  const game={hold:true,frameCount:17,app:{clock:{snapshot:()=>({frame:17,time:10})}},camera:{matrixWorld:{elements:[1,0,0,1]}}};
  vi.stubGlobal('__wildshard',{world:{game,player:{position:{toArray:()=>[2,3,4]}}}});
  vi.stubGlobal('__goldenResidency',{jobs:[{id:'native',state}]});
  vi.stubGlobal('requestAnimationFrame',(onFrame:FrameRequestCallback)=>{
    if(mutate)game.frameCount++;
    queueMicrotask(()=>{onFrame(0);});return 1;
  });
}
test('native publication fence returns a held snapshot without consuming a frame',async()=>{
  fixture();
  await expect(heldGoldenResidency()).resolves.toMatchObject({pending:0,turns:1,heldState:{frame:17,player:[2,3,4]}});
});
test('native publication fence rejects failed, retired and unobserved worlds',async()=>{
  for(const state of ['failed','retired']) {fixture(state);await expect(heldGoldenResidency()).rejects.toThrow('failed or retired');}
  fixture();vi.stubGlobal('__goldenResidency',{jobs:[]});
  await expect(heldGoldenResidency()).rejects.toThrow('not bound');
});
test('native publication fence refuses game movement and has a bounded pending wait',async()=>{
  fixture('published',true);await expect(heldGoldenResidency()).rejects.toThrow('changed frame, clock, camera or player');
  fixture('pending');vi.spyOn(Date,'now').mockReturnValueOnce(0).mockReturnValue(30000);
  await expect(heldGoldenResidency()).rejects.toThrow('did not settle');
});
