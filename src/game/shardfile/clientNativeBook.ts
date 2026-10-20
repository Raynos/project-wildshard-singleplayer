import type { CueDirector } from '../audio/cueDirector';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';
import type { createDeclaredHeldMelee } from '../plugin/weaponFamily';
import type { SpeciesBrains, SpeciesPageCatalogue, SpeciesDecisionAuthority } from '../plugin/brain';
import type { RuntimeHomes, RuntimeCoins } from '../plugin/headless';
import type { PersistedQuest, bindDeclaredFight, PageQuestStages } from '../plugin/ui';
import type { DeclaredPage } from '../quest/declaredPage';
import type { ShardProduct } from './shardProduct';

/** Internal references shared by compiled feature installers. Every entry is
 * the actual native owner; this book has no actor, flag, clock or save copy. */
export interface ClientNativeBook {
  held: ReturnType<typeof createDeclaredHeldMelee> | null;
  brains: SpeciesBrains | null;
  catalogue: SpeciesPageCatalogue | null;
  population: RuntimeHomes | null;
  quest: (PersistedQuest & { readonly coins: RuntimeCoins }) | null;
  fight: ReturnType<typeof bindDeclaredFight> | null;
  page: DeclaredPage | null;
  stages: PageQuestStages | null;
  decisions: SpeciesDecisionAuthority | null;
  capture: ((name: string) => void) | null;
  readonly presentations: Map<string, CueDirector>;
  readonly decisionAssets: Map<string, Uint8Array>;
}
const owners = new WeakMap<Scope, WeakMap<ShardProduct, ClientNativeBook>>();
/** Feature admission precedes this book. Its lifetime is the entered scope,
 * independently of the world's resident scene/material scope. */
export function clientNativeBook(ctx: ShardContext): ClientNativeBook {
  if (ctx.scope.disposed) throw new Error('Native client features require a living entered scope');
  let products = owners.get(ctx.scope);
  if (products === undefined) { products = new WeakMap(); owners.set(ctx.scope, products); }
  const previous = products.get(ctx.product); if (previous !== undefined) return previous;
  const book: ClientNativeBook = { held: null, brains: null, catalogue: null, population: null, quest: null,
    fight: null, page: null, stages: null, decisions: null, capture: null, presentations: new Map(), decisionAssets: new Map() };
  products.set(ctx.product, book);
  ctx.scope.onDispose(() => { book.decisionAssets.clear(); book.presentations.clear(); products.delete(ctx.product); });
  return book;
}
