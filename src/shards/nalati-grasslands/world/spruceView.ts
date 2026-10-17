import * as THREE from 'three';
import * as v from 'valibot';
import type { LookReplaceContext } from '@wildshard/engine/render/look';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { TreeFactory, type TreeVariant } from '@wildshard/engine/world/TreeFactory';
import { GeometryPack, packedRows, fetchDeflated, fetchBakeJson } from '@wildshard/sdk/kit/geometryPack';

/** Triangle counts per LOD for one variant (perf reports). */
export interface SpruceLodTris { hi: number; twigs: number; lo: number; far: number; trunk: number }

export class SpruceFactory extends TreeFactory {
  /** tris per LOD, per variant (the order of `variants`) */
  lodTris: SpruceLodTris[] = [];

  constructor(renderer: LookReplaceContext['renderer'], private readonly sky: Sky) { super(renderer); }

  override async build(): Promise<this> {
    // the shared painterly material (one program, four uniform sets). Spruce is stiff: ~0.35 m of sway at the top of
    // an 18 m tree (painterly's sway is metres per metre² of height), a warm rim on the sun side of the spires.
    const sway = 0.0011;
    this.needleMaterial = painterlyMaterial(this.sky, { rim: 0.2, bands: 0.85, sway });
    this.twigMaterial = painterlyMaterial(this.sky, { rim: 0.1, bands: 0.85, sway });
    this.farMaterial = painterlyMaterial(this.sky, { rim: 0.25, bands: 0.7, sway });
    this.barkMaterial = painterlyMaterial(this.sky, { rim: 0.15, bands: 0.8, sway: sway * 0.4 });
    // shadows: the plain depth pass (painterly's own shadow-depth does not sway either)
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this.twigDepth = this.needleDepth;

    // The pack and inflated bytes are local to boot, never a resident geometry cache.
    const [bytes, json] = await Promise.all([fetchDeflated('/assets/nalati/baked/spruce.bin'), fetchBakeJson('/assets/nalati/baked/spruce.json')]);
    const spruce = v.parse(v.object({
      pack: v.object({ bytes: v.number(), geometries: v.array(v.object({ attrs: v.array(v.tuple([v.string(), v.number()])), count: v.number(), unique: v.number(), own: v.nullable(v.picklist(['u16', 'u32'])), indexCount: v.number() })) }),
      variants: v.array(v.object({ height: v.number(), trunkRadius: v.number(), trunk: v.number(), cardsHi: v.number(), cardsLo: v.number(), twigs: v.number(), far: v.number() })),
    }), json);
    const pack = new GeometryPack(bytes, packedRows(spruce.pack), 'Nalati spruce');
    for (const row of spruce.variants) {
      const geo = (i: number) => { const g = pack.geometry(i); g.computeBoundingSphere(); return g; };
      const variant: TreeVariant = { height: row.height, trunkRadius: row.trunkRadius, trunk: geo(row.trunk), cardsHi: geo(row.cardsHi), cardsLo: geo(row.cardsLo), twigs: geo(row.twigs), far: geo(row.far) };
      this.variants.push(variant);
      const tris = (g: THREE.BufferGeometry) => (g.index?.count ?? 0) / 3;
      this.lodTris.push({ hi: tris(variant.cardsHi), twigs: tris(variant.twigs), lo: tris(variant.cardsLo), far: tris(variant.far), trunk: tris(variant.trunk) });
    }
    return this;
  }
}

/** Deferred authored tree view: the engine still owns placement, LODs, culling and collisions. */
export function spruceFactory(renderer: LookReplaceContext['renderer'], sky: Sky): Promise<TreeFactory> { return new SpruceFactory(renderer, sky).build(); }
