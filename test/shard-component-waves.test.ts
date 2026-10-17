import { partitionPendingPlatformUsers } from '../scripts/shard-platform.mjs';
import { expect,test } from 'vitest';
import { COMPONENTS,componentWave,SHARD_WAVES,type ComponentInventory } from '../scripts/shard-components.mjs';

test('G471 current and next waves retain their roster and unknown ownership refuses closure',()=>{
  const rows:Record<string,{components:ComponentInventory}>={};
  for(const wave of SHARD_WAVES)for(const {slug} of wave.shards){
    const counts={C1:0,C2:0,C3:0,C4:0,C5:0,C6:0,C7:0,C8:0,C9:0};
    rows[slug]={components:{shard:slug,counts,total:0,unknown:[],spans:[]}};
  }
  const current=componentWave(rows);expect(current.current).toBe(true);expect(current.shards).toEqual(['far-reach','sunscar-dunes']);
  const next=componentWave(rows,'W2');expect(next.current).toBe(false);expect(next.status).toBe('next');expect(next.shards).toEqual(['pine-hollow','driftwood-isle']);
  const pine=rows['pine-hollow'];if(pine===undefined)throw new Error('Missing fixture');
  pine.components.unknown.push('unclassified');
  expect(Object.keys(current.components)).toEqual(Object.keys(COMPONENTS));
  expect(componentWave(rows,'W2').components.C5.closed).toBe(false);
  expect(componentWave(rows).components.C5.closed).toBe(true);
  expect(componentWave(rows,'W2').unknown['pine-hollow']).toContain('unclassified');
});

test('reviewed pending users apply to current members while next-wave charges remain counted',()=>{
  const allowance={module:'src/engine/example.ts',shard:'nine-dragon-stack' as const,plan:{path:'docs/plans/example.md',row:'W3'},documentation:'docs/ENGINE.md','rechecked-by':'end of W3' as const};
  const charge={path:allowance.module,lines:1};
  for(const wave of SHARD_WAVES)for(const {slug} of wave.shards){
    const result=partitionPendingPlatformUsers(slug,[charge],[],[allowance]);
    expect(result.pending.some(row=>row.path===charge.path)).toBe(wave.current);
    expect(result.modules.some(row=>row.path===charge.path)).toBe(!wave.current);
  }
  expect(partitionPendingPlatformUsers('nine-dragon-stack',[charge],[],[allowance]).modules.some(row=>row.path===charge.path)).toBe(true);
});
