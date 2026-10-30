// Pack the shipped gain-map pairs at build; no browser load-time pixel walk. GR8 G29: `pineKeyedSky` gives the keyed sky
// rows (with each key's packed file, size and horizon) and the packed key bytes by product name; output.ts names them in
// memory (no scheduler job, no stored files under assets/). D65: the key planes come from the program's sources and are
// decoded by the build context's image reader (no Sharp in the config bundle).
import { encodeGainKey, packGainKey } from '@wildshard/sdk/bake/keyedSky';
import sky from '../data/sky.json' with { type: 'json' };
import { skyKeySource } from './pineSources.ts';

/** The keyed sky rows and packed key bytes; `readImagePixels` is the build context's decoder and `encode` its memoised
 *  gain-key gzip when it has one. */
export async function pineKeyedSky(sources, readImagePixels, encode = encodeGainKey) {
  const packedKeys = {}, blobs = [];
  for (const [name, key] of Object.entries(sky.keys)) {
    const decode = template => readImagePixels(sources.bytes(skyKeySource(template, key.id)));
    const [color, gain] = await Promise.all([decode(sky.keyFiles.color), decode(sky.keyFiles.gain)]);
    const { width, height } = color;
    if (width !== gain.width || height !== gain.height) throw new Error(`Sky plane sizes differ: ${name}`);
    const { data, horizon } = packGainKey(color.pixels, gain.pixels, width, height), file = `look/sky/${name}.bin`;
    blobs.push([file, encode(data)]);
    packedKeys[name] = { file, width, height, horizon };
  }
  return { rows: { ...sky, packedKeys }, blobs };
}

