import type { Scope } from '@wildshard/engine/app/scope';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { WaterSurface,waterSurfaceLook } from '../systems/looks/waterSurface';
import type { ShardContext } from '../plugin/context';
import type { ShardProduct } from './shardProduct';
import { hasLentLook,lendLooks,lentLooksOf } from './lentLooks';
import { runtimeLookMaterials } from './runtimeProduct';

const owners=new WeakMap<Scope,WeakMap<ShardProduct,ReadonlyMap<string,WaterSurface>>>();
/** Z1 binds the existing water-surface host to declared product geometry and graph looks. */
export async function installClientWaterSurfaces(ctx:ShardContext,row:ClientFeatureRow):Promise<void>{
  if(row.kind!=='world.water')throw new Error('Invalid water feature');
  let products=owners.get(ctx.scope);if(products===undefined){products=new WeakMap();owners.set(ctx.scope,products);}
  if(products.has(ctx.product))throw new Error('Water surfaces are already installed');
  const missing=[...new Set(row.rows.map(water=>water.surface.look))].filter(id=>!hasLentLook(id));
  if(missing.length>0)lendLooks(ctx.scope,await runtimeLookMaterials({scope:ctx.scope,game:ctx.game},ctx.product.shardfile,true,missing));
  const surfaces=new Map<string,WaterSurface>();
  for(const water of row.rows){
    const intake=createOwnedGeometry(water.geometry);await intake.load(await ctx.product.file(water.geometry));
    const shape=intake.take();ctx.scope.own(shape);
    const surface=new WaterSurface(water.surface,waterSurfaceLook(lentLooksOf(water.surface.look),water.surface.look)).draw(shape);
    surfaces.set(water.id,surface);ctx.root.add(surface.group);ctx.scope.onDispose(()=>{surface.group.removeFromParent();});
  }
  products.set(ctx.product,surfaces);const installed=products;
  ctx.scope.onDispose(()=>{installed.delete(ctx.product);});
  ctx.system({id:'client.water.surfaces',phase:'update',after:['main.world'],before:['engine.creatures.update'],run:dt=>{for(const surface of surfaces.values())surface.update(dt);}});
}
/** Typed native bindings borrow the admitted water bodies. */
export function clientWaterSurfaces(ctx:ShardContext):ReadonlyMap<string,WaterSurface>{
  const surfaces=owners.get(ctx.scope)?.get(ctx.product);if(surfaces===undefined||ctx.scope.disposed)throw new Error('Water surfaces are not installed');return surfaces;
}
