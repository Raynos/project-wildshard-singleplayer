import type { WaterBody } from './body';
import { waterExtent, waveHeight } from '../waves';
import { SHORE_REVETMENT_INNER_FACE } from '../../sim/shore';
import { insidePolygon } from '../yawFrame';
import { CHUNK_HALF, ENTRY_WIDTH, ENTRY_ASPHALT } from '../../core/config';

/** Canonical entryway exclusions; they remove water across the entire platform socket, not an authored sample point. */
export type DryEntryEdge = 'north' | 'east' | 'south' | 'west';
/** Pure water clipping shared by body admission and the renderer's data adapter. */
export function dryEntryContains(edge: DryEntryEdge, x: number, z: number): boolean {
  switch (edge) {
    case 'north': return Math.abs(x) <= ENTRY_WIDTH / 2 && z >= CHUNK_HALF - ENTRY_ASPHALT && z <= CHUNK_HALF;
    case 'south': return Math.abs(x) <= ENTRY_WIDTH / 2 && z >= -CHUNK_HALF && z <= -CHUNK_HALF + ENTRY_ASPHALT;
    case 'east': return Math.abs(z) <= ENTRY_WIDTH / 2 && x >= CHUNK_HALF - ENTRY_ASPHALT && x <= CHUNK_HALF;
    case 'west': return Math.abs(z) <= ENTRY_WIDTH / 2 && x >= -CHUNK_HALF && x <= -CHUNK_HALF + ENTRY_ASPHALT;
    default: throw new Error('Invalid dry entryway');
  }
}

/** One bounded water region in the shard's local frame; stream point heights describe a sloping rest surface. */
export type WaterDeclaration = (
  | { id: string; kind: 'pool'; level: number; shape: { kind: 'circle'; x: number; z: number; radius: number } | { kind: 'polygon'; points: readonly (readonly [number, number])[] } }
  | { id: 'sea'; kind: 'sea'; level: number; waves: boolean }
  | { id: string; kind: 'stream'; width: number; points: readonly { x: number; z: number; level: number; under?: string | undefined }[];
      levels?: Readonly<Record<string, number>> | undefined }
) & { dryEntries?: readonly DryEntryEdge[] | undefined };

const LIVE = new Map<string, number>();
/**
 * Move a live water level (a stream's `levels` row, named by its points' `under`): a stream point under it rests at the higher
 * of its own level and this one, so a draining pool lowers its stretch of the creek for wading and the dry-ground test.
 * Names are machine-wide; a shard names its own (its slug first). Unset, a level rests at its declared value.
 */
export function setLiveWaterLevel(name: string, level: number): void {
  if (!Number.isFinite(level)) throw new Error(`Invalid live water level ${name}`);
  LIVE.set(name, level);
}

/** Compile validated data into the existing swim/wade port, with no renderer or import-time registration. A sea stops
 *  at the shore revetment's inner face when a grid cell confines the water (`waterExtent`; unbounded standalone). */
export function declaredWaterBody(input: WaterDeclaration): WaterBody {
  const data = structuredClone(input);
  const level = data.kind === 'stream' ? data.points[0]?.level ?? 0 : data.level;
  const restAt = (x: number, z: number): number | null => {
    if (![x, z].every(Number.isFinite) || Math.abs(x) > 250 || Math.abs(z) > 250) return null;
    if (data.dryEntries?.some((edge) => dryEntryContains(edge, x, z))) return null;
    if (data.kind === 'sea') return Math.max(Math.abs(x), Math.abs(z)) <= waterExtent.uWaterHalf.value - SHORE_REVETMENT_INNER_FACE ? data.level : null;
    if (data.kind === 'pool') {
      const shape = data.shape;
      if (shape.kind === 'circle') return Math.hypot(x - shape.x, z - shape.z) < shape.radius ? data.level : null;
      return insidePolygon(shape.points, x, z) ? data.level : null;
    }
    let distance = Infinity, height = level;
    const rest = data.levels, at = (p: { level: number; under?: string | undefined }): number =>
      p.under === undefined ? p.level : Math.max(p.level, LIVE.get(p.under) ?? rest?.[p.under] ?? p.level);
    for (let i = 1; i < data.points.length; i++) {
      const a = data.points[i - 1], b = data.points[i]; if (a === undefined || b === undefined) continue;
      const dx = b.x - a.x, dz = b.z - a.z, n = dx * dx + dz * dz;
      const t = n === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / n));
      const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (d < distance) { distance = d; const from = at(a); height = from + (at(b) - from) * t; }
    }
    return distance < data.width / 2 ? height : null;
  };
  const surfaceAt = (x: number, z: number): number => ![x, z].every(Number.isFinite) ? level : (restAt(x, z) ?? level) + (data.kind === 'sea' && data.waves ? waveHeight(x, z) : 0);
  return { id: data.id, level, restAt, surfaceAt, inside: (x, z, y) => Number.isFinite(y) && restAt(x, z) !== null && y < surfaceAt(x, z) };
}
