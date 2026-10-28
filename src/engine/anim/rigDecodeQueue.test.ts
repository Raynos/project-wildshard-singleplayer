import { expect, test } from 'vitest';
import { RigDecodeQueue } from './rigDecodeQueue';

function gate(){let finish:()=>void=()=>undefined;const pending=new Promise<void>(resolve=>{finish=resolve;});return {pending,finish};}
test('interactive demand passes only queued background work; the active slot and both FIFO orders remain',async()=>{
  const queue=new RigDecodeQueue(),active=gate(),started=gate(),order:string[]=[];
  const first=queue.enqueue(async()=>{order.push('active');started.finish();await active.pending;order.push('active-end');return 1;});await started.pending;
  const background=queue.enqueue(async()=>{order.push('normal-1');await Promise.resolve();return 2;});
  const background2=queue.enqueue(async()=>{order.push('normal-2');await Promise.resolve();return 3;});
  const demand=queue.enqueue(async()=>{order.push('demand-1');await Promise.resolve();return 4;},'interactive');
  const demand2=queue.enqueue(async()=>{order.push('demand-2');await Promise.resolve();return 5;},'interactive');
  expect(order).toEqual(['active']);active.finish();expect(await Promise.all([first,background,background2,demand,demand2])).toEqual([1,2,3,4,5]);
  expect(order).toEqual(['active','active-end','demand-1','demand-2','normal-1','normal-2']);
});
test('a failed active or interactive parse releases the one slot without poisoning normal work',async()=>{
  const queue=new RigDecodeQueue(),active=gate(),started=gate(),failure=new Error('decode refusal'),order:string[]=[];
  const first=queue.enqueue(async()=>{started.finish();await active.pending;throw failure;});void first.catch(()=>undefined);await started.pending;
  const normal=queue.enqueue(async()=>{order.push('normal');await Promise.resolve();return 7;});
  const demand=queue.enqueue(async()=>{order.push('demand');await Promise.resolve();throw failure;},'interactive');void demand.catch(()=>undefined);
  active.finish();await expect(first).rejects.toBe(failure);await expect(demand).rejects.toBe(failure);await expect(normal).resolves.toBe(7);expect(order).toEqual(['demand','normal']);
});
