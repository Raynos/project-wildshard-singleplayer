/** Pack a rigged training dummy without changing its skin's metre-scale positions.
 *
 * node scripts/practice/pack_dummy.mjs /tmp/wood-rigged.glb public/assets/practice/dummies/wood-wood.glb
 *
 * The glTF-Transform meshopt CLI quantizes skinned POSITION into [-1, 1] here
 * without restoring the node scale. That puts half the dummy under the floor
 * and detaches its visible body from the arena hitboxes. Encode the float
 * accessors directly with EXT_meshopt_compression instead.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

async function main() {
  const [source, target] = process.argv.slice(2);
  if (source === undefined || target === undefined) throw new Error('Usage: node scripts/practice/pack_dummy.mjs <rigged.glb> <shipped.glb>');
  const scratch = mkdtempSync(path.join(tmpdir(), 'wildshard-dummy-'));
  try {
    const resized = path.join(scratch, 'resized.glb');
    execFileSync(path.resolve(import.meta.dirname, '../../node_modules/.bin/gltf-transform'), [
      'optimize', source, resized,
      '--compress', 'false', '--flatten', 'false', '--join', 'false',
      '--instance', 'false', '--simplify', 'false',
      '--texture-compress', 'webp', '--texture-size', '512',
    ], { stdio: 'inherit' });
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    const io = new NodeIO()
      .registerExtensions([EXTMeshoptCompression, EXTTextureWebP])
      .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    const document = await io.read(resized);
    document.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    await io.write(target, document);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
