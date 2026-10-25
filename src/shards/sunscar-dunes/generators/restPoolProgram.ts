import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { fireRest, wellRest } from './restScene';
import type { ClientSceneBake } from '@wildshard/sdk/bake/glb';

function readParts(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 128) throw new Error('Invalid rest-pool parts');
  const parts = value.map((part: unknown) => {
    if (typeof part !== 'string' || !/^[a-z0-9-]+$/u.test(part)) throw new Error('Invalid rest-pool part');
    return part;
  });
  if (new Set(parts).size !== parts.length) throw new Error('Duplicate rest-pool parts');
  return parts;
}

/** Original portable rest geometry and actual part IDs, without publishing a public handoff. */
export const signalRestFire = (ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<{ blob: NamedBlob; pool: { url: string; parts: string[] } }> => restPool(ctx, 'fire', fireRest);
/** The existing rope, pail and jar bytes; live well motion still owns their transforms. */
export const signalRestWell = (ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<{ blob: NamedBlob; pool: { url: string; parts: string[] } }> => restPool(ctx, 'well', wellRest);

async function restPool(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>, id: 'fire' | 'well', bake: () => ClientSceneBake): Promise<{ blob: NamedBlob; pool: { url: string; parts: string[] } }> {
  const files = await ctx.cached({ id: `rest-${id}` }, inputs => {
    if (inputs.size > 0) throw new Error(`Unexpected rest-${id} input`);
    const made = bake(), parts = made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []);
    return new Map([[`${id}.glb`, made.glb], ['parts.json', new TextEncoder().encode(JSON.stringify(parts))]]);
  });
  const bytes = files.get(`${id}.glb`), document = files.get('parts.json');
  if (files.size !== 2 || bytes === undefined || bytes.byteLength === 0 || document === undefined || document.byteLength > 4096) throw new Error(`Rest-${id} cache inventory differs`);
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(document));
  const parts = readParts(value), name = `geometry/rest/${id}.glb`, blob = nameBlob(name, 'glb', bytes);
  if (ctx.asset(blob.bytes) !== blob.file.hash) throw new Error(`Rest-${id} publication differs`);
  return { blob, pool: { url: name, parts } };
}
