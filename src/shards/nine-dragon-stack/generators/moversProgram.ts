import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { BlobOptions } from '@wildshard/sdk/blobs';

/** Nine's existing fixed-page ABI-2 view contract; SDK admission checks both revisions. */
export const NINE_MOVERS_CONTRACT = { abi: 2, lane: 'view', pages: 1, ioBytes: 4096, compilerRevision: 1, admissionRevision: 1 } as const satisfies NonNullable<BlobOptions['script']>;

export interface NineMoversProgram { readonly hash: string; readonly compressed: number; readonly bytes: Uint8Array }

/** The original fixed-page view compiler and IO bounds, with source bytes supplied by the caller. */
export async function compileNineMovers(compiler: Pick<ProjectGenerationContext, 'compileScriptV2'>,
  inputs: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>> {
  const source = inputs.get('behaviour/movers.as');
  if (source === undefined) throw new Error('Missing Nine movers source');
  const bytes = await compiler.compileScriptV2(new TextDecoder('utf-8', { fatal: true }).decode(source), { lane: NINE_MOVERS_CONTRACT.lane, ioBytes: NINE_MOVERS_CONTRACT.ioBytes });
  return new Map([['movers.wasm', bytes]]);
}

/** Publish the exact compiled module; no generated metadata crosses the source boundary. */
export async function nineMoversProgram(ctx: ProjectGenerationContext): Promise<NineMoversProgram> {
  const files = await ctx.cached({ id: 'movers-view', inputs: ['behaviour/movers.as'] }, inputs => compileNineMovers(ctx, inputs));
  const bytes = files.get('movers.wasm');
  if (bytes === undefined) throw new Error('Missing compiled Nine movers');
  const hash = hashImmutableBytes(bytes);
  if (ctx.asset(bytes) !== hash) throw new Error('Nine movers byte identity differs');
  return { hash, compressed: bytes.length, bytes };
}
