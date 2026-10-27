import { readFileSync } from 'node:fs';
import { compileDecisionScripts } from '../../src/sdk/buildDecisionScripts';
import { NIGHT_SPAWN, nightRegistries } from '../../src/shards/pine-hollow/generators/nightSpawn';

// GR8: the product compiles the night guest (output.ts nightModule); tests compile the same source the same way.
const built = await compileDecisionScripts([NIGHT_SPAWN.script], nightRegistries(),
  new Map([['behaviour/night.as', readFileSync(new URL('../../src/shards/pine-hollow/behaviour/night.as', import.meta.url), 'utf8')]]), { asLineCeiling: 2130 });
const script = built.rows[0], blob = built.blobs[0];
if (script === undefined || blob === undefined) throw new Error('Missing compiled Pine night programme');
/** The night spawn rows with the compiled row and no bytes, as actors/spawn-scripts carries them. */
export const PINE_NIGHT = { ...NIGHT_SPAWN, script, bytes: '' };
/** The compiled night Wasm. */
export const PINE_NIGHT_MODULE: Uint8Array = blob.bytes;
