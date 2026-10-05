// Types for stress.js (SF59 step 6, G169's bench fixtures), so the vitest suite can admit them.
import type { GraphIr } from '../../src/engine/core/materialGraph';

/** B, the pastel alien plain, as a lit material graph (`nonce`: the bench's cold-compile constant on the emissive) */
export function pastelGraph(nonce?: number): GraphIr;
/** C, the ink / cel valley, as a lit material graph */
export function inkGraph(nonce?: number): GraphIr;
/** the IR ops a graph uses, sorted */
export function opsOf(graph: GraphIr): string[];
