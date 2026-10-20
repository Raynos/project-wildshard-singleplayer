import type { Scope } from '@wildshard/engine/app/scope';
import { CosmeticFinishLocker, CosmeticFinishPainter } from '../loadout/cosmeticFinishes';
import { enteredAdventurePersistence } from '../quest/chapterBindings';
import type { ShardContext } from '../plugin/context';
import type { ShardProduct } from './shardProduct';

interface ClientCosmeticFinishes { readonly locker: CosmeticFinishLocker; readonly painter: CosmeticFinishPainter }
const owners=new WeakMap<Scope,WeakMap<ShardProduct,ClientCosmeticFinishes>>();
/** The kit phase binds declared finish rows to the existing entered saved owner. */
export function installClientCosmeticFinishes(ctx:ShardContext):void{
  if(ctx.scope.disposed)throw new Error('Cosmetic finishes require a living owner');
  let products=owners.get(ctx.scope);if(products===undefined){products=new WeakMap();owners.set(ctx.scope,products);}
  if(products.has(ctx.product))throw new Error('Cosmetic finishes are already installed');
  const persistence=enteredAdventurePersistence(ctx.scope),rows=ctx.product.section('held/finishes').cosmetics;
  if(rows===undefined)throw new Error('Cosmetic feature requires declared finishes');
  const locker=new CosmeticFinishLocker(ctx.product.slug,rows,persistence.cosmetics),painter=new CosmeticFinishPainter(locker),book={locker,painter};
  if(rows.menu!==undefined){const runtime=ctx.game.runtime;if(runtime===undefined)throw new Error('Finish menu requires its native page');runtime.menu={...runtime.menu,skins:()=>locker.cardRows(locker.finishes.cards),onWearSkin:id=>{locker.toggle(id);},skinsTitle:rows.menu.title};}
  products.set(ctx.product,book);const installed=products;
  ctx.scope.onDispose(()=>{painter.dispose();installed.delete(ctx.product);});
}
/** Native objects bind to the installed feature; they never construct another locker or painter. */
export function clientCosmeticFinishes(ctx:ShardContext):ClientCosmeticFinishes{
  const value=owners.get(ctx.scope)?.get(ctx.product);if(value===undefined||ctx.scope.disposed)throw new Error('Cosmetic finishes are not installed');return value;
}
