import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import { CREATURE_RIG_FILES, skyCreatureRigProgram } from './creatureRigProgram';
import { CREATURE_PHONE_FILE, skyCreaturePhoneProgram } from './creaturePhoneProgram';

/** Admit the complete original bank and distinct phone Roc before any live URL reader adopts them. */
export async function skyCreatureRigOutput(ctx: Pick<ProjectGenerationContext, 'cached' | 'basisEncoder'>): Promise<EmittedBlobs> {
  const encoder = ctx.basisEncoder;
  if (encoder === undefined) throw new Error('Sky rig publication needs the checked Basis encoder');
  const phone = await skyCreaturePhoneProgram(ctx, await encoder());
  const rigs = await skyCreatureRigProgram(ctx);
  const files = [...CREATURE_RIG_FILES.map(name => [name, rigs.get(name)] as const),
    [CREATURE_PHONE_FILE, phone.get(CREATURE_PHONE_FILE)] as const];
  return emitNamedBlobs(files.map(([name, bytes]) => {
    if (bytes === undefined) throw new Error(`Missing source-owned Sky rig ${name}`);
    return nameBlob(`world/rigs/${name}`, 'glb', bytes);
  }));
}
