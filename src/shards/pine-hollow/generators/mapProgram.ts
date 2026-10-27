import { rasterSceneMap } from '@wildshard/sdk/bake/groundMap';
import { pineMapFiles } from './mapAssembly.mjs';
import type { PineSources } from './pineSources';
import settings from '../data/map.json' with { type: 'json' };

/** GR8: the map's RGBA lattice from Pine's program sources: the map assembly (the pure producer of the retired
 *  pine-map-assembly job's files, aa975d28b2) painted with the autumn ground palette (the retired pine-data-map job's
 *  pixels). The SDK publishes it as `ui/images/map` and the public alias. */
export async function pineMapPixels(sources: PineSources): Promise<Uint8Array> {
  const files = await pineMapFiles(sources);
  const read = (file: string): Uint8Array => {
    const bytes = files.get(file);
    if (bytes === undefined) throw new Error(`Undeclared Pine map input ${file}`);
    return bytes;
  };
  const json = (file: string): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(file)));
  const { pixels } = await rasterSceneMap(settings, { input: read, bytes: read, json });
  if (pixels.byteLength !== 1000 * 1000 * 4) throw new Error('Pine map lattice size differs');
  return pixels;
}
