import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';

/** The phone birds GPU GLB as bake-ktx2 encodes it (G738 FAR_GLBS: its colour atlas is ETC1S, I4). */
export const PHONE_BIRDS_INPUTS: readonly string[] = ['/assets/gpu/pine-hollow/life/birds.phone-8f6a9e72.glb'];
const file = 'birds.phone.base.ktx2';

const layout = (): Error => new Error('Phone birds GLB layout differs');
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** `value[key]` of a JSON object, else a layout error. */
function field(value: unknown, key: string): unknown { if (!isRecord(value)) throw layout(); return value[key]; }
/** `value[at]` of a JSON array, else a layout error. */
function item(value: unknown, at: unknown): unknown {
  if (!Array.isArray(value) || typeof at !== 'number') throw layout();
  const list: readonly unknown[] = value; return list[at];
}
function count(value: unknown, fallback?: number): number {
  const out = value === undefined ? fallback : value; if (typeof out !== 'number' || !Number.isSafeInteger(out) || out < 0) throw layout(); return out;
}

/** The KTX2 bytes of a GLB's first material's base colour map (embedded, KHR_texture_basisu). */
function baseColourKtx2(glb: Uint8Array): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength), length = view.getUint32(12, true);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(24 + length, true) !== 0x004e4942) throw new Error('Phone birds GLB layout differs');
  const doc: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(glb.subarray(20, 20 + length)));
  const bin = glb.subarray(28 + length);
  const colour = field(field(field(item(field(doc, 'materials'), 0), 'pbrMetallicRoughness'), 'baseColorTexture'), 'index');
  const source = field(field(field(item(field(doc, 'textures'), colour), 'extensions'), 'KHR_texture_basisu'), 'source');
  const image = item(field(doc, 'images'), source);
  if (field(image, 'mimeType') !== 'image/ktx2') throw new Error('Phone birds atlas is not a KTX2 bake');
  const range = item(field(doc, 'bufferViews'), field(image, 'bufferView'));
  const offset = count(field(range, 'byteOffset'), 0), size = count(field(range, 'byteLength'));
  if (offset + size > bin.byteLength) throw new Error('Phone birds atlas is missing');
  return bin.slice(offset, offset + size);
}

/** The phone birds atlas as an owned-byte build output: read from the tracked GPU GLB at product build, never a
 *  generated blob under src (GR0). */
export async function phoneBirdsAtlasOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await ctx.cached({ id: 'phone-birds-atlas', inputs: PHONE_BIRDS_INPUTS }, inputs => {
    const glb = inputs.get(PHONE_BIRDS_INPUTS[0] ?? '');
    if (inputs.size !== 1 || glb === undefined) throw new Error('Phone birds input inventory differs');
    return new Map([[file, baseColourKtx2(glb)]]);
  });
  const bytes = files.get(file);
  if (files.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error('Phone birds atlas cache inventory differs');
  return emitNamedBlobs([nameBlob('models/life/birds.phone.base.ktx2', 'ktx2', bytes, { tier: 'phone' })]);
}
