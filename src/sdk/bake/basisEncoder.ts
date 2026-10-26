// oxlint-disable-next-line import/no-nodejs-modules -- Only the trusted host executes its verified native encoder.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fingerprint actual installed decoder binaries and shared libraries.
import { readdirSync, realpathSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed decoder from the trusted SDK, never an author path.
import { createRequire } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Package-relative names, not installation paths, enter the fingerprint.
import { dirname, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { compilerPackageInputs } from '../projectCompilerIdentity';
import { encodeCanonicalJson, hashImmutableBytes } from '../immutable';
import { readBoundedFile } from '../sourceReader';
import { readImagePixels, writeImagePixels } from './image';
import { bakeColourTexture } from './texture';
import { prepareBasisTool } from './basisTool';
import type { GlbBasisEncoder, GlbBasisImage } from './basisGlb';

/** Build-only capability; its identity covers actual encoder/decoder artifacts and executable recipe. */
export interface BasisEncoder { readonly identity: string; readonly encode: GlbBasisEncoder }
const text = new TextEncoder();
function decoderIdentity(): string {
  const require = createRequire(resolve(import.meta.dirname, 'basis-decoder.cjs')), entry = require.resolve('sharp');
  const installed = createRequire(entry), binaries = Object.keys(installed.cache).filter(path => /\/@img\/sharp-[^/]+\/lib\/sharp-[^/]+\.node$/u.test(path));
  const binary = binaries[0];
  if (binaries.length !== 1 || binary === undefined) throw new Error('Missing exact packaged Sharp decoder');
  const runtime = /\/@img\/sharp-([^/]+)\/lib\//u.exec(binary)?.[1];
  if (runtime === undefined) throw new Error('Unknown Sharp decoder host');
  const roots = [dirname(binary), dirname(installed.resolve(`@img/sharp-libvips-${runtime}/lib`))];
  const files: [string, string][] = [...compilerPackageInputs([{ name: 'sharp', from: entry }])];
  let total = 0, count = 0;
  for (const [index, root] of roots.entries()) {
    const base = realpathSync(root);
    const walk = (directory: string): void => {
      for (const row of readdirSync(directory, { withFileTypes: true })) {
        const path = realpathSync(resolve(directory, row.name));
        if (!path.startsWith(base + sep)) throw new Error('Sharp dependency escaped package');
        if (row.isDirectory()) walk(path);
        else {
          const bytes = readBoundedFile(path, 64_000_000); total += bytes.length;
          if (++count > 256 || total > 128_000_000) throw new Error('Sharp artifact identity exceeds cap');
          files.push([`native-${String(index)}/${relative(base, path).replaceAll('\\', '/')}`, hashImmutableBytes(bytes)]);
        }
      }
    };
    walk(base);
  }
  files.sort(([a], [b]) => a.localeCompare(b));
  return hashImmutableBytes(text.encode(encodeCanonicalJson({ files, versions: sharp.versions })));
}
async function encodeImage(image: GlbBasisImage, encoder: string): Promise<Uint8Array> {
  const decoded = await readImagePixels(new Uint8Array(image.bytes));
  if (decoded.width !== image.width || decoded.height !== image.height) throw new Error('Basis source dimensions differ');
  return bakeColourTexture(await writeImagePixels(decoded), encoder);
}
/** Supply the original native UASTC recipe without adding file/process/decoder imports to authored programs.
 * The checked host installs only pinned upstream sources. Corrupt artifacts and missing build tools refuse. */
export async function createBasisEncoder(): Promise<BasisEncoder> {
  const tool = await prepareBasisTool(), binary = hashImmutableBytes(readBoundedFile(tool.file, 64_000_000));
  const version = execFileSync(tool.file, ['-version'], { timeout: 10000, maxBuffer: 1_000_000 }).toString();
  if (!/v2\.50\.0\b/u.test(version)) throw new Error('Basis encoder version differs');
  const decoder = decoderIdentity();
  const identity = hashImmutableBytes(text.encode(encodeCanonicalJson({ tool: tool.identity, binary, version, decoder,
    recipe: [encodeImage.toString(), readImagePixels.toString(), writeImagePixels.toString(), bakeColourTexture.toString()] })));
  return { identity, encode: async image => {
    if (hashImmutableBytes(readBoundedFile(tool.file, 64_000_000)) !== binary || decoderIdentity() !== decoder) throw new Error('Basis encoder dependencies changed');
    const result = await encodeImage(image, tool.file);
    if (hashImmutableBytes(readBoundedFile(tool.file, 64_000_000)) !== binary) throw new Error('Basis executable changed during encode');
    return result;
  } };
}
