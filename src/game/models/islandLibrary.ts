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
  private admitted: ShardProduct | null = null;
  private library: FixedDraws | null = null;
  private inventory: Groups | null = null;
  readonly figures: ProductFigureCatalogue;
  readonly collections: CollectionCatalogue;

  constructor(input: unknown) {
    this.rows = v.parse(IslandLibrarySchema, input);
    this.figures = new ProductFigureCatalogue(this.rows.product, this.rows.figures);
    this.collections = new CollectionCatalogue(this.rows.product, new Map(Object.entries(this.rows.collections).map(([key, slot]) => [key, this.draw(slot)])));
  }

  /** The page's (or a cold view's) product, for the shard's readers that hold none. */
  admit(product: ShardProduct): void { this.admitted = product; }
  get product(): ShardProduct {
    if (this.admitted === null) throw new Error(`${this.rows.product} reads its product before its product is admitted`);
    return this.admitted;
  }
  /** Open and admit the first-party product outside a page (renderer services stay behind this explicit load). */
  async open(owner: Scope = resourceScope()): Promise<ShardProduct> {
    const { loadFirstPartyProduct } = await import('../shardfile/runtimeProduct');
    const product = await loadFirstPartyProduct(this.rows.product, owner);
    this.admit(product); return product;
  }

  private draws(): FixedDraws {
    const { section, field } = this.rows.draws;
    this.library ??= fixedDraws(this.product, this.product.section<Readonly<Record<string, unknown>>>(section)[field]);
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
  readonly load = async (bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>, owner?: Parameters<typeof readWholeGeometry>[0]): Promise<void> => {
    const product = bytes === undefined && owner === undefined ? await this.open() : this.product;
    await this.figures.admit(product);
    this.inventory ??= await product.json<Groups>(this.rows.groups);
    await this.draws().load(bytes, owner);
  };
}
