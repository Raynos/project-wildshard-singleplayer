import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { bakeSignalRigSources } from './rigSources';
import { signalRigLibrary, type StriderBody } from './rows/rigLibrary';

const strider = 'assets/models/dune-strider.glb', manta = 'assets/models/dune-matriarch.glb';
const names = ['skitterer.glb', 'strider.glb', 'striderRig.json', 'ray.glb', 'matriarch.glb'] as const;

/** Cache the defining creature bake from explicit owned inputs; no output file is an input. */
export async function signalRigFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'creature-rigs', native: true, inputs: [strider, manta] }, inputs => {
    const striderBytes = inputs.get(strider), mantaBytes = inputs.get(manta);
    if (striderBytes === undefined || mantaBytes === undefined || inputs.size !== 2) throw new Error('Missing original creature models');
    return bakeSignalRigSources(striderBytes, mantaBytes);
  });
  if (files.size !== names.length || names.some(name => (files.get(name)?.length ?? 0) === 0)) throw new Error('Creature rig cache inventory differs');
  return files;
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function finite(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid creature dimension'); return value; }
function standIn(bytes: Uint8Array): StriderBody {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!record(value) || Object.keys(value).length !== 2 || !Array.isArray(value['bones']) || value['bones'].length === 0 || value['bones'].length > 256
    || !record(value['dims']) || Object.keys(value['dims']).length !== 6) throw new Error('Invalid creature skeleton');
  const dims = value['dims'];
  return { bones: value['bones'].map((bone: unknown) => {
    if (!record(bone) || Object.keys(bone).length !== 3 || typeof bone['name'] !== 'string' || bone['name'].length === 0 || bone['name'].length > 128
      || (bone['parent'] !== null && typeof bone['parent'] !== 'string') || !Array.isArray(bone['pos']) || bone['pos'].length !== 3) throw new Error('Invalid creature bone');
    return { name: bone['name'], parent: bone['parent'], pos: [finite(bone['pos'][0]), finite(bone['pos'][1]), finite(bone['pos'][2])] };
  }), dims: { bodyY: finite(dims['bodyY']), bodyHalfLen: finite(dims['bodyHalfLen']), bodyRadius: finite(dims['bodyRadius']),
    headRadius: finite(dims['headRadius']), legLen: finite(dims['legLen']), halfWidth: finite(dims['halfWidth']) } };
}

/** Admit the four original GLBs and the skeleton produced by the same cached bake. */
export async function signalRigs(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<{ blobs: readonly NamedBlob[]; library: ReturnType<typeof signalRigLibrary> }> {
  const files = await signalRigFiles(ctx);
  const need = (name: string): Uint8Array => { const bytes = files.get(name); if (bytes === undefined) throw new Error('Missing creature rig'); return bytes; };
  const blobs = ['skitterer', 'strider', 'ray', 'matriarch'].map(name => {
    const blob = nameBlob(`geometry/rigs/${name}.glb`, 'glb', need(`${name}.glb`));
    if (ctx.asset(blob.bytes) !== blob.file.hash) throw new Error('Creature rig publication differs');
    return blob;
  });
  const striderBody = standIn(need('striderRig.json'));
  return { blobs, library: signalRigLibrary({ skitterer: 'geometry/rigs/skitterer.glb', strider: 'geometry/rigs/strider.glb',
    ray: 'geometry/rigs/ray.glb', matriarch: 'geometry/rigs/matriarch.glb' }, striderBody) };
}
