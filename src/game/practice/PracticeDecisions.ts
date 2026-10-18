import { parseDecisionScripts } from '@wildshard/format/decisionScripts';
import type { Scope } from '@wildshard/engine/app/scope';
import { prepareDecisionMemories } from '@wildshard/engine/script/decisionModule';
import type { SpeciesDecisionAuthority } from '../plugin/brain';
import type { ShardProduct } from '../shardfile/shardProduct';
import { outputDescriptor } from '../shardfile/outputDescriptor';
import { borrowedDecisionAuthority, type BorrowedDecisionPorts } from '../shardfile/borrowedDecisions';

/** Load only the selected admitted guest. Each bout lends fresh local authorities to the same verified bytes. */
export async function preparePracticeDecision(product: ShardProduct, scriptId: string, owner: Scope): Promise<
  (ports: Omit<BorrowedDecisionPorts, 'flags'>) => SpeciesDecisionAuthority
> {
  const descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Practice decisions require a verified product');
  const script = parseDecisionScripts(descriptor.sections.get('sim/scripts')).find(row => row.id === scriptId);
  if (script?.side !== 'sim') throw new Error('Practice decision is not admitted');
  if (Object.keys(script.flags).length > 0 || script.on.includes('flag') || script.reads.includes('flag') || script.commands.includes('flag'))
    throw new Error('Practice decisions cannot own world flags');
  const hash = script.module.slice('blobs/wasm/'.length, -'.wasm'.length);
  const file = descriptor.index.files.find(row => row.hash === hash);
  if (file?.name === undefined) throw new Error('Practice module has no admitted logical file');
  const bytes = await product.file(file.name);
  await prepareDecisionMemories([script.pages], owner);
  if (owner.disposed) throw new Error('Practice decision owner closed during loading');
  const assets = new Map([[hash, bytes]]), sections = new Map(descriptor.sections);
  sections.set('sim/scripts', [script]);
  const noFlags = (): never => { throw new Error('Practice has no world flag authority'); };
  return ports => borrowedDecisionAuthority(product.shardfile, assets, sections, {
    ...ports, flags: { has: noFlags, set: noFlags, onChange: () => () => undefined },
  });
}
