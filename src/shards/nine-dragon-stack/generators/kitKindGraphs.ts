import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { assetCost } from '@wildshard/sdk/assets';
import type { AuthorGraph as GraphIr } from '@wildshard/sdk/bake/materialGraph';
import { kindGraph } from './architectureGraphs';
import { KIT_KINDS } from './kitKinds';

/**
 * G5: each split kind's graph (kitKinds.ts) ships as a material file, as the held graphs do (heldGraphFiles.ts): the
 * declaration's admission walks its JSON before the SDK lowers inline graphs, and one more 10,900-node kit graph inline put
 * Nine past the 100,000-node bound. Their texture params are all lent, so the files depend on nothing.
 */

/** every split kind's graph by its look id */
export function kitKindGraphs(): Readonly<Record<string, GraphIr>> { return Object.fromEntries(KIT_KINDS.map(row => [row.look, kindGraph(row.kind)])); }

interface KitKindFile {
  readonly look: string;
  readonly bytes: Uint8Array;
  readonly material: { readonly family: 'graph'; readonly file: string };
  readonly file: ReturnType<typeof assetCost> & { readonly hash: string; readonly kind: 'json'; readonly compressed: number; readonly dependencies: readonly string[]; readonly critical: boolean };
}
let built: readonly KitKindFile[] | undefined;
/** each split kind's graph file, its catalogue entry and its files row (one build per process) */
export function kitKindFiles(): readonly KitKindFile[] {
  built ??= KIT_KINDS.map(row => {
    const bytes = new TextEncoder().encode(JSON.stringify(kindGraph(row.kind))), hash = hashImmutableBytes(bytes);
    return { look: row.look, bytes, material: { family: 'graph', file: hash }, file: { hash, kind: 'json', compressed: bytes.length, ...assetCost('json', bytes), dependencies: [], critical: false } };
  });
  return built;
}
