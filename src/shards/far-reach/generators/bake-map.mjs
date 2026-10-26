import { readFileSync } from 'node:fs';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { skyMapWorldSources } from './mapWorldSources.ts';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { PREPARED_MODEL_INPUTS, preparedModelSource } from './preparedModelProgram.ts';
import { BRIDGE_REST_INPUTS, skyBridgeRestSource } from './bridgeRestProgram.ts';

// The registered sealed runner starts at its workspace root. Native model
// reads remain confined to the source program's explicit declared URL list.
const inputs = new Map(PREPARED_MODEL_INPUTS.map(url => [url,
  new Uint8Array(readFileSync(new URL(`../../../../public${url}`, import.meta.url)))]));
const sources = skyMapWorldSources(bytes => encodeBuildBytes(bytes, 'deflate', 9, 'native'));
sources.set('prepared-models.glb', await preparedModelSource(inputs));
const bridgeInputs = new Map(BRIDGE_REST_INPUTS.map(url => [url,
  new Uint8Array(readFileSync(new URL(`../../../../public${url}`, import.meta.url)))]));
const bridge = await skyBridgeRestSource(bridgeInputs);
const bridgeGeometry = bridge.get('bridge-rest.glb');
if (bridgeGeometry === undefined) throw new Error('Missing owned map bridge inputs');
sources.set('../../../public/assets/far-reach/baked/bridge-rest.glb', bridgeGeometry);
await paintDataMap(process.cwd(), 'far-reach', { sources });
