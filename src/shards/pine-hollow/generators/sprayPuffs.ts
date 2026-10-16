/**
 * The waterfall's spray puffs, baked offline (SHARD-PLATFORM W2): a few soft puffs at the foot of the fall's face and over
 * the plunge (lifted off the pond), each with its instance origin, its `aSeed` (phase, period (s), sideways drift,
 * opacity) and its `aSize` (width, height, rise in metres) from a fixed golden-ratio walk. The page reads the rows
 * (../data/sprayPuffs.json) into its one instanced draw (../world/streams.ts); its graph is ../data/streamLook.ts.
 */
import streamJson from '../data/streams.json' with { type: 'json' };

/** The spray's anchors: at the foot of the fall's face, and over the plunge (lifted `lift` m off the pond). */
const SPRAY_ANCHORS = {
  faceFoot: { n: 5, size: 4.5, rise: 3.5 },
  plunge: { n: 6, size: 5.5, rise: 3, lift: 0.3 },
} as const;

/** Each puff's origin (x, y, z), seed (4) and size (3), flattened in puff order. */
export function sprayPuffRows(): { at: number[]; seed: number[]; size: number[] } {
  const [fx = 0, fy = 0, fz = 0] = streamJson.faceFoot, [px = 0, py = 0, pz = 0] = streamJson.plunge;
  const anchors = [
    { p: [fx, fy, fz], ...SPRAY_ANCHORS.faceFoot },
    { p: [px, py + SPRAY_ANCHORS.plunge.lift, pz], ...SPRAY_ANCHORS.plunge },
  ];
  const at: number[] = [], seed: number[] = [], size: number[] = [];
  let i = 0;
  for (const a of anchors) for (let k = 0; k < a.n; k++, i++) {
    const j = (i * 0.618034) % 1, [x = 0, y = 0, z = 0] = a.p;
    size.push(a.size * (0.8 + 0.4 * j), a.size * (0.8 + 0.4 * ((j * 7.3) % 1)), a.rise);
    at.push(x + Math.cos(i * 2.4) * 1.2, y, z + Math.sin(i * 2.4) * 1.2);
    seed.push(j, 2.6 + 1.6 * ((j * 3.7) % 1), (j * 5.1) % 1 - 0.5, 0.8 + 0.4 * ((j * 11.3) % 1));
  }
  return { at, seed, size };
}
