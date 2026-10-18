import { readFileSync } from 'node:fs';

/** Read an immutable author payload for native byte-comparison fixtures. */
export function fixtureBytes(file: URL): Uint8Array { return new Uint8Array(readFileSync(file)); }
