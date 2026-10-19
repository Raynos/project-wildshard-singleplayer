import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectBloomthroatIguanaNative, admitBloomthroatIguanaNative } from './bloomthroat-iguana-native-admission.mjs';

await test('selected complete source remains pinned without contact acceptance',()=>{
 const row=inspectBloomthroatIguanaNative(process.cwd());
 assert.equal(row.receipt.sourceIntegrity,true);assert.equal(row.receipt.buildAllowed,false);
 assert.equal(row.receipt.runtimeAcceptance,false);assert.equal(row.receipt.colliderAcceptance,false);
 assert.equal(row.metadata.bodies[0].bones.length,27);assert.equal(row.payload.length,36681);
});
await test('build admission fails closed on the explicit living/corpse blockers',()=>{
 assert.throws(()=>admitBloomthroatIguanaNative(process.cwd()),/runtime admission refused.*Upper chest/);
});
