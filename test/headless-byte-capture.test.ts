// oxlint-disable-next-line import/no-nodejs-modules -- The continuation fixture uses the shipped native physics binary.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {createSimHost,type SimHost} from '@wildshard/engine/sim';
import {loadRapier} from '@wildshard/engine/physics/rapier';
import {snapshotSimHost,snapshotSimHostBytes,serializeSimSnapshot,decodeSimSnapshot,restoreSimHost} from '@wildshard/engine/sim/snapshot';
import {SIM_LEVEL,fightCommand} from './fixtures/sim-level/level';

test('byte capture retains exact native fight checkpoint wire and restored suffix',async()=>{
 const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
 const host=createSimHost(SIM_LEVEL,{rapier});let restored:SimHost|undefined;
 try{
  for(let tick=0;tick<120;tick++)host.step(fightCommand(tick));
  const legacy=serializeSimSnapshot(snapshotSimHost(host)),bytes=snapshotSimHostBytes(host);
  expect(bytes.physics).toBeInstanceOf(Uint8Array);
  expect(serializeSimSnapshot(bytes)).toBe(legacy);
  const frozen=bytes.physics.slice();
  restored=restoreSimHost(SIM_LEVEL,{rapier},decodeSimSnapshot(legacy));
  for(let tick=120;tick<132;tick++){
   host.step(fightCommand(tick));restored.step(fightCommand(tick));
   const checkpoint=serializeSimSnapshot(snapshotSimHostBytes(host));
   expect(checkpoint).toBe(serializeSimSnapshot(snapshotSimHost(host)));
   expect(serializeSimSnapshot(snapshotSimHostBytes(restored))).toBe(checkpoint);
  }
  expect(bytes.physics).toEqual(frozen);
 }finally{restored?.dispose();host.dispose();}
});
