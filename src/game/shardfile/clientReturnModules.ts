import * as v from 'valibot';
import { ReturnModulesSchema } from '@wildshard/format/scriptContract';
import { ReturnProgram } from '../population/returnProgram';
import type { ShardContext } from '../plugin/context';
import { clientNativeBook } from './clientNativeBook';

/** Populate the original entered book before any feature constructs a return
 * projection. Scene construction and the actual level can have sibling scopes. */
export async function prepareClientReturnModules(ctx:ShardContext):Promise<void> {
  if(!ctx.product.has('actors/return-scripts'))return;
  const rows=v.parse(ReturnModulesSchema,ctx.product.section('actors/return-scripts'));
  if(!rows.some(row=>row.abi===2))return;
  const book=clientNativeBook(ctx);
  book.returnModules??=(async()=>{
    await ReturnProgram.prepareModules(ctx.product,book.decisionAssets,rows);
    if(ctx.scope.disposed||ctx.scope.disposing)throw new Error('Return owner disposed');
    ReturnProgram.lendModules(ctx.scope,book.decisionAssets,rows);
  })();
  await book.returnModules;
  // Re-read the real level after world creation; it need not descend from ctx.
  const level=ctx.game.runtime?.world?.game.levelScope;
  if(level!==undefined&&level!==ctx.scope)ReturnProgram.lendModules(level,book.decisionAssets,rows);
}
