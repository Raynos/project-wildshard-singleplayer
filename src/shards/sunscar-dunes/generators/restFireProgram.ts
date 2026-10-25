import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { fireRest } from './restScene';

const name = 'geometry/rest/fire.glb';
function readParts(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 128) throw new Error('Invalid rest-fire parts');
  const parts = value.map((part: unknown) => {
    if (typeof part !== 'string' || !/^[a-z0-9-]+$/u.test(part)) throw new Error('Invalid rest-fire part');
    return part;
  });
  if (new Set(parts).size !== parts.length) throw new Error('Duplicate rest-fire parts');
  return parts;
}

/** The original portable fire geometry and its actual named parts, without publishing a public handoff. */
export async function signalRestFire(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<{ blob: NamedBlob; pool: { url: string; parts: string[] } }> {
  const files = await ctx.cached({ id: 'rest-fire' }, inputs => {
    if (inputs.size > 0) throw new Error('Unexpected rest-fire input');
    const made = fireRest(), parts = made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []);
    return new Map([['fire.glb', made.glb], ['parts.json', new TextEncoder().encode(JSON.stringify(parts))]]);
  });
  const bytes = files.get('fire.glb'), document = files.get('parts.json');
  if (files.size !== 2 || bytes === undefined || bytes.byteLength === 0 || document === undefined || document.byteLength > 4096) throw new Error('Rest-fire cache inventory differs');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(document));
  const parts = readParts(value), blob = nameBlob(name, 'glb', bytes);
  if (ctx.asset(blob.bytes) !== blob.file.hash) throw new Error('Rest-fire publication differs');
  return { blob, pool: { url: name, parts } };
}
