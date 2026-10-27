import { emitNamedBlobs, nameMeshoptBlob, type BlobOptions, type EmittedBlobs, type NamedBlob } from '@wildshard/sdk/blobs';
import { nameCompactBlob } from '@wildshard/sdk/bake/compactGlb';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { FIXED_MODEL_NAMES } from './modelFiles';
import { driftwoodFixedFiles } from './fixedProgram';
import { GULL_DRAW } from './gullDraw';
import { FISH_DRAW } from './fishDraw';

/** The fixed models a posed library draws (`posedAssets`: one identity-space Float32 mesh, read as stored), and the cargo
 *  the cargo bank also ships as scaled float copies (models/cargo/*, so a card reads one geometry at every size): never
 *  compacted. */
const EXACT = new Set([GULL_DRAW, FISH_DRAW].flatMap(draw => [draw.tiers.phone.geometry, draw.tiers.desktop.geometry]));
const exact = (name: string): boolean => EXACT.has(name) || name.startsWith('models/fixed/cargo-');

/** Admit every original fixed draw with byte-derived costs as file intake does: 16-bit grid positions, 8-bit normals and
 *  colours (± meshopt) when that serves fewer bytes (iPhone downloads I3, `compactPhoneGlb`), else (and for an exact draw
 *  above) the lossless meshopt selection. */
export async function driftwoodFixedModelOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await driftwoodFixedFiles(ctx), blobs: NamedBlob[] = [];
  for (const [url, name] of Object.entries(FIXED_MODEL_NAMES)) {
    const filename = url.slice(url.lastIndexOf('/') + 1), bytes = files.get(`baked/fixed-models/${filename}`);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing owned fixed model: ${name}`);
    // The entered fixed library reconstructs every slot from this producer's
    // L0 partitions and whole templates. Individual copies remain addressable
    // for Explorer and no-owner reads, but do not enter the phone play set.
    // Posed libraries read their own geometry independently of that assembly.
    const options: BlobOptions = EXACT.has(name) ? {} : { tier: 'desktop' };
    blobs.push(exact(name) ? await nameMeshoptBlob(name, bytes, options) : await nameCompactBlob(name, bytes, options));
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
