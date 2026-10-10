/**
 * Rigid skins (SHARD-PLATFORM M3; ex a dune shard's code-built creatures): a creature built from rigid parts, each a
 * three.js geometry with one flat colour riding one bone, merged into one skinned, vertex-coloured, flat-shaded geometry;
 * `placed` stands a part in the body's frame. Build-time and runtime alike; nothing here knows a shard.
 */
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, type BufferGeometry as Geo } from 'three';

/** One rigid part of a creature: a three.js geometry, its flat colour and the one bone it rides. */
export interface SkinPart { geometry: Geo; color: [number, number, number]; bone: number }

/**
 * Merges rigid parts into one skinned, vertex-coloured, flat-shaded geometry (each vertex weighted 1 to its part's
 * bone). The parts are disposed: the merged geometry is the only buffer kept.
 */
export function skinParts(parts: readonly SkinPart[]): BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [], wts: number[] = [];
  for (const part of parts) {
    const g = part.geometry.index === null ? part.geometry : part.geometry.toNonIndexed(), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(...part.color); idx.push(part.bone, 0, 0, 0); wts.push(1, 0, 0, 0); }
    if (g !== part.geometry) g.dispose();
    part.geometry.dispose();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(idx), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(wts, 4));
  geometry.computeVertexNormals();
  return geometry;
}

/** A geometry moved to (x, y, z), optionally scaled and turned (radians about X, then Y, then Z). */
export function placed(g: Geo, x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], r: [number, number, number] = [0, 0, 0]): Geo {
  g.scale(...s); if (r[0] !== 0) g.rotateX(r[0]); if (r[1] !== 0) g.rotateY(r[1]); if (r[2] !== 0) g.rotateZ(r[2]); g.translate(x, y, z); return g;
}
