import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { assetCost } from '@wildshard/sdk/assets';
import { crowdGraph } from './architectureGraphs';

/** The paired crowd owns a separate material so ordinary kit instances never
 * reserve its palette attributes. Exact-zero authored offset/spill channels
 * are constants here, leaving room for both palettes under WebGL's 16 slots.
 * The graph is a declared material file, keeping the root declaration bounded.
 */
export const CROWD_LOOK = 'nine-crowd-table';

interface CrowdGraphFile {
  readonly bytes: Uint8Array;
  readonly material: { readonly family: 'graph'; readonly file: string };
  readonly file: ReturnType<typeof assetCost> & { readonly hash: string; readonly kind: 'json'; readonly compressed: number; readonly dependencies: readonly string[]; readonly critical: boolean };
}
let built: CrowdGraphFile | undefined;
/** The paired crowd graph's file, its catalogue entry and its files row (one build per process) */
export function crowdGraphFile(): CrowdGraphFile {
  if (built !== undefined) return built;
  const bytes = new TextEncoder().encode(JSON.stringify(crowdGraph())), hash = hashImmutableBytes(bytes);
  built = { bytes, material: { family: 'graph', file: hash }, file: { hash, kind: 'json', compressed: bytes.length, ...assetCost('json', bytes), dependencies: [], critical: false } };
  return built;
}
