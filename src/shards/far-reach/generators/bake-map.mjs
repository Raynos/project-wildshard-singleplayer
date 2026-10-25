import { readFileSync } from 'node:fs';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { PREPARED_MODEL_INPUTS, preparedModelSource } from './preparedModelProgram.ts';

// The registered sealed runner starts at its workspace root. Native model
// reads remain confined to the source program's explicit declared URL list.
const inputs = new Map(PREPARED_MODEL_INPUTS.map(url => [url,
  new Uint8Array(readFileSync(new URL(`../../../../public${url}`, import.meta.url)))]));
await paintDataMap(process.cwd(), 'far-reach', {
  sources: new Map([['prepared-models.glb', await preparedModelSource(inputs)]]),
});
