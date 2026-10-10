// The layout's ruled kit is the SDK's (@wildshard/sdk/kit/ruledKit, SHARD-PLATFORM M3, the kit system): this keeps the
// names the builders use, and the pattern kinds the Jiehua material draws (vPat.x).
import { EDGE, RuledKit, type RuledLook } from '@wildshard/sdk/kit/ruledKit';

/** pattern kinds the material draws (vPat.x) */
export const K = { plain: 0, facade: 1, tiles: 2, flag: 3, bars: 4, panel: 5, net: 6, leaf: 7, cloth: 8, stone: 9 } as const;
/** edge mask bits: which face borders get a ruled ink line */
export const E: typeof EDGE = EDGE;
/** the layout's ruled kit */
export class Kit extends RuledKit {}
/** how a ruled face looks */
export type Look = RuledLook;
