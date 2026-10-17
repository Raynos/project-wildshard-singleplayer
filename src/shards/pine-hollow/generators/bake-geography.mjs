import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { PineSeedStream } from './seedStream.ts';
import { forestDensity, oldGrowthMask, speciesMix } from './forestGeography.ts';
import { creekSpan } from './geography.ts';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const speciesIds = manifest.forest.speciesTraits.map(row => row.id);

/** Sample the exact jittered candidate lattice, retaining every double. */
export function pineGeography() {
  const rng = new PineSeedStream(manifest.seed + 99), cell = manifest.forest.spacing, forest = [];
  for (let x = -244; x < 244; x += cell) for (let z = -244; z < 244; z += cell) {
    const px = x + rng.range(-cell * 0.45, cell * 0.45), pz = z + rng.range(-cell * 0.45, cell * 0.45);
    forest.push({ x: px, z: pz, density: forestDensity(px, pz), scale: 1 + oldGrowthMask(px, pz) * 0.25, species: speciesMix(px, pz, speciesIds) });
  }
  const lines = []; let arc = 0;
  for (let i = 0; i + 1 < LAYOUT.CREEK.length; i++) {
    const a = LAYOUT.CREEK[i], b = LAYOUT.CREEK[i + 1]; if (a === undefined || b === undefined) throw new Error('Missing creek vertex');
    const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz, length = Math.sqrt(l2);
    lines.push({ x: a[0], z: a[1], vx, vz, l2, length, arc }); arc += length;
  }
  const { dam, end } = creekSpan(), p = LAYOUT.BEAVER_POOL, b = LAYOUT.CREEK_BED;
  const span = (until, start, offset, size, from, to) => ({ until, start, offset, span: size, from, to });
  const run = span(end, dam, 3, end - dam - 3, b.afterDam, b.edge);
  const { lead, crest, depth, halfWidth } = LAYOUT.CREEK_WATER;
  return { forest, creek: { lines, dam, riffle: p.riffle, lead, crest, depth, halfWidth, run, bed: [
    span(p.riffle - 4, 0, 0, 1, b.outlet, b.outlet),
    span(p.riffle, p.riffle, -4, 4, b.outlet, p.crest),
    span(p.riffle + p.slope, p.riffle, 0, p.slope, p.crest, p.bed),
    span(dam, p.riffle + p.slope, 0, dam - (p.riffle + p.slope), p.bed, b.sill),
    span(dam + 3, dam, 0, 3, b.sill, b.afterDam),
  ] } };
}

if (import.meta.main) {
  const writer = byteWriter(process.argv.includes('--check'), 'pine-geography');
  writer.put(fileURLToPath(new URL('../data/geography.generated.json', import.meta.url)), jsonBytes(pineGeography(), 0));
  writer.finish();
}
