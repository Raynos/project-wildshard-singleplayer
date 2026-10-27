import { nalatiAdmissionProgram } from './admissionProgram';
import { nalatiWeatherProgram } from './weatherProgram';
import { nalatiNavigationProgram } from './navigation';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nalatiProductRows } from './product';
import { prepareSpecies } from './output';
import { nalatiRenderTileProgram } from './renderTileProgram';
import { nalatiQueryTerrainProgram } from './terrain';
import { nalatiKokparProgram } from './kokparProgram';
import { nalatiRidingProgram } from './ridingProgram';
import { nalatiTitanProgram } from './stormTitanProgram';
import { nalatiChargeProgram } from './chargeProgram';

/** Owned source programs supply admitted binary charges; no inline executable decoding is needed. */
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
  }, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata)) as unknown, await nalatiQueryTerrainProgram(ctx), await nalatiNavigationProgram(ctx), (await nalatiKokparProgram(ctx)).rows, (await nalatiRidingProgram(ctx)).programs, (await nalatiTitanProgram(ctx)).programs, await nalatiWeatherProgram(ctx), (await nalatiAdmissionProgram(ctx)).program, (await nalatiChargeProgram(ctx)).rows, program => {
    if(program.bytes!=='')throw new Error('Nalati product requires file-owned program bytes');
    return 0;
  });
}
