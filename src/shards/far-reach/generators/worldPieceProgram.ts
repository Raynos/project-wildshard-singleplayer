import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { SKY_PIECES } from './scene';
import { skyWorldPieceSource } from './worldPieceBytes';

/** Cache all ten original procedural pieces under their complete author-program identity. */
export async function skyWorldPieceProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'world-pieces', native: true, inputs: [] }, skyWorldPieceSource);
  if (files.size !== SKY_PIECES.length * 2) throw new Error('Sky world piece cache inventory differs');
  for (const piece of SKY_PIECES) {
    const binary = files.get(`baked/${piece.glb}.glb`), metadata = files.get(`data/${piece.rows}.json`);
    if (binary === undefined || binary.byteLength === 0 || metadata === undefined || metadata.byteLength === 0) {
      throw new Error('Sky world piece cache inventory differs');
    }
    const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
    if (typeof rows !== 'object' || rows === null || !('glb' in rows) || rows.glb !== hashImmutableBytes(binary)) {
      throw new Error('Sky world piece cache geometry identity differs');
    }
  }
  return files;
}
