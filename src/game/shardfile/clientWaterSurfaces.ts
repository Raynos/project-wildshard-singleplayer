import type { Scope } from '@wildshard/engine/app/scope';
import { buildTier } from '@wildshard/engine/core/tier';
import { gpuOnlyTrees } from '@wildshard/engine/core/gpuOnly';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { BakedSource } from '@wildshard/format/bakedTiles';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { WaterSurface,waterSurfaceLook } from '../systems/looks/waterSurface';
import type { ShardContext } from '../plugin/context';
import type { ShardProduct } from './shardProduct';
import { hasLentLook,lendLooks,lentLooksOf } from './lentLooks';
import { runtimeLookMaterials } from './runtimeProduct';
import { toonLookState } from '../looks/toonLook';

type WaterRow = Extract<ClientFeatureRow,{kind:'world.water'}>['rows'][number];
/** A declared draw's file: a product file, or an immutable public asset fetched once into the page cache. */
async function bytesOf(product:ShardProduct,source:BakedSource):Promise<Uint8Array>{
  if('file' in source)return product.file(source.file);
  const response=await fetch(source.url,{cache:'force-cache'});
  if(!response.ok)throw new Error(`Water file load failed (${String(response.status)})`);
  return new Uint8Array(await response.arrayBuffer());
}
/** A row's surface: its product geometry as drawn, or (O7) its own draw: the tier's grid, level, baked floor, dry
 *  rectangles and toon-lent params, foam stamped round its boxes, CPU copies dropped once uploaded. */
async function drawRow(ctx:ShardContext,water:WaterRow):Promise<WaterSurface>{
  const surface=new WaterSurface(water.surface,waterSurfaceLook(lentLooksOf(water.surface.look),water.surface.look));
  if('geometry' in water){
    const intake=createOwnedGeometry(water.geometry);await intake.load(await ctx.product.file(water.geometry));
    const shape=intake.take();ctx.scope.own(shape);return surface.draw(shape);
  }
  const draw=water.draw,grid=draw.grid[buildTier()],intake=createOwnedGeometry('url' in grid?grid.url:grid.file,draw.attributes);
  const [bytes,floorBytes]=await Promise.all([bytesOf(ctx.product,grid),draw.floor===undefined?Promise.resolve(null):bytesOf(ctx.product,draw.floor)]);
  await intake.load(bytes);const shape=intake.take();ctx.scope.own(shape);
  // half-float heights, copied out of the file's buffer so they are aligned
  const floor=floorBytes===null?undefined:new Uint16Array(floorBytes.slice().buffer);
  const toon=Object.keys(draw.lent).length>0||draw.toonSeaLevel?toonLookState(ctx.product).dayLight:null;
  if(toon!==null&&draw.toonSeaLevel)toon.uSeaLevel.value=draw.level;
  const lent=toon===null?{}:Object.fromEntries(Object.entries(draw.lent).map(([param,uniform])=>[param,toon[uniform]]));
  surface.draw(shape,{level:draw.level,...(floor===undefined?{}:{floor}),dry:draw.dry,lent});
  if(draw.foam.length>0)surface.foamAround(draw.foam);
  gpuOnlyTrees([surface.group],`client.water.${water.id}`,['position']);
  return surface;
}
const owners=new WeakMap<Scope,WeakMap<ShardProduct,ReadonlyMap<string,WaterSurface>>>();
/** Z1 binds the existing water-surface host to declared product geometry and graph looks. */
export async function installClientWaterSurfaces(ctx:ShardContext,row:ClientFeatureRow):Promise<void>{
  if(row.kind!=='world.water')throw new Error('Invalid water feature');
  let products=owners.get(ctx.scope);if(products===undefined){products=new WeakMap();owners.set(ctx.scope,products);}
  if(products.has(ctx.product))throw new Error('Water surfaces are already installed');
  const missing=[...new Set(row.rows.map(water=>water.surface.look))].filter(id=>!hasLentLook(id));
  if(missing.length>0)lendLooks(ctx.scope,await runtimeLookMaterials({scope:ctx.scope,game:ctx.game},ctx.product.shardfile,true,missing));
  // O7: a drawn row writes its graph's params, so its looks compile as graphs in this feature's own lend: an earlier lend
  // may hold them as family fallbacks (compiled with the graph row off), which take no params
  const drawn=[...new Set(row.rows.flatMap(water=>'draw' in water?[water.surface.look]:[]))];
  if(drawn.length>0)lendLooks(ctx.scope,await runtimeLookMaterials({scope:ctx.scope,game:ctx.game},ctx.product.shardfile,true,drawn));
  const surfaces=new Map<string,WaterSurface>();
  for(const water of row.rows){
    const surface=await drawRow(ctx,water);
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
