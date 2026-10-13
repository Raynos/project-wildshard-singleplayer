import { Color, Float32BufferAttribute, PlaneGeometry, type BufferGeometry } from 'three';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { SKIRT_CUBE, SKIRT_GRID, SKIRT_SWELL, type SkirtGridRow, type SwellSkirtRow } from '../data/sand';
import { SAND_TINT } from '../data/duneField';
import { signalDunesField } from './tiles';

/**
 * Build-time only (SHARD-PLATFORM M3, SF72): the dune skirt past the ground's edge, which the look used to build behind the
 * loading screen over the analytic field. `scripts/bake-signal-sand.mjs` packs two cuts of it (`GeometryPackWriter`): the
 * standalone skirt out to `SKIRT_GRID.reach`, and the same skirt cut to a grid cell's cube (G99); the look reads them
 * back exact (`runtime/looks/duskLook.ts`).
 */

/** The skirt's height at (x, z) over `heightAt` (see `SwellSkirtRow`). */
export function swellSkirtAt(row: SwellSkirtRow, heightAt: (x: number, z: number) => number, x: number, z: number): number {
  const edge = row.edge, out = Math.max(Math.abs(x), Math.abs(z)) - edge;
  if (out < row.inside) return heightAt(x, z);
  const cx = Math.max(-edge, Math.min(edge, x)), cz = Math.max(-edge, Math.min(edge, z));
  const t = Math.min(1, Math.max(0, out / row.ease)), e = t * t * (3 - 2 * t);
  const wx = row.wind[0], wz = row.wind[1], u = (x * wx + z * wz) / row.along, v = (-x * wz + z * wx) / row.across;
  return heightAt(cx, cz) * (1 - e) + (row.base + row.swell * Math.sin((u + Math.sin(v) * row.wobble) * Math.PI * 2)) * e - row.drop;
}

/** One indexed skirt grid with smooth normals, every vertex `colour`, standing on `swell` (heights) and `heightAt` inside `swell.edge`. */
function skirtGrid(row: SkirtGridRow, swell: SwellSkirtRow, heightAt: (x: number, z: number) => number, colour: Color, reach: number): BufferGeometry {
  const n = Math.max(1, Math.round((reach * 2) / row.cell)), g = new PlaneGeometry(reach * 2, reach * 2, n, n); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3), c = colour, edge = swell.edge;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), out = Math.max(Math.abs(x), Math.abs(z)) - edge;
    const y = out < swell.inside ? heightAt(x, z) - row.sink : swellSkirtAt(swell, heightAt, x, z);
    p.setY(i, y); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** The skirt pack's rows: the geometry rows, and the cube half the second geometry is cut to. */
export interface SkirtPackRows extends PackedGeometryRows { readonly cubeHalf: number }

/** The skirt as a pack: geometry 0 the standalone skirt, geometry 1 the grid cell's (cut to `SKIRT_CUBE`). */
export function bakeSignalSkirt(): { bytes: Uint8Array; rows: SkirtPackRows } {
  // the dusk look's skirt and sand tint rows (data/lastLight.ts SIGNAL_DUSK_LOOK carries these same rows to the client)
  const grid = SKIRT_GRID, swell = SKIRT_SWELL, tint = SAND_TINT, heightAt = signalDunesField().heightAt;
  const colour = new Color(...tint.sand).lerp(new Color(...tint.hollow), tint.skirtHollow);
  const pack = new GeometryPackWriter('sunscar-dunes skirt');
  for (const reach of [grid.reach, SKIRT_CUBE]) pack.add(skirtGrid(grid, swell, heightAt, colour, reach));
  return { bytes: pack.bytes(), rows: { ...pack.rows(), cubeHalf: SKIRT_CUBE } };
}
