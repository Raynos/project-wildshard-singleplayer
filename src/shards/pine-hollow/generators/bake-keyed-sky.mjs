// Pack the shipped gain-map pairs at build; no browser load-time pixel walk.
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { namedBlobOutput } from '../../../../scripts/named-blob-output.mjs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { encodeGainKey, packGainKey } from '../../../../scripts/bake/keyed-sky.mjs';
import sky from '../data/sky.json' with { type: 'json' };

const sharp = createRequire(new URL('../../../sdk/package.json', import.meta.url))('sharp');
const project = new URL('../', import.meta.url), root = new URL('../../../../', import.meta.url);
const blobs = namedBlobOutput(project, 'keyed sky', 'assets/sky-keys');
const packedKeys = {};
for (const [name, key] of Object.entries(sky.keys)) {
  const decode = template => sharp(readFileSync(new URL(`public${template.replaceAll('{id}', key.id)}`, root))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [color, gain] = await Promise.all([decode(sky.keyFiles.color), decode(sky.keyFiles.gain)]);
  const { width, height } = color.info;
  if (width !== gain.info.width || height !== gain.info.height) throw new Error(`Sky plane sizes differ: ${name}`);
  const { data, horizon } = packGainKey(color.data, gain.data, width, height);
  const file = blobs.add(`look/sky/${name}.bin`, 'bin', encodeGainKey(data));
  packedKeys[name] = { file, width, height, horizon };
}
blobs.finish(new URL('data/skyKeyBlobs.generated.json', project));
const writer = byteWriter(process.argv.includes('--check'), 'keyed sky rows');
writer.put(fileURLToPath(new URL('data/keyedSky.generated.json', project)), jsonBytes({ ...sky, packedKeys }));
writer.finish();
