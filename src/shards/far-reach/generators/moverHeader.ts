import { parseMoverRows, type MoverData } from '@wildshard/sdk/movers';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

export const SKY_MOVER_HEADER_INPUT = 'data/movers.generated.json';

/** The plain committed native header is a build input, never a static JSON module or a generated fallback. */
export function skyMoverRows(bytes: Uint8Array): MoverData {
  if (bytes.byteLength !== 70_074 || hashImmutableBytes(bytes) !== '8237cf04e9739b78217f521e9c9b8b2d4ade7cfacabbb65fc49b91cb63955398') throw new Error('Sky mover header identity differs');
  const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  return parseMoverRows(rows);
}

/** Source identity and exact tracked header bytes key the existing detached cache. */
export async function skyMoverProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<MoverData> {
  const files = await ctx.cached({ id: 'native-mover-header', inputs: [SKY_MOVER_HEADER_INPUT] }, inputs => {
    const bytes = inputs.get(SKY_MOVER_HEADER_INPUT);
    if (inputs.size !== 1 || bytes === undefined) throw new Error('Sky mover header input inventory differs');
    skyMoverRows(bytes);
    return Promise.resolve(new Map([['movers.json', Uint8Array.from(bytes)]]));
  });
  const bytes = files.get('movers.json');
  if (files.size !== 1 || bytes === undefined) throw new Error('Sky mover header cache inventory differs');
  return skyMoverRows(bytes);
}
