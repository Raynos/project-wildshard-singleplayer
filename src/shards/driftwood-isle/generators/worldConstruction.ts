import type { WorldConstructionRows } from '@wildshard/format/worldAssembly';
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };

/** Exact native boot checkpoints; the assembly itself owns the stage order. */
export function driftwoodWorldConstruction(piers: readonly {id:string}[]): WorldConstructionRows {
  const first=piers[0];if(first===undefined)throw new Error('Missing entry pier');
  return {
    cells:{phone:'world/cover/cells/phone.bin',desktop:'world/cover/cells/desktop.bin'}, seed:foliage.seed,
    progress:{total:18+piers.length,start:'Preparing world builders',finish:'Baked island',budgetMs:30},
    checkpoints:[
      {stage:'decks',at:'after',actions:[{kind:'entry-floor',floor:first.id}]},
      {stage:'bushes',at:'before',actions:[{kind:'slice'},{kind:'seed'}]},
      {stage:'seabed',at:'after',actions:[{kind:'progress',label:'Palm placement'}]},
      {stage:'cover',at:'after',actions:[{kind:'macrotask'}]},
      {stage:'smallRocks',at:'before',actions:[{kind:'require-baked',id:'cove'}]},
    ],
    gpu:{label:'driftwood.world',roots:[
      ...piers.map(({id})=>({kind:'object' as const,id})),
      {kind:'placed',id:'boat'}, {kind:'scene-part',as:'mesh',id:'moorings.mesh'}, {kind:'placed',id:'shore'},
      {kind:'object',id:'hut'}, {kind:'object',id:'lookout'}, {kind:'object',id:'wreck'}, {kind:'object',id:'shrine'},
      {kind:'object',id:'bushes'}, {kind:'object',id:'driftwood.gulls'}, {kind:'object',id:'trail'}, {kind:'object',id:'bridge'},
      {kind:'object',id:'seabed'}, {kind:'object',id:'cove'}, {kind:'object',id:'palms'}, {kind:'object',id:'driftwood.cover'},
      {kind:'baked',id:'cove'}, {kind:'object',id:'smallRocks'},
    ]},
  };
}
