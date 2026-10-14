import { expect,test } from 'vitest';
import { COMPONENTS,componentWave,SHARD_WAVES,type ComponentInventory } from '../scripts/shard-components.mjs';

test('current and completed waves share their roster and unknown ownership refuses closure',()=>{
  const rows:Record<string,{components:ComponentInventory}>={};
  for(const wave of SHARD_WAVES)for(const {slug} of wave.shards){
    const counts={C1:0,C2:0,C3:0,C4:0,C5:0,C6:0,C7:0,C8:0,C9:0};
    rows[slug]={components:{shard:slug,counts,total:0,unknown:[],spans:[]}};
  }
  const current=componentWave(rows);expect(current.current).toBe(true);expect(current.shards).toContain('pine-hollow');
  const completed=componentWave(rows,'W1');expect(completed.status).toContain('closed');expect(completed.shards).toContain('sunscar-dunes');
  const pine=rows['pine-hollow'];if(pine===undefined)throw new Error('Missing fixture');
  pine.components.unknown.push('unclassified');
  expect(Object.keys(current.components)).toEqual(Object.keys(COMPONENTS));
  expect(componentWave(rows).components.C5.closed).toBe(false);
  expect(componentWave(rows,'W1').components.C5.closed).toBe(true);
  expect(componentWave(rows).unknown['pine-hollow']).toContain('unclassified');
});
