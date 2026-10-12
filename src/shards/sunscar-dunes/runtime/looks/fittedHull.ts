/**
 * Fitted creature hulls (SHARD-PLATFORM M3; ex a dune shard's generated creatures): a generated mesh (image-to-3D, painted
 * facets) fitted to its size and skinned to a species skeleton from rows, so the shard keeps only the numbers. Nothing here
 * knows a shard.
 *
 * - `bandSkin`: a flat winged body (a ray, a manta) skinned per vertex with smooth bands, so a shared corner never splits:
 *   the wings by |x|, the head forward of an edge, the tail behind one, the body the rest (bones body, head, left / right
 *   wing, tail); optionally tinted, the back by a factor and the underside toward a belly colour.
 * - `bakedLook`: a species look on a baked body (the skitterer, the strider): its rig contract and clips as rows.
 */
import { Float32BufferAttribute, Uint16BufferAttribute, type BufferGeometry } from 'three';
import type { ClipName, SocketName } from '@wildshard/engine/anim/rig';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { fitGeometry } from '@wildshard/game/plugin/geometry';
import { clipAnimate, type SpeciesClips } from '@wildshard/game/plugin/animation';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import type { BandSkinRow, HullTint } from '../../data/hulls';

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** A generated winged body fitted and band-skinned from its rows, tinted when `tint` is set. */
export function bandSkin(source: BufferGeometry, row: BandSkinRow, tint: HullTint | null = null): BufferGeometry {
  const g = fitGeometry(source, row.fit), b = g.boundingBox;
  if (b !== null) g.translate(0, 0, row.nose - b.max.z);
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i), wing = smooth((Math.abs(x) - row.wing.from) / row.wing.over), tail = smooth((-row.tail.from - z) / row.tail.over) * (1 - wing);
    const head = smooth((z - row.head.from) / row.head.over) * (1 - wing), body = Math.max(0, 1 - wing - tail - head);
    index.set([0, 1, x < 0 ? 2 : 3, 4], i * 4); weight.set([body, head, wing, tail], i * 4);
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  if (tint !== null && g.hasAttribute('color')) {
    const col = g.getAttribute('color');
    if (!g.hasAttribute('normal')) g.computeVertexNormals();
    const nrm = g.getAttribute('normal');
    for (let i = 0; i < n; i++) {
      const under = smooth((-nrm.getY(i) - 0.1) / 0.5) * tint.bellyMix;
      for (let c = 0; c < 3; c++) {
        const v = (c === 0 ? col.getX(i) : c === 1 ? col.getY(i) : col.getZ(i)) * (tint.top[c] ?? 1);
        const out = v + ((tint.belly[c] ?? v) - v) * under;
        if (c === 0) col.setX(i, out); else if (c === 1) col.setY(i, out); else col.setZ(i, out);
      }
    }
    col.needsUpdate = true;
  }
  return g;
}

/** A baked body's species look as rows: its ids and rig contract (its dims ride in the baked body). */
export interface BakedLookRow {
  readonly id: string; readonly species: string; readonly kind: string;
  readonly skeleton: string; readonly sockets: readonly SocketName[]; readonly clipNames: readonly ClipName[];
}

/** A species look on a baked body (`build`: a fresh copy each time, world/meshes.ts duneBody), animated by its clip rows. */
export function bakedLook(row: BakedLookRow, build: () => AnimalSpecies, clips: SpeciesClips): SpeciesLook {
  return { id: row.id, species: row.species, kind: row.kind, rig: 'custom', fur: NO_FUR,
    rigContract: { skeleton: row.skeleton, sockets: [...row.sockets], clips: [...row.clipNames] }, build, animate: clipAnimate(clips) };
}
