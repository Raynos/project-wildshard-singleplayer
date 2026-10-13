import { type BufferGeometry, DataTexture, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, type Object3D, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType, Vector3 } from 'three';
import { LashCord } from './lashView';
import type { LashHoldRow } from '../../data/whip';

/**
 * The lash item's held view (SHARD-PLATFORM M3; ex a dune shard's whip model): the textured hero glove with its plaited
 * coil, a braided rest coil and the thrown cord. Every tube is baked offline (`generators/lash.ts`, G345): this only
 * dresses the baked kinds in their materials and places them. Nothing here knows a shard: the models arrive as loaders,
 * the coil's surface as a callback.
 */

/** The held lash's models: a copy of one of its baked kinds (null: the bake did not load), the plait tile's baked texels (colour, normal, roughness; null: not loaded), the fitted hero glove (null: not loaded), the hero coil's surface. */
export interface LashHoldModels {
  readonly baked: (kind: 'coil' | 'loop' | 'cord' | 'wrap') => BufferGeometry | null;
  readonly plait: () => Uint8Array | null;
  readonly hd: () => Group | null;
  readonly coilSurface: (m: MeshStandardMaterial) => void;
}
/** The bake's numbers: where the lash leaves the hand (the hold's frame), the plait tile's repeat along the hero coil. */
export interface LashFit { readonly tip: readonly [number, number, number]; readonly along: number }

/** A built held lash: the root, the grip that flicks, the rest coil, the thrown cord, where the lash leaves the hand, and the hero glove. */
export interface LashHoldParts { root: Group; grip: Group; coil: Object3D; lash: LashCord; tip: Vector3; hd: Group | null }

/** The lash's matte braid as a plain material (no vertex colours), for a pull's wrap coil. */
export function lashWrapMaterial(row: LashHoldRow): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: row.wrap.colour, roughness: row.wrap.roughness, metalness: 0, emissive: row.leathers.emissive });
}

/** Builds the held lash from its rows and its bake: the rest coil beside the grip, the thrown cord, the hero glove holding its plaited coil. */
export function buildLashHold(row: LashHoldRow, fit: LashFit, models: LashHoldModels): LashHoldParts {
  const root = new Group(), grip = new Group(), c = row.made.coil, rest = models.baked('coil');
  const coilMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: row.braid.roughness, metalness: 0, emissive: row.leathers.emissive });
  coilMaterial.roughness = row.coil.roughness; Object.assign(coilMaterial.userData, row.coilUserData);
  const coil = rest === null ? new Group() : new Mesh(rest, coilMaterial);
  coil.position.set(...c.pos); coil.rotation.set(...c.rot);
  root.add(grip, coil);
  const lash = new LashCord(row.lash, models.baked('cord')); root.add(lash.mesh);
  const hd = models.hd(), loop = models.baked('loop');
  if (hd !== null) {
    hd.position.set(...row.hd.pos); hd.rotation.set(...row.hd.rot); root.add(hd);
    // the hero coil in the hero glove's own frame (the fitted model: out → holder (scaled) → turn (centred)): matte, unfogged
    const turn = hd.children[0]?.children[0];
    const n = row.plait.size, texels = models.plait();
    if (loop !== null && texels?.length === n * n * 12) {
      // the plait's three baked tiles (`generators/lash.ts` plaitTexels), mipmapped and repeated along the loop
      const tile = (k: number, srgb: boolean): DataTexture => {
        const t = new DataTexture(texels.subarray(k * n * n * 4, (k + 1) * n * n * 4), n, n, RGBAFormat, UnsignedByteType);
        t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
        if (srgb) t.colorSpace = SRGBColorSpace; t.repeat.set(fit.along, 1); t.needsUpdate = true; return t;
      };
      const material = new MeshStandardMaterial({ map: tile(0, true), normalMap: tile(1, false), roughnessMap: tile(2, false), roughness: 1, metalness: 0, fog: false });
      Object.assign(material.userData, row.coilUserData); models.coilSurface(material);
      turn?.add(new Mesh(loop, material));
    }
    coil.visible = false;
  }
  return { root, grip, coil, lash, tip: new Vector3(...fit.tip), hd };
}
