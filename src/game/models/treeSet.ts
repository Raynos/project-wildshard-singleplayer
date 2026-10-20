/** Client-only forest presentation of a baked tree set declared as rows (format/treeSetRows). */
import * as THREE from 'three';
import * as v from 'valibot';
import { resourceScope } from '@wildshard/engine/app/resources';
import { loadTexture, loadPBRArray } from '@wildshard/engine/core/assets';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { defineModel, type ModelContext, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';
import type { LookReplaceContext } from '@wildshard/engine/render/look';
import { FOREST_BANDS, trunkCapsule } from '@wildshard/engine/world/forest/Forest';
import { BARK_LAYERS, treeSetUrls } from '@wildshard/engine/world/forest/treeSet';
import { TreeFactory, isTreeMaterial, type TreeMaterial } from '@wildshard/engine/world/TreeFactory';
import { TreeSetSchema, type TreeSetRows } from '@wildshard/format/treeSetRows';
import { createModelLibrary } from '../plugin/geometry';
import { lookGraphMaterials } from '../plugin/shaderFamily';
import { lendLooks } from '../shardfile/lentLooks';
import { firstPartyDescriptor, loadFirstPartyProduct } from '../shardfile/runtimeProduct';

/** Read a first-party product's tree set rows (`file`, a named JSON blob). */
export async function productTreeSet(slug: string, file: string): Promise<TreeSetRows> {
  return v.parse(TreeSetSchema, await (await loadFirstPartyProduct(slug)).json(file));
}

/**
 * The set's tree factory: its geometry pool, card and impostor atlases and bark array, nothing baked at launch; four
 * materials in the forest's LOD slots wearing the set's look.materials graphs, compiled on the page renderer with the
 * set's textures lent (the bark tiles the bark array by its per-vertex layer).
 */
export class TreeSetFactory extends TreeFactory {
  constructor(private readonly renderer: LookReplaceContext['renderer'], private readonly rows: TreeSetRows) { super(renderer); }

  override async build(): Promise<this> {
    const rows = this.rows, U = treeSetUrls(rows.set);
    const library = createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1, geometryPools: [rows.geometry] }, '[trees]');
    // the loader fences compressed maps before returning; choose the final sampler while mips exist
    const sampler = (anisotropy: number) => (texture: THREE.Texture): void => { texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = anisotropy; };
    const cards = sampler(rows.anisotropy.cards), far = sampler(rows.anisotropy.far);
    const [, cardAlbedo, cardNormal, cardArm, farAlbedo, farNormal, bark, looks] = await Promise.all([
      library.preload(),
      loadTexture(U.cardsAlbedo, true, 1, undefined, cards), loadTexture(U.cardsNormal, false, 1, undefined, cards), loadTexture(U.cardsArm, false, 1, undefined, cards),
      loadTexture(U.farAlbedo, true, 1, undefined, far), loadTexture(U.farNormal, false, 1, undefined, far),
      loadPBRArray([...BARK_LAYERS], TIER_CONFIG.layerSize),
      firstPartyDescriptor(rows.product).then(source => lookGraphMaterials(resourceScope(), { renderer: this.renderer }, source, Object.values(rows.looks))),
    ]);
    this.tintBark = rows.tintBark;
    lendLooks(resourceScope(), looks);
    const look = (id: string, lent: Readonly<Record<string, THREE.Texture>>): TreeMaterial => {
      for (const [name, texture] of Object.entries(lent)) looks.setTexture(id, name, texture);
      const m = looks.materials.get(id);
      if (m === undefined) throw new Error(`[trees] look.materials lacks ${id}`);
      if (!isTreeMaterial(m)) throw new Error(`[trees] ${id} has no base colour (not a standard-model graph)`);
      return m;
    };
    this.barkMaterial = look(rows.looks.bark, { barkMap: bark.map, barkNormal: bark.normalMap, barkArm: bark.armMap });
    const card = { cardMap: cardAlbedo, cardNormal, cardArm };
    this.needleMaterial = look(rows.looks.needles, card);
    this.twigMaterial = look(rows.looks.twigs, card);
    this.farMaterial = look(rows.looks.far, { farMap: farAlbedo, farNormal });
    for (const s of rows.variants) {
      const part = (name: string): THREE.BufferGeometry => {
        const geometry = library.geometry(`${s.name}__${name}`, { borrow: true });
        if (geometry === null) throw new Error(`[trees] the set has no ${s.name}__${name}`);
        return geometry;
      };
      this.variants.push({ trunk: part('trunk'), trunkLo: part('trunkLo'), cardsHi: part('hi'), cardsLo: part('lo'), twigs: part('twigs'), far: part('far'),
        height: s.height, trunkRadius: s.trunk, species: s.species, collider: s.collider });
    }
    return this;
  }
}

/** A tree copy: its variant (the set's order), its placement's height, trunk radius and scale (0 height: no collider). */
export interface TreeSetParams { readonly v: number; readonly height: number; readonly r: number; readonly scale: number }

/**
 * The set as one model the forest draws (`place`, its LODs the forest's bands): near the trunk, the hi cards and the
 * twigs (only within `FOREST_BANDS.twig`), then the lo trunk and cards, then the impostor dissolving in. Every copy is
 * tinted (the bark only when the factory tints it); the needle cards sort front to back. Each trunk collides as the
 * forest's capsule in the copy's frame. `use(ctx, factory)` hands the built factory to the model's context.
 */
export function treeSetModel(rows: TreeSetRows): { readonly model: ModelDef<TreeSetParams>; readonly use: (ctx: ModelContext, factory: TreeFactory) => void } {
  const key = `${rows.model.id}:factory`;
  const factoryOf = (ctx: ModelContext): TreeFactory => ctx.once<TreeFactory>(key, () => { throw new Error(`[${rows.model.id}] no tree factory`); });
  const band = (ctx: ModelContext, i: number, level: 'near' | 'far' | 'impostor'): ModelPart[] => {
    const f = factoryOf(ctx), t = f.variants[i];
    if (!t) return [];
    if (level === 'impostor') return [{ geometry: t.far, material: f.farMaterial, receiveShadow: true }];
    if (level === 'far') return [
      { geometry: t.trunkLo ?? t.trunk, material: f.barkMaterial, castShadow: TIER_CONFIG.loTreeShadows, receiveShadow: true, tint: f.tintBark },
      { geometry: t.cardsLo, material: f.needleMaterial, castShadow: TIER_CONFIG.loTreeShadows, receiveShadow: true, sortObjects: true },
    ];
    return [
      { geometry: t.trunk, material: f.barkMaterial, castShadow: true, receiveShadow: true, tint: f.tintBark },
      { geometry: t.cardsHi, material: f.needleMaterial, castShadow: true, receiveShadow: true, sortObjects: true },
      { geometry: t.twigs, material: f.twigMaterial, castShadow: true, receiveShadow: true, until: FOREST_BANDS.twig },
    ];
  };
  const model = defineModel<TreeSetParams>({
    id: rows.model.id, name: rows.model.name, category: 'nature', pipeline: 'blender', file: rows.model.file, surface: 'wood',
    defaults: { v: 0, height: 0, r: 0, scale: 1 },
    variants: rows.variants.map((s, i) => ({ id: s.name, label: s.label, params: { v: i } })),
    build: (ctx, p) => band(ctx, p.v, 'near'),
    colliders: (p) => {
      if (p.height <= 0) return [];
      const c = trunkCapsule(p), s = p.scale;
      return [{ kind: 'capsule', x: 0, y: c.y / s, z: 0, halfHeight: c.halfHeight / s, radius: c.radius / s }];
    },
    lods: [
      { get from() { return FOREST_BANDS.hi; }, build: (ctx, p) => band(ctx, p.v, 'far') },
      { get from() { return FOREST_BANDS.far; }, fade: FOREST_BANDS.fade, build: (ctx, p) => band(ctx, p.v, 'impostor') },
    ],
  });
  return { model, use: (ctx, factory) => { ctx.once(key, () => factory); } };
}
