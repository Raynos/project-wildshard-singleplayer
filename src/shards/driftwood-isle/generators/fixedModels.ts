import { emitNamedBlobs, nameBlob, nameMeshoptBlob, type EmittedBlobs, type NamedBlob } from '@wildshard/sdk/blobs';
import { compactPhoneGlb } from '@wildshard/sdk/bake/compactGlb';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { FIXED_MODEL_NAMES } from './modelFiles';
import { driftwoodFixedFiles } from './fixedProgram';
import { GULL_DRAW } from './gullDraw';
import { FISH_DRAW } from './fishDraw';

/** The fixed models a posed library draws (`posedAssets`: one identity-space Float32 mesh, read as stored): never compacted. */
const POSED = new Set([GULL_DRAW, FISH_DRAW].flatMap(draw => [draw.tiers.phone.geometry, draw.tiers.desktop.geometry]));

/** Admit every original fixed draw with byte-derived costs as file intake does: 16-bit grid positions, 8-bit normals and
 *  colours (± meshopt) when that serves fewer bytes (iPhone downloads I3, `compactPhoneGlb`), else (and for a posed draw)
 *  the lossless meshopt selection. */
export async function driftwoodFixedModelOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await driftwoodFixedFiles(ctx), blobs: NamedBlob[] = [];
  for (const [url, name] of Object.entries(FIXED_MODEL_NAMES)) {
    const filename = url.slice(url.lastIndexOf('/') + 1), bytes = files.get(`baked/fixed-models/${filename}`);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing owned fixed model: ${name}`);
    const compact = POSED.has(name) ? bytes : await compactPhoneGlb(bytes);
    blobs.push(compact === bytes ? await nameMeshoptBlob(name, bytes) : nameBlob(name, 'glb', compact));
  }
  const output = emitNamedBlobs(blobs), assets = new Map(output.assets);
  // Coarse tile rows belong to the root declaration; their bytes have already
  // been constructed by this same cached producer, so a second bake is unnecessary.
  for (const [name, bytes] of files) if (name.startsWith('owned/coarse/')) {
    const hash = hashImmutableBytes(bytes);
    if (name !== `owned/coarse/${hash}.glb`) throw new Error('Driftwood coarse asset identity differs');
    assets.set(hash, bytes);
  }
  return { files: output.files, assets };
}
