/** Pack a rigged training dummy without changing its skin's metre-scale positions.
 *
 * node scripts/practice/pack_dummy.cjs /tmp/wood-rigged.glb public/assets/practice/dummies/wood-wood.glb
 *
 * The glTF-Transform meshopt CLI quantizes skinned POSITION into [-1, 1] here
 * without restoring the node scale. That puts half the dummy under the floor
 * and detaches its visible body from the arena hitboxes. Encode the float
 * accessors directly with EXT_meshopt_compression instead.
 */
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const fromProject = createRequire(path.resolve(__dirname, '../../package.json'));
const { NodeIO } = fromProject('@gltf-transform/core');
const fromFunctions = createRequire(fromProject.resolve('@gltf-transform/functions'));
const { EXTMeshoptCompression, EXTTextureWebP } = fromFunctions('@gltf-transform/extensions');
const { MeshoptEncoder, MeshoptDecoder } = fromFunctions('meshoptimizer');

async function main() {
  const [source, target] = process.argv.slice(2);
  if (!source || !target) throw new Error('Usage: node scripts/practice/pack_dummy.cjs <rigged.glb> <shipped.glb>');
  const scratch = mkdtempSync(path.join(tmpdir(), 'wildshard-dummy-'));
  try {
    const resized = path.join(scratch, 'resized.glb');
    execFileSync(path.resolve(__dirname, '../../node_modules/.bin/gltf-transform'), [
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

main().catch((error) => { console.error(error); process.exitCode = 1; });
