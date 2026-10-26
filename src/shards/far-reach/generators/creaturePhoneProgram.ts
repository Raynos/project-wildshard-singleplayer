import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { basisGlbVariant, type GlbBasisEncoder } from '@wildshard/sdk/bake/basisGlb';
import { CREATURE_RIG_INPUTS, skyCreatureRigSource } from './creatureRigProgram';

/** The complete original phone representation has its own cache name, separate from the WebP rig bank. */
export const CREATURE_PHONE_FILE = 'storm-roc.phone.glb';
/** The trusted build adapter fingerprints its exact tool artifacts and recipe; config code receives only this port. */
export interface CreaturePhoneEncoder { readonly identity: string; readonly encode: GlbBasisEncoder }
function encoderPort(port: CreaturePhoneEncoder): CreaturePhoneEncoder {
  const { identity, encode } = port;
  if (!/^[a-f0-9]{64}$/u.test(identity) || typeof encode !== 'function') throw new Error('Sky phone encoder needs an exact tool/recipe identity');
  return { identity, encode };
}

/** Derive every geometry/skin/material byte from the original native bank and request only its owned Roc paint. */
export async function skyCreaturePhoneSource(inputs: ReadonlyMap<string, Uint8Array>, encoder: CreaturePhoneEncoder): Promise<Map<string, Uint8Array>> {
  const port = encoderPort(encoder), files = await skyCreatureRigSource(inputs), roc = files.get('storm-roc.glb');
  if (roc === undefined) throw new Error('Missing source-owned Roc rig');
  return new Map([[CREATURE_PHONE_FILE, await basisGlbVariant(roc, port.encode)]]);
}

/** Native inputs and the full author program retain the existing cache key; the encoder fingerprint is part of its id.
 * No build adapter is imported here. Missing sources still refuse on hits, before any cached variant is returned. */
export async function skyCreaturePhoneProgram(ctx: Pick<ProjectGenerationContext, 'cached'>, encoder: CreaturePhoneEncoder): Promise<ReadonlyMap<string, Uint8Array>> {
  const port = encoderPort(encoder);
  const files = await ctx.cached({ id: `phone-rig-${port.identity}`, native: true, inputs: CREATURE_RIG_INPUTS },
    inputs => skyCreaturePhoneSource(inputs, port));
  if (files.size !== 1 || (files.get(CREATURE_PHONE_FILE)?.byteLength ?? 0) === 0) throw new Error('Sky phone rig cache inventory differs');
  return files;
}
