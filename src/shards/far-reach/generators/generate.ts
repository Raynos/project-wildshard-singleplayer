import type { ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import { skyProductRows } from './product';
import { prepareOutput } from './sourceOutput';
import { skyProductBoot } from './bootInventory';
import { skyRigAssetSources } from './rigAssetSources';
import { GPU_FILES } from '../ktx2.generated';
import { skyMapPalette } from './fixedLayouts';
import { skyViewDiscovery } from './viewData';
import { skyNavigationProgram, type SkyNavigationRows } from './navigation';
import { skyMapProgram } from './mapProgram';
import { skyMoverProgram } from './moverHeader';

/** The texture baker's committed phone ASTC aliases (scripts/bake-astc6.mjs). */
const ASTC = 'data/astc6.generated.json';
function aliasRows(bytes: Uint8Array): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('ASTC aliases must be a table');
  const rows: Record<string, string> = {};
  for (const [url, alias] of Object.entries(parsed)) {
    if (typeof alias !== 'string') throw new Error(`ASTC alias ${url} must be a URL`);
    rows[url] = alias;
  }
  return rows;
}

async function phoneAliases(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Readonly<Record<string, string>>> {
  const files = await ctx.cached({ id: 'phone-astc6', inputs: [ASTC] }, inputs => {
    const aliases = inputs.get(ASTC);
    if (aliases === undefined) throw new Error('Missing declared Sky ASTC aliases');
    return new Map([['astc6.json', aliases]]);
  });
  const aliases = files.get('astc6.json');
  if (aliases === undefined || files.size !== 1) throw new Error('Missing cached Sky ASTC aliases');
  return aliasRows(aliases);
}

/** Publish declaration, native output and discovery from one source invocation. */
export async function generate(ctx: ProjectGenerationContext): Promise<{
  readonly shard: ReturnType<typeof skyProductRows>;
  readonly output: Awaited<ReturnType<typeof prepareOutput>>;
  readonly map: Awaited<ReturnType<typeof skyMapProgram>>;
  readonly discovery: ReturnType<typeof skyProductBoot> & ReturnType<typeof skyViewDiscovery> & { readonly mapPalette: ReturnType<typeof skyMapPalette>; readonly navigation: SkyNavigationRows };
}> {
  const navigation = await skyNavigationProgram(ctx), output = await prepareOutput(ctx);
  const geometry = output.namedFiles.find(file => file.name === 'world/geometry/prepared-models.glb');
  if (geometry === undefined) throw new Error('Missing owned prepared geometry for boot');
  return { shard: skyProductRows(navigation.rows, await skyMoverProgram(ctx)), output, map: await skyMapProgram(ctx), discovery: { ...skyProductBoot(skyRigAssetSources(output.namedFiles, { phone: { ...GPU_FILES.phone, ...await phoneAliases(ctx) }, desktop: GPU_FILES.desktop })), ...skyViewDiscovery(), mapPalette: skyMapPalette(), navigation: navigation.rows } };
}
