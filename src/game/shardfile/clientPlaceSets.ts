import type { Scope } from '@wildshard/engine/app/scope';
import type { Placed } from '@wildshard/engine/models/place';
import { placeSet,placedWithin } from '@wildshard/engine/models/sets';
import type { RegisteredSet } from '@wildshard/engine/world/registry';
import { buildYield } from '@wildshard/engine/core/workSlice';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardContext } from '../plugin/context';
import type { ShardProduct } from './shardProduct';

interface PlaceSets { readonly rows:Extract<ClientFeatureRow,{kind:'world.sets'}>['rows']; readonly owned:RegisteredSet[]; bound:boolean }
const owners=new WeakMap<Scope,WeakMap<ShardProduct,PlaceSets>>();
/** Z1 admits named-place membership before native model bindings arrive. */
export function installClientPlaceSets(ctx:ShardContext,row:ClientFeatureRow):void{
  if(row.kind!=='world.sets'||ctx.scope.disposed)throw new Error('Invalid named-place feature');
  let products=owners.get(ctx.scope);if(products===undefined){products=new WeakMap();owners.set(ctx.scope,products);}
  if(products.has(ctx.product))throw new Error('Named places are already installed');
  const book:PlaceSets={rows:row.rows,owned:[],bound:false};products.set(ctx.product,book);const installed=products;
  ctx.scope.onDispose(()=>{installed.delete(ctx.product);for(const set of book.owned){const index=ctx.app.registry.sets.indexOf(set);if(index!==-1)ctx.app.registry.sets.splice(index,1);}});
}
/** Bind actual model placements; admitted rows select whole groups and spatial copy views without adding collision. */
export async function bindClientPlaceSets(ctx:ShardContext,groups:ReadonlyMap<string,readonly Placed[]>,nearby:readonly Placed[]):Promise<void>{
  const book=owners.get(ctx.scope)?.get(ctx.product);if(book===undefined||book.bound||ctx.scope.disposed)throw new Error('Named-place binding requires an unbound entered feature');book.bound=true;
  const claimed=new Set(book.rows.flatMap(row=>row.pois)),grouped=new Set([...groups.values()].flat()),loose=[...groups].filter(([name])=>!claimed.has(name)).flatMap(([,placed])=>placed),spatial=[...loose,...nearby.filter(placed=>!grouped.has(placed))];
  for(const row of book.rows){
    const members=[...row.pois.flatMap(name=>groups.get(name)??[]),...spatial.flatMap(placed=>{const view=placedWithin(placed,row.x,row.z,row.r,'centre');return view===null?[]:[view];})];
    if(members.length>0)book.owned.push(placeSet({...row,members,registry:ctx.app.registry}));
    await buildYield(ctx.scope);
  }
}
