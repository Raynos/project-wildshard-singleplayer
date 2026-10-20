/** Client-only packed-product intake for the row-owned game figure catalogue. */
import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import type { MeshStandardMaterial } from 'three';
import type { ModelDef } from '@wildshard/engine/models/model';
import type { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { FigureCatalogue as FigureModels } from '@wildshard/game/models/figureCatalogue';
import { FigureCatalogueSchema, type FigureRow } from '@wildshard/format/figures';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { GeometryPack, fetchDeflated } from '../kit/geometryPack';
import { resourceScope } from '@wildshard/engine/app/resources';

const admitted = new WeakMap<ShardProduct, Map<string, FigureCatalogue>>();

/** The SDK decodes the existing pack; game owns models, rows and presentation.
 * Public callers supply product/file ids and resident scene handles only.
 */
export class FigureCatalogue {
  /** Share the already admitted native catalogue with page composition. */
  static async fromProduct(product: ShardProduct, file: string): Promise<FigureCatalogue> {
    const ready = admitted.get(product)?.get(file); if (ready !== undefined) return ready;
    const catalogue = new FigureCatalogue(product.slug, file); await catalogue.admit(product); return catalogue;
  }
  private readonly figures = new FigureModels();
  private pending: Promise<void> | undefined;
  constructor(private readonly productId: string, private readonly file: string) {}
  async admit(product: ShardProduct): Promise<void> {
    const data = v.parse(FigureCatalogueSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file(this.file))));
    const resources = new SceneHandles();
    if (data.pack !== undefined) {
      const pack = new GeometryPack(await fetchDeflated(data.pack.url), data.pack.rows, this.file);
      const indices = new Set(Object.values(data.figures).flatMap(row => [row.body, row.glass]).filter(index => index !== undefined && index !== null));
      for (const index of indices) {
        const geometry = pack.geometry(index); resources.publish(String(index), geometry);
        resourceScope().onDispose(() => { geometry.dispose(); });
      }
    }
    await this.figures.admit(data, resources);
    const book = admitted.get(product) ?? new Map<string, FigureCatalogue>();
    book.set(this.file, this); admitted.set(product, book);
    resourceScope().onDispose(() => { if (book.get(this.file) === this) book.delete(this.file); });
  }
  prepare(): Promise<void> {
    this.pending ??= (async () => {
      try { await this.admit(await loadFirstPartyProduct(this.productId)); }
      catch (error: unknown) { this.pending = undefined; throw error; }
    })();
    return this.pending;
  }
  material(resources: SceneHandles): MeshStandardMaterial { return this.figures.material(resources); }
  create(id: string, resources: SceneHandles, feet: readonly [number, number, number], yaw: number, owner?: Scope): FigureRows { return this.figures.create(id, resources, feet, yaw, owner); }
  model(id: string): ModelDef<object> { return this.figures.model(id); }
  rows(id: string): FigureRow { return this.figures.rows(id); }
  kit(id: string): unknown { return this.figures.kit(id); }
}
