import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nalatiProductRows } from './product';
import { prepareSpecies } from './output';
import { nalatiRenderTileProgram } from './renderTileProgram';
import { nalatiQueryTerrainProgram } from './terrain';

/** Partial source construction retains the scheduler until the last producer retires. */
export async function build(ctx: ProjectGenerationContext): Promise<ReturnType<typeof nalatiProductRows>> {
  const species = await prepareSpecies(ctx);
  const render = await nalatiRenderTileProgram(ctx), metadata = render.get('data/renderTiles.json');
  if (metadata === undefined) throw new Error('Missing owned render metadata');
  for (const [name, bytes] of render) {
    if (!/^assets\/[a-f0-9]{64}$/u.test(name)) continue;
    if (ctx.asset(bytes) !== name.slice(7)) throw new Error('Owned render tile identity differs');
  }
  return nalatiProductRows(species.rows, {
    program: species.rows.program, stealthProgram: species.rows.program,
    compiledBytes: species.rows.compiled.bytes, projectionPages: species.rows.program.v2.artifact.pages,
  }, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata)) as unknown, await nalatiQueryTerrainProgram(ctx));
}
