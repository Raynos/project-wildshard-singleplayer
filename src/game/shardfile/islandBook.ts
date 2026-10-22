/** A finite product book, shared by entered construction and Explorer readers.
 * Admission performs no reads or allocations. Native ownership is supplied by
 * the caller that later loads the book, never a parked page scope. */
import * as v from 'valibot';
import { parseClientPlan, type ClientFeatureRow } from '@wildshard/format/clientPlan';
import { WorldAssemblySchema } from '@wildshard/format/worldAssembly';
import { resourceScope } from '@wildshard/engine/app/resources';
import { IslandLibrary } from '../models/islandLibrary';
import { ResolvedIslandLibrarySchema } from '@wildshard/format/islandLibrary';
import { defineWorldSceneCatalogue } from '../models/worldSceneCatalogue';
import type { ShardProduct } from './shardProduct';

type AssemblyRow = Extract<ClientFeatureRow, { kind: 'world.assembly' }>;
const books = new WeakMap<ShardProduct, Map<string, {
  readonly root: unknown; readonly row: string;
  readonly pending: Promise<{ readonly library: IslandLibrary<unknown>; readonly sites: ReturnType<typeof defineWorldSceneCatalogue> }>;
}>>();

/** Whole-plan preflight; only already-admitted section values and file names. */
export function preflightIslandBook(product: ShardProduct, row: AssemblyRow): void {
  const book = v.parse(ResolvedIslandLibrarySchema, product.section('custom/fixedLayouts'));
  const assembly = v.parse(WorldAssemblySchema, row.rows), construction = assembly.construction;
  if (book.id !== row.library || product.section('world/scenes').catalogue !== row.catalogue) throw new Error('Island book identity or catalogue differs');
  if (construction?.looks === undefined || construction.publish === undefined) throw new Error('Island entry requires construction looks and publications');
  if (new Set(book.draws.map(draw => draw.slot)).size !== book.draws.length) throw new Error('Repeated island fixed draw slot');
  const slots = new Set(book.draws.map(draw => draw.slot));
  if (Object.values(book.collections).some(slot => !slots.has(slot))) throw new Error('Island collection names an undeclared draw');
  for (const name of [book.groups, book.figures, row.catalogue, ...book.draws.map(draw => draw.file)]) {
    if (!product.hasFile(name)) throw new Error(`Island book names no product file: ${name}`);
  }
  for (const look of [...construction.looks.unbound, ...construction.looks.bound]) {
    if (product.shardfile.look.materials[look] === undefined) throw new Error(`Island book names no look: ${look}`);
  }
}

/** Resolve the same declared product/id record for either entry order. This
 * uses only the pure plan parser, never recursive whole-plan admission. */
export async function admittedIslandBook(product: ShardProduct, id: string): Promise<{
  readonly library: IslandLibrary<unknown>; readonly sites: ReturnType<typeof defineWorldSceneCatalogue>;
}> {
  const owner = resourceScope();
  const live = (): void => { if (owner.disposed || owner.disposing) throw new Error('Island book caller left'); };
  live();
  const matching = parseClientPlan(product.section('client/plan')).features.filter((row): row is AssemblyRow => row.kind === 'world.assembly' && row.library === id);
  const [row] = matching;
  if (row === undefined || matching.length !== 1) throw new Error('Island book requires one matching assembly');
  preflightIslandBook(product, row);
  const root = product.section('custom/fixedLayouts'), recipe = JSON.stringify(row);
  let byId = books.get(product);
  if (byId === undefined) { byId = new Map(); books.set(product, byId); }
  let record = byId.get(id);
  if (record !== undefined && (record.root !== root || record.row !== recipe)) throw new Error('Island book declaration changed');
  if (record === undefined) {
    const library = new IslandLibrary<unknown>(root, product);
    const pending = product.json<unknown>(row.catalogue).then(input => ({ library, sites: defineWorldSceneCatalogue(input, product) }));
    record = { root, row: recipe, pending }; byId.set(id, record);
    const current = record, inventory = byId;
    void pending.catch(() => { if (inventory.get(id) === current) inventory.delete(id); });
  }
  const value = await record.pending; live();
  if (product.section('custom/fixedLayouts') !== root) throw new Error('Island book declaration changed during read');
  return value;
}
