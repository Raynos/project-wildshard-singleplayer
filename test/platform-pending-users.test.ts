import { expect, test } from 'vitest';
import { partitionPendingPlatformUsers, type PendingPlatformUser } from '../scripts/shard-platform.mjs';

test('reports a named pending export without waiving helpers or later-wave custom code',()=>{
  const module='src/game/feature.ts';
  const allowance:PendingPlatformUser={module,export:'feature',shard:'driftwood-isle',
    plan:{path:'docs/plans/feature.md',row:'F1'},documentation:'docs/API.md','rechecked-by':'end of W3'};
  const rows=[{path:module,name:'feature',exported:true,lines:1},{path:module,name:'helper',exported:true,lines:1}];
  const report=partitionPendingPlatformUsers('sunscar-dunes',[],rows,[allowance]);
  expect(report.exports).toEqual(expect.arrayContaining([expect.objectContaining({name:'helper'})]));
  expect(report.exports).not.toEqual(expect.arrayContaining([expect.objectContaining({name:'feature'})]));
  expect(report.pending).toEqual(expect.arrayContaining([expect.objectContaining({name:'feature',status:'pending second user',users:[allowance]})]));
  expect(partitionPendingPlatformUsers('driftwood-isle',[],rows,[allowance]).exports).toEqual(rows);
  expect(partitionPendingPlatformUsers('sunscar-dunes',[],rows,[]).exports).toEqual(rows);
  expect(partitionPendingPlatformUsers('sunscar-dunes',[{path:module,lines:4}],[],[allowance]).modules)
    .toEqual(expect.arrayContaining([expect.objectContaining({path:module})]));
});
