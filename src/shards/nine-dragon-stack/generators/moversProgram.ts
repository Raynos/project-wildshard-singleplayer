import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

export interface NineMoversProgram { readonly hash: string; readonly compressed: number }

/** The original fixed-page view compiler and IO bounds, with source bytes supplied by the caller. */
export async function compileNineMovers(compiler: Pick<ProjectGenerationContext, 'compileScriptV2'>,
  inputs: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>> {
  const source = inputs.get('behaviour/movers.as');
  if (source === undefined) throw new Error('Missing Nine movers source');
  const bytes = await compiler.compileScriptV2(new TextDecoder('utf-8', { fatal: true }).decode(source), { lane: 'view', ioBytes: 4096 });
  return new Map([['movers.wasm', bytes]]);
}

/** Publish the exact compiled module; no generated metadata crosses the source boundary. */
export async function nineMoversProgram(ctx: ProjectGenerationContext): Promise<NineMoversProgram> {
  const files = await ctx.cached({ id: 'movers-view', inputs: ['behaviour/movers.as'] }, inputs => compileNineMovers(ctx, inputs));
  const bytes = files.get('movers.wasm');
  if (bytes === undefined) throw new Error('Missing compiled Nine movers');
  const hash = hashImmutableBytes(bytes);
  if (ctx.asset(bytes) !== hash) throw new Error('Nine movers byte identity differs');
  return { hash, compressed: bytes.length };
}
