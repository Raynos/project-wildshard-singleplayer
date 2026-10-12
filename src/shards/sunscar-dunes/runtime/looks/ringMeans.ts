import { fetchDeflated } from '@wildshard/sdk/kit/geometryPack';
import ground from '../../data/manifestGround.generated.json' with { type: 'json' };

/** Exact authored f64 means at the unchanged terrain tile vertices; no resampling of the collider. */
export async function loadSignalRingMeans(url: string): Promise<(x: number, z: number) => number> {
  return decodeSignalRingMeans(await fetchDeflated(url));
}

/** Refuse malformed or off-lattice tint reads before a tile can be painted. */
export function decodeSignalRingMeans(bytes: Uint8Array): (x: number, z: number) => number {
  const { resolution, size, x: x0, z: z0 } = ground.mean;
  if (resolution !== 257 || size !== 500 || bytes.length !== resolution ** 2 * 8) throw new Error('Invalid authored sand ring means');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), values = new Float64Array(resolution ** 2);
  for (let i = 0; i < 66049; i++) {
    const value = view.getFloat64(i * 8, true);
    if (!Number.isFinite(value)) throw new Error('Nonfinite authored sand ring mean');
    values[i] = value;
  }
  const invalid = new Error('Sand tint query is not an authored tile vertex');
  return (x, z) => {
    const gx = (x - x0) * (resolution - 1) / size, gz = (z - z0) * (resolution - 1) / size;
    const ix = Math.round(gx), iz = Math.round(gz);
    if (!Number.isFinite(gx) || !Number.isFinite(gz) || ix < 0 || ix >= resolution || iz < 0 || iz >= resolution
      || Math.abs(gx - ix) > 1e-9 || Math.abs(gz - iz) > 1e-9) throw invalid;
    const mean = values[iz * resolution + ix];
    if (mean === undefined) throw invalid;
    return mean;
  };
}
