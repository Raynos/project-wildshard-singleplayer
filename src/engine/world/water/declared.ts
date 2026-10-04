import type { WaterBody } from './body';
import { waveHeight } from '../waves';

/** One bounded water region in the shard's local frame; stream point heights describe a sloping rest surface. */
export type WaterDeclaration =
  | { id: string; kind: 'pool'; level: number; shape: { kind: 'circle'; x: number; z: number; radius: number } | { kind: 'polygon'; points: readonly (readonly [number, number])[] } }
  | { id: 'sea'; kind: 'sea'; level: number; waves: boolean }
  | { id: string; kind: 'stream'; width: number; points: readonly { x: number; z: number; level: number }[] };

/** Compile validated data into the existing swim/wade port, with no renderer or import-time registration. */
export function declaredWaterBody(input: WaterDeclaration): WaterBody {
  const data = structuredClone(input);
  const level = data.kind === 'stream' ? data.points[0]?.level ?? 0 : data.level;
  const restAt = (x: number, z: number): number | null => {
    if (![x, z].every(Number.isFinite) || Math.abs(x) > 250 || Math.abs(z) > 250) return null;
    if (data.kind === 'sea') return data.level;
    if (data.kind === 'pool') {
      const shape = data.shape;
      if (shape.kind === 'circle') return Math.hypot(x - shape.x, z - shape.z) < shape.radius ? data.level : null;
      let inside = false;
      for (let i = 0, j = shape.points.length - 1; i < shape.points.length; j = i++) {
        const a = shape.points[i], b = shape.points[j]; if (a === undefined || b === undefined) continue;
        if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside ? data.level : null;
    }
    let distance = Infinity, height = level;
    for (let i = 1; i < data.points.length; i++) {
      const a = data.points[i - 1], b = data.points[i]; if (a === undefined || b === undefined) continue;
      const dx = b.x - a.x, dz = b.z - a.z, n = dx * dx + dz * dz;
      const t = n === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / n));
      const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (d < distance) { distance = d; height = a.level + (b.level - a.level) * t; }
    }
    return distance < data.width / 2 ? height : null;
  };
  const surfaceAt = (x: number, z: number): number => ![x, z].every(Number.isFinite) ? level : (restAt(x, z) ?? level) + (data.kind === 'sea' && data.waves ? waveHeight(x, z) : 0);
  return { id: data.id, level, restAt, surfaceAt, inside: (x, z, y) => Number.isFinite(y) && restAt(x, z) !== null && y < surfaceAt(x, z) };
}
