import { expect,test } from 'vitest';
import { Flags,bindInteractionState } from '../src/engine/world/interact/flags';

test('read-only row state keeps locks, pickup visibility, loot order and live door reach',()=>{
  const flags=new Flags('interaction-state-fixture',false);
  const at={poi:'world' as const,x:0,z:0};
  const chest=bindInteractionState({kind:'chest',id:'chest',at,lock:'hold',requires:{all:['ready']},lockedLabel:'Bring the key',reach:4,
    contents:[{item:'resin',n:2},{key:'gate',label:'Gate key'},{flag:'found:map',label:'Map'}]},flags);
  expect(chest.locked()).toBe('Bring the key');flags.set('ready');expect(chest.locked()).toBe('Bring the key');
  flags.set('key:hold');expect(chest.locked()).toBeNull();expect(chest.promptRadius()).toBe(4);
  expect(chest.contents.map(row=>row.id)).toEqual(['resin','key:gate','found:map']);
  flags.set(chest.open);expect(chest.promptRadius()).toBe(0);
  const pickup=bindInteractionState({kind:'pickup',id:'pickup',at,look:'token',label:'Token',showWhen:{all:['ready']}},flags);
  expect(pickup.shown()).toBe(true);flags.set(pickup.taken);expect(pickup.shown()).toBe(false);expect(pickup.promptRadius()).toBe(0);
  const door=bindInteractionState({kind:'door',id:'door',at,look:'grate',w:2,h:3,reach:4,requires:{all:['ready']}},flags);
  expect(door.promptRadius()).toBe(4);expect(door.promptRadius(1)).toBe(0);expect(door.promptRadius(0,false)).toBe(0);
  const lever=bindInteractionState({kind:'lever',id:'lever',at,latch:true},flags);
  expect(lever.promptRadius()).toBeGreaterThan(0);flags.set(lever.lever);expect(lever.promptRadius()).toBe(0);
  let writes=0;const off=flags.onChange(()=>{writes++;});
  chest.shown();chest.locked();door.promptRadius();expect(writes).toBe(0);off();
  expect(()=>bindInteractionState({kind:'bench',id:'bad',at,label:'Bad',reach:Infinity},flags)).toThrow();
  expect(()=>bindInteractionState({kind:'bench',id:'',at,label:'Bad'},flags)).toThrow();
});
