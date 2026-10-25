import { zlibSync } from 'fflate';
import { PineSeedStream } from './seedStream';
import { forestDensity, oldGrowthMask, speciesMix } from './forestGeography';

export const PINE_DENSITY_FILE = 'assets/pine-hollow/scalars/forest-density.bin';
interface ForestCandidate {
  x: number;
  z: number;
  density: number;
  scale: number;
  species: Partial<Record<string, number>>;
}
interface ForestSource {
  readonly seed: number;
  readonly forest: { readonly spacing: number; readonly speciesTraits: readonly { readonly id: string }[] };
}

/** The original jitter, draw order and f64 values, shared by metadata and native bytes. */
export function pineForestRows(manifest: ForestSource): ForestCandidate[] {
  const rng = new PineSeedStream(manifest.seed + 99), cell = manifest.forest.spacing, forest: ForestCandidate[] = [];
  const speciesIds = manifest.forest.speciesTraits.map(row => row.id);
  for (let x = -244; x < 244; x += cell) for (let z = -244; z < 244; z += cell) {
    const px = x + rng.range(-cell * .45, cell * .45), pz = z + rng.range(-cell * .45, cell * .45);
    forest.push({ x: px, z: pz, density: forestDensity(px, pz), scale: 1 + oldGrowthMask(px, pz) * .25,
      species: speciesMix(px, pz, speciesIds) });
  }
  return forest;
}

/** Pure owned bytes for product publication; no filesystem service in the config graph. */
export function pineDensityBlob(manifest: ForestSource): { name: string; bytes: Uint8Array; decoded: number } {
  const values = Float64Array.from(pineForestRows(manifest), row => row.density);
  return { name: PINE_DENSITY_FILE, bytes: zlibSync(new Uint8Array(values.buffer)), decoded: values.byteLength };
}
