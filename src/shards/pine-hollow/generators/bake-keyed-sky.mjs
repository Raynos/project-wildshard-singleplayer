// Pack the shipped gain-map pairs at build; no browser load-time pixel walk. GR8 G29: `pineKeyedSky` gives the keyed sky
// rows (with each key's packed file, size and horizon) and the packed key bytes by product name; output.ts names them in
// memory (no scheduler job, no stored files under assets/).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { encodeGainKey, packGainKey } from '../../../../scripts/bake/keyed-sky.mjs';
import sky from '../data/sky.json' with { type: 'json' };

const sharp = createRequire(new URL('../../../sdk/package.json', import.meta.url))('sharp');
const root = new URL('../../../../', import.meta.url);

async function bakeKeyedSky() {
  const packedKeys = {}, blobs = [];
  for (const [name, key] of Object.entries(sky.keys)) {
    const decode = template => sharp(readFileSync(new URL(`public${template.replaceAll('{id}', key.id)}`, root))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [color, gain] = await Promise.all([decode(sky.keyFiles.color), decode(sky.keyFiles.gain)]);
    const { width, height } = color.info;
    if (width !== gain.info.width || height !== gain.info.height) throw new Error(`Sky plane sizes differ: ${name}`);
    const { data, horizon } = packGainKey(color.data, gain.data, width, height), file = `look/sky/${name}.bin`;
    blobs.push([file, encodeGainKey(data)]);
    packedKeys[name] = { file, width, height, horizon };
  }
  return { rows: { ...sky, packedKeys }, blobs };
}

let keyed;
/** The keyed sky rows and packed key bytes, built once per process. */
export function pineKeyedSky() {
  keyed ??= bakeKeyedSky();
  return keyed;
}
