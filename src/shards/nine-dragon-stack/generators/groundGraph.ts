import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { assetCost } from '@wildshard/sdk/assets';
import { groundGraph } from './architectureGraphs';

/**
 * G5: the kit's flagstones (kind 3) draw through their own program, the kit graph with its kind fixed, so the faces that
 * fill 72 % of the phone's street pose (a) carry none of the other kinds' registers (−0.5 of ~3.1 ms on the M5's frozen
 * frame there). It ships as a material file, as the held graphs do (heldGraphFiles.ts): the declaration's admission walks
 * its JSON before the SDK lowers inline graphs, and a second 10,900-node kit graph inline put Nine past the 100,000-node
 * bound. Its texture params are all lent, so the file depends on nothing.
 */
export const GROUND_LOOK = 'nine-architecture-ground';

interface GroundGraphFile {
  readonly bytes: Uint8Array;
  readonly material: { readonly family: 'graph'; readonly file: string };
  readonly file: ReturnType<typeof assetCost> & { readonly hash: string; readonly kind: 'json'; readonly compressed: number; readonly dependencies: readonly string[]; readonly critical: boolean };
}
let built: GroundGraphFile | undefined;
/** the kind-3 graph's file, its catalogue entry and its files row (one build per process) */
export function groundGraphFile(): GroundGraphFile {
  if (built !== undefined) return built;
  const bytes = new TextEncoder().encode(JSON.stringify(groundGraph())), hash = hashImmutableBytes(bytes);
  built = { bytes, material: { family: 'graph', file: hash }, file: { hash, kind: 'json', compressed: bytes.length, ...assetCost('json', bytes), dependencies: [], critical: false } };
  return built;
}
