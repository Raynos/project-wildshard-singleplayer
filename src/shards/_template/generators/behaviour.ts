import * as v from 'valibot';
import { ShardHashSchema, ShardNaturalSchema } from '@wildshard/format/shardSections';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

const module = v.strictObject({ hash: ShardHashSchema, compressed: ShardNaturalSchema });
export const TemplateBehaviourSchema = v.strictObject({ door: module, items: module, idle: module });
export type TemplateBehaviour = v.InferOutput<typeof TemplateBehaviourSchema>;
export const TEMPLATE_BEHAVIOUR_INPUTS = ['behaviour/door.as', 'behaviour/items.as', 'behaviour/idle.as'] as const;

/** Compile the original sources in original order with the SAME portable compiler and page bounds. */
export async function compileTemplateBehaviour(compiler: Pick<ProjectGenerationContext, 'compileScript'>, inputs: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>(), modules = new Map<string, { hash: string; compressed: number }>();
  for (const [name, pages] of [['door', 2], ['items', 64], ['idle', 2]] as const) {
    const text = inputs.get(`behaviour/${name}.as`); if (text === undefined) throw new Error('Missing Template behaviour source');
    const bytes = await compiler.compileScript(new TextDecoder('utf-8', { fatal: true }).decode(text), { maximumPages: pages });
    const hash = hashImmutableBytes(bytes); modules.set(name, { hash, compressed: bytes.length }); files.set(hash, bytes);
  }
  const metadata = v.parse(TemplateBehaviourSchema, Object.fromEntries(modules));
  files.set('behaviour.json', new TextEncoder().encode(JSON.stringify(metadata))); return files;
}
/** Read explicit source inputs even on a hit and publish only verified, detached compiled modules. */
export async function templateBehaviour(ctx: ProjectGenerationContext): Promise<TemplateBehaviour> {
  const files = await ctx.cached({ id: 'behaviour', inputs: TEMPLATE_BEHAVIOUR_INPUTS }, inputs => compileTemplateBehaviour(ctx, inputs));
  const json = files.get('behaviour.json'); if (json === undefined) throw new Error('Missing Template behaviour metadata');
  const metadata = v.parse(TemplateBehaviourSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json)));
  for (const row of Object.values(metadata)) {
    const bytes = files.get(row.hash);
    if (bytes === undefined || bytes.length !== row.compressed || ctx.asset(bytes) !== row.hash) throw new Error('Template behaviour byte identity differs');
  }
  return metadata;
}
