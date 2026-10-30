import {expect,test} from 'vitest';
import {assertNativeWalkResult,nativeWalkSelection,runNativePhysicsWalk} from '../scripts/physics-native.mjs';

test('native route selection preserves explicit leg repetitions and refuses no work',()=>{
  const routes={$doc:'metadata',first:[{name:'bridge'},{name:'stairs'}],second:[{name:'bridge'}]};
  expect(nativeWalkSelection(routes,[]).count).toBe(3);
  expect(nativeWalkSelection(routes,['--shard=first','--leg=bridge','--repeat=3']).count).toBe(3);
  expect(nativeWalkSelection(routes,['--leg=bridge']).count).toBe(2);
  expect(()=>nativeWalkSelection(routes,['--shard=missing'])).toThrow('No native physics route');
  expect(()=>nativeWalkSelection(routes,['--leg=missing'])).toThrow('No native physics route');
  expect(()=>nativeWalkSelection(routes,['--repeat=0'])).toThrow('--repeat');
  expect(()=>nativeWalkSelection(routes,['--repeat=11'])).toThrow('--repeat');
});
test('a zero-exit partial or failed collection cannot report a zero-stuck walk',()=>{
  expect(()=>assertNativeWalkResult({success:true,numPassedTests:0,numFailedTests:0},3)).toThrow('Incomplete native physics proof');
  expect(()=>assertNativeWalkResult({success:true,numPassedTests:2,numFailedTests:0},3)).toThrow('Incomplete native physics proof');
  expect(()=>assertNativeWalkResult({success:false,numPassedTests:3,numFailedTests:1},3)).toThrow('Incomplete native physics proof');
  expect(()=>assertNativeWalkResult({success:true,numPassedTests:3,numFailedTests:0},3)).not.toThrow();
});
test('route names are literal selections rather than test-name regular expressions',()=>{
  const routes={first:[{name:'stairs.[a]+'},{name:'stairsXaaa'}],second:[{name:'stairsXaaa'}]};
  const selected=nativeWalkSelection(routes,['--leg=stairs.[a]+']);
  expect(selected.count).toBe(1);expect(selected.slugs).toEqual(['first']);
});
test('a native proof cannot silently claim a remote preview or browser variant',()=>{
  expect(()=>runNativePhysicsWalk('.', ['--url=http://127.0.0.1:4400'])).toThrow('not a browser preview');
  expect(()=>runNativePhysicsWalk('.', ['--video'])).toThrow('has no video');
  expect(()=>runNativePhysicsWalk('.', ['--settings=gravity=low'])).toThrow('Browser variants');
  expect(()=>runNativePhysicsWalk('.', ['--tier=desktop'])).toThrow('Browser variants');
});
