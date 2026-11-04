import { inputs } from './nine-product-inputs';
import aim from '../../src/shards/nine-dragon-stack/data/grapple.json' with { type: 'json' };
import bursts from '../../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };
import filament from '../../src/shards/nine-dragon-stack/data/filament.json' with { type: 'json' };
import light from '../../src/shards/nine-dragon-stack/data/light.json' with { type: 'json' };
import vm from '../../src/shards/nine-dragon-stack/data/viewmodelUniforms.json' with { type: 'json' };
import { filamentGeometry } from '../../src/shards/nine-dragon-stack/generators/filamentGeometry';
import { parseBurstFields, parseFilamentRows, parseHaloState } from '../../src/shards/nine-dragon-stack/generators/sections';
import { heldView } from '../../src/shards/nine-dragon-stack/generators/heldView';
import { postRows } from '../../src/shards/nine-dragon-stack/generators/postGraphs';
import { postGraphRow } from '../../src/shards/nine-dragon-stack/generators/composite';
import { NINE_FRAME_CHANNELS, NINE_FRAME_GROUP } from '../../src/shards/nine-dragon-stack/generators/frameChannels';

/** Entry fixtures lend the complete authored document at the same named-file
 * boundary as the producer, including the native view and post contracts. */
export function nineHeldPresentationBytes(): Uint8Array {
  const row = { portraitFov: 78,
    aim: { ...aim, ribbon: filamentGeometry(aim.ropePoints), filament: parseFilamentRows(filament), filamentState: parseHaloState(light.haloState) },
    bursts: parseBurstFields(bursts), view: heldView(inputs.held),
    look: { vm, post: { ...postGraphRow(postRows()), channels: { group: NINE_FRAME_GROUP, programs: NINE_FRAME_CHANNELS } } } };
  return new TextEncoder().encode(JSON.stringify(row, (_key, value: unknown) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value));
}
