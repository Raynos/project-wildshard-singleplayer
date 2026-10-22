import { GeometryPack } from '@wildshard/engine/models/geometryPack';
import { fetchDeflatedBytes as fetchDeflated } from '@wildshard/engine/core/deflate';
import { resourceScope } from '@wildshard/engine/app/resources';
import { loadFirstPartyProduct } from '../shardfile/runtimeProduct';
import type { ShardProduct } from '../shardfile/shardProduct';
/** Client-only product catalogue for fallback and baked figure rows. */
import * as THREE from 'three';
import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import { TIER } from '@wildshard/engine/core/tier';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { defineModel, announceModelReady, type ModelDef } from '@wildshard/engine/models/model';
import { FigureCatalogueSchema, type FigureCatalogueRow, type FigureRow } from '@wildshard/format/figures';
import { FigureRows } from '../systems/npc/figureRows';
import { SceneHandles } from '../shardfile/sceneHandles';

const nobody = new THREE.Vector3(0, 0, 1e4);

/** Rows never execute shard code; named product data defines every card.
 * Each build gets a fresh publication namespace and owns async cancellation.
 */
export class FigureCatalogue {
  private data: FigureCatalogueRow | undefined;
  private geometry: SceneHandles | undefined;
  private sharedMat: THREE.MeshStandardMaterial | undefined;
  private sharedGlow: THREE.MeshBasicMaterial | undefined;
  /** Admit atomically; a failed load leaves the last complete catalogue intact. */
  async admit(input: unknown, geometry: SceneHandles): Promise<void> {
    const data = v.parse(FigureCatalogueSchema, input);
    for (const row of Object.values(data.figures)) {
      if (row.body !== undefined) geometry.geometry(String(row.body));
      if (row.glass !== undefined && row.glass !== null) geometry.geometry(String(row.glass));
    }
    await FigureRows.prepareSkins(Object.values(data.figures).flatMap(row => row[TIER].skin ?? []));
    this.data = data; this.geometry = geometry;
  }
  /** Shared vertex-colour material for figures and row-compatible props. */
  material(resources: SceneHandles): THREE.MeshStandardMaterial {
    const sky = resources.sky;
    const row = this.data?.material;
    if (row === undefined) throw new Error('Figure catalogue is not admitted');
    if (this.sharedMat === undefined) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: row.roughness, metalness: row.metalness });
      mat.name = row.name; sky.setupMaterial(mat);
      this.sharedMat = cacheUntilDisposed(mat, () => { this.sharedMat = undefined; });
    }
    return this.sharedMat;
  }
  private row(id: string) {
    const row = this.data?.figures[id];
    if (row === undefined) throw new Error(`Figure catalogue is not admitted: ${id}`);
    return { row, geometry: this.geometry };
  }
  create(id: string, context: SceneHandles, feet: readonly [number, number, number], yaw: number, owner?: Scope): FigureRows {
    const { row, geometry } = this.row(id), spec = row[TIER], resources = new SceneHandles(context.sky), f = spec.fallback;
    if (f === undefined) return new FigureRows(context, spec, owner);
    if (geometry === undefined || row.body === undefined) throw new Error('Figure fallback requires its packed geometry');
    resources.publish(f.geometry, geometry.geometry(String(row.body)).clone()); resources.publish(f.material, this.material(resources));
    this.sharedGlow ??= cacheUntilDisposed(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: true }), () => { this.sharedGlow = undefined; });
    resources.publish(f.glow, this.sharedGlow);
    if (f.glass !== null) {
      if (row.glass === null || row.glass === undefined) throw new Error('Figure glass requires its packed geometry');
      resources.publish(f.glass, geometry.geometry(String(row.glass)).clone());
    }
    const fig = new FigureRows(resources, { ...spec, feet: [...feet], yaw }, owner);
    return fig;
  }
  model(id: string): ModelDef<object> {
    const { row } = this.row(id);
    const card = row.card, skin = row[TIER].skin;
    if (card === undefined) throw new Error('Figure requires its declared Explorer card');
    return defineModel<object>({ ...card, category: 'people', surface: 'flesh',
      defaults: {}, prepare: async () => { await FigureRows.prepareSkins(skin === undefined ? [] : [skin]); },
      build: ctx => {
        const fig = this.create(id, new SceneHandles(ctx.sky), [0, 0, 0], 0);
        fig.update(0, 0, nobody);
        void fig.ready.then(() => { if (fig.active) { fig.update(0, 0, nobody); announceModelReady(card.id); } return undefined; });
        return fig.group;
      },
    });
  }
  /** Author rows, available only after the same admission as live figures. */
  rows(id: string): FigureRow { return this.row(id).row[TIER]; }
  /** The figure's kit rows (format/kitFigure), when it is built from kit meshes. */
  kit(id: string): unknown { const kit = this.row(id).row.kit; if (kit === undefined) throw new Error(`Figure ${id} has no kit`); return kit; }
}

const admitted = new WeakMap<ShardProduct, Map<string, ProductFigureCatalogue>>();

/** Admit existing product packs into the shared figure model owner.
 * Public callers supply product/file ids and resident scene handles only.
 */
export class ProductFigureCatalogue {
  /** Share the admitted catalogue; source `owner` is captured before reads and
   * retires its cache and geometry. Omitted owners use the construction scope. */
  static async fromProduct(product: ShardProduct, file: string, owner: Scope = resourceScope()): Promise<ProductFigureCatalogue> {
    const ready = admitted.get(product)?.get(file); if (ready !== undefined) return ready;
    const catalogue = new ProductFigureCatalogue(product.slug, file); await catalogue.admit(product, owner); return catalogue;
  }
  private readonly figures = new FigureCatalogue();
  private pending: Promise<void> | undefined;
  constructor(private readonly productId: string, private readonly file: string) {}
  async admit(product: ShardProduct, owner: Scope = resourceScope()): Promise<void> {
    const check = (): void => { if (owner.disposed || owner.disposing) throw new Error('Figure catalogue owner left'); };
    check();
    const data = v.parse(FigureCatalogueSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file(this.file))));
    check();
    const resources = new SceneHandles();
    if (data.pack !== undefined) {
      const pack = new GeometryPack(await fetchDeflated(data.pack.url), data.pack.rows, this.file);
      check();
      const indices = new Set(Object.values(data.figures).flatMap(row => [row.body, row.glass]).filter(index => index !== undefined && index !== null));
      for (const index of indices) {
        const geometry = pack.geometry(index); resources.publish(String(index), geometry);
        owner.onDispose(() => { geometry.dispose(); });
      }
    }
    await owner.run(() => this.figures.admit(data, resources)); check();
    const book = admitted.get(product) ?? new Map<string, ProductFigureCatalogue>();
    book.set(this.file, this); admitted.set(product, book);
    owner.onDispose(() => { if (book.get(this.file) === this) book.delete(this.file); });
  }
  prepare(): Promise<void> {
    this.pending ??= (async () => {
      try { await this.admit(await loadFirstPartyProduct(this.productId)); }
      catch (error: unknown) { this.pending = undefined; throw error; }
    })();
    return this.pending;
  }
  material(resources: SceneHandles): THREE.MeshStandardMaterial { return this.figures.material(resources); }
  create(id: string, resources: SceneHandles, feet: readonly [number, number, number], yaw: number, owner?: Scope): FigureRows { return this.figures.create(id, resources, feet, yaw, owner); }
  model(id: string): ModelDef<object> { return this.figures.model(id); }
  rows(id: string): FigureRow { return this.figures.rows(id); }
  kit(id: string): unknown { return this.figures.kit(id); }
}
