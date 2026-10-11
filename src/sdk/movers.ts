import { parseMovers } from '@wildshard/format/movers';

/** Typed numeric mover declarations: local collider primitives and admitted fixed-step scripts. */
export type MoverData = ReturnType<typeof parseMovers>;
/** Validate identity, primitive limits and numeric data before an author product constructs physics. */
export function movers(data: unknown): MoverData { return parseMovers(data); }
