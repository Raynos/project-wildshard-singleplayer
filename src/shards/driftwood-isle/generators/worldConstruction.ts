import { NATIVE_VIEW } from './nativeView';
import type { WorldConstructionRows } from '@wildshard/format/worldAssembly';
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };

// The old custom-section wire canonically sorted record keys before entry.
const wireValues = (rows: Readonly<Record<string, string>>): string[] => Object.keys(rows).sort().map(key => { const value=rows[key];if(value===undefined)throw new Error('Missing authored look');return value; });

/** Exact native boot checkpoints; the assembly itself owns the stage order. */
export function driftwoodWorldConstruction(piers: readonly {id:string}[]): WorldConstructionRows {
  const first=piers[0];if(first===undefined)throw new Error('Missing entry pier');
  return { looks: { unbound: ['driftwood-kit-moor'], bound: [
    ...wireValues(NATIVE_VIEW.CASCADE_LOOKS), NATIVE_VIEW.SMOKE_LOOK,
    NATIVE_VIEW.FIREFLY_LOOK, NATIVE_VIEW.REEF_LOOK, NATIVE_VIEW.POOL_LOOK, NATIVE_VIEW.SHRINE_POOL_LOOK, NATIVE_VIEW.OCEAN_LOOK,
    NATIVE_VIEW.GULL_GRAPH_LOOK, ...NATIVE_VIEW.COVER_LOOKS, ...wireValues(NATIVE_VIEW.CREATURE_LOOKS), 'driftwood-kit-moor',
  ] }, publish: {draws:'driftwood.fixed-draws',collection:'driftwood.collections'},
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
