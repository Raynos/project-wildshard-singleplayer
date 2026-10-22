import { ResolvedIslandLibrarySchema } from '@wildshard/format/islandLibrary';
/**
 * G586: a shard's Blender-built island library, declared as data (`IslandLibrarySchema`): its fixed draws (the rows in a
 * custom section field, `FixedDrawRowsSchema`), their named groups file, the figure catalogue that shares their intake
 * and the collection cards drawn from its slots. One library per declaration, made on its first use: the page's resident
 * loader admits the product and loads every slot from the world's whole-geometry assembly; a cold Explorer card opens the
 * product itself and loads the same slots by file. Handles are inert until that one load settles. Client-only.
 */
import * as v from 'valibot';
import type { BufferGeometry } from 'three';
import type { OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { CustomSectionName } from '@wildshard/format/sections';
import type { ShardProduct } from '../shardfile/shardProduct';
import type { readWholeGeometry } from '../plugin/geometry';
import { fixedDraws, type FixedDraws } from './fixedDraws';
import { ProductFigureCatalogue } from './figureCatalogue';
import { CollectionCatalogue } from './collectionDisplay';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
export const IslandLibrarySchema = v.strictObject({
  product: id,
  /** the custom section and its field holding the fixed draw rows */
  draws: v.strictObject({ section: v.custom<CustomSectionName>(name => typeof name === 'string' && /^custom\/[A-Za-z][A-Za-z0-9_.-]{0,120}$/u.test(name), 'a custom section'), field: id }),
  /** the named JSON of the draws' groups, and the figure catalogue admitted with them */
  groups: id, figures: id,
  /** each collection card's key and fixed draw slot */
  collections: v.pipe(v.record(id, id), v.maxEntries(16)),
});

/** One shard's island library (see the module note); `Groups` is its groups file's generated type. */
export class IslandLibrary<Groups> {
  private readonly rows: v.InferOutput<typeof IslandLibrarySchema>;
  private readonly resolved: v.InferOutput<typeof ResolvedIslandLibrarySchema> | undefined;
  private admitted: ShardProduct | null = null;
  private intake: Promise<void> | undefined;
  private inventoryRead: Promise<Groups> | undefined;
  private figureAdmission: { readonly owner: Scope; readonly construction: boolean; readonly pending: Promise<void> } | undefined;
  private library: FixedDraws | null = null;
  private inventory: Groups | null = null;
  readonly figures: ProductFigureCatalogue;
  readonly collections: CollectionCatalogue;

  constructor(input: unknown, product?: ShardProduct) {
    this.resolved = product === undefined ? undefined : v.parse(ResolvedIslandLibrarySchema, input);
    this.rows = this.resolved === undefined ? v.parse(IslandLibrarySchema, input) : {
      product: product?.slug ?? '', draws: { section: 'custom/fixedLayouts', field: 'draws' },
      groups: this.resolved.groups, figures: this.resolved.figures, collections: this.resolved.collections,
    };
    this.admitted = product ?? null;
    this.figures = new ProductFigureCatalogue(this.rows.product, this.rows.figures);
    this.collections = new CollectionCatalogue(this.rows.product, new Map(Object.entries(this.rows.collections).map(([key, slot]) => [key, this.draw(slot)])), product);
  }

  /** The page's (or a cold view's) product, for the shard's readers that hold none. */
  admit(product: ShardProduct): void {
    if (this.resolved !== undefined && product !== this.admitted) throw new Error('Resolved island product identity differs');
    this.admitted = product;
  }
  get product(): ShardProduct {
    if (this.admitted === null) throw new Error(`${this.rows.product} reads its product before its product is admitted`);
    return this.admitted;
  }
  /** Open and admit the first-party product outside a page (renderer services stay behind this explicit load). */
  async open(owner: Scope = resourceScope()): Promise<ShardProduct> {
    if (owner.disposed || owner.disposing) throw new Error('Island library owner left');
    if (this.resolved !== undefined) return this.product;
    const { loadFirstPartyProduct } = await import('../shardfile/runtimeProduct');
    const product = await loadFirstPartyProduct(this.rows.product, owner);
    this.admit(product); return product;
  }

  private draws(): FixedDraws {
    const { section, field } = this.rows.draws;
    this.library ??= fixedDraws(this.product, this.resolved?.draws ?? this.product.section<Readonly<Record<string, unknown>>>(section)[field]);
    return this.library;
  }
  /** A slot's inert owned handle: loading it before the library loads loads the whole library. */
  readonly draw = (slot: string): OwnedGeometry => ({ load: bytes => bytes === undefined && !this.ready ? this.load() : this.draws().handle(slot).load(bytes),
      adopt: geometry => { this.draws().handle(slot).adopt(geometry); }, copy: () => this.draws().handle(slot).copy(), take: () => this.draws().handle(slot).take() });
  /** The groups file, read with the one load. */
  readonly groups = (): Groups => {
    if (this.inventory === null) throw new Error(`Baked model was not loaded: ${this.rows.product} fixed geometry inventory`);
    return this.inventory;
  };
  /** Every slot's template has completed its intake. */
  get ready(): boolean { return this.library?.ready ?? false; }
  /** The loaded library itself (an entry-owner or figure loan); refuses before its one intake completed. */
  readonly loaded = (): FixedDraws => {
    if (this.library === null || !this.library.ready) throw new Error(`${this.rows.product} fixed draws are not loaded`);
    return this.library;
  };
  /** Load every slot: from `owner`'s whole-geometry assembly (the world build), a caller's named blobs (`bytes`), or,
   *  with neither, the opened product's files (a cold Explorer card). */
  readonly load = async (bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readWholeGeometry>[0], sourceOwner: Scope = resourceScope()): Promise<void> => {
    const live = (): void => { if (sourceOwner.disposed || sourceOwner.disposing) throw new Error('Island library owner left'); };
    live();
    const product = this.resolved !== undefined ? this.product : bytes === undefined && owner === undefined ? await this.open(sourceOwner) : this.product;
    live();
    if (this.resolved === undefined) {
      await this.figures.admit(product, sourceOwner); live();
      this.inventory ??= await product.json<Groups>(this.rows.groups); live();
      await this.draws().load(bytes, owner); live(); return;
    }
    const previous = this.figureAdmission;
    // A card borrows the live construction admission. A construction always
    // re-admits on its own concrete owner, even after a cold geometry intake.
    if (owner === undefined && bytes === undefined && previous?.construction === true && !previous.owner.disposed && !previous.owner.disposing) {
      await previous.pending;
    } else {
      const pending = (async () => {
        if (previous !== undefined) { try { await previous.pending; } catch { /* A retired card cannot poison construction. */ } }
        live(); await this.figures.admit(product, sourceOwner, false); live();
      })();
      const admission = { owner: sourceOwner, construction: owner !== undefined || bytes !== undefined, pending };
      this.figureAdmission = admission;
      sourceOwner.onDispose(() => { if (this.figureAdmission === admission) this.figureAdmission = undefined; });
      try { await pending; } catch (error) { if (this.figureAdmission === admission) this.figureAdmission = undefined; throw error; }
    }
    live();
    this.inventoryRead ??= (async () => { try { return await product.json<Groups>(this.rows.groups); } catch (error: unknown) { this.inventoryRead = undefined; throw error; } })();
    const inventory = await this.inventoryRead; live(); this.inventory = inventory;
    // Deduplicate templates only. Figure admission above never shares a retired
    // source owner and never parks packed resources on the page scope.
    this.intake ??= (async () => { try { await this.draws().load(bytes, owner); } catch (error: unknown) { this.intake = undefined; throw error; } })();
    await this.intake; live();
  };
}
