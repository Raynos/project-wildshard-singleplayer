// oxlint-disable-next-line import/no-nodejs-modules -- Original scene fixtures read only tracked native models.
import { readFileSync } from 'node:fs';
import { millSceneValues } from '../../src/shards/far-reach/generators/millScene';
import { skyStaticSceneBytes } from '../../src/shards/far-reach/generators/staticScene';
import { readSkyStaticSceneEnvelope } from '../../src/shards/far-reach/generators/staticSceneIntake';
import { skyWorldSceneValues, type SkyWorldSceneValues } from '../../src/shards/far-reach/generators/worldScenes';
import { skyOutputValues, type SkySourceOutput } from '../../src/shards/far-reach/generators/sourceOutput';
import { skyRouteValues, type SkyRouteValues } from '../../src/shards/far-reach/generators/routeScene';

/** Every call constructs fresh original rows from the same explicitly named native models. */
export async function originalSkySceneInputs(): Promise<{
  readonly mill: Awaited<ReturnType<typeof millSceneValues>>['MILL_SCENE'];
  readonly staticScenes: ReturnType<typeof readSkyStaticSceneEnvelope>;
  readonly routes: SkyRouteValues;
}> {
  const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
  return { mill: (await millSceneValues(read)).MILL_SCENE,
    staticScenes: readSkyStaticSceneEnvelope(await skyStaticSceneBytes(read)), routes: await skyRouteValues(read) };
}

/** Preserve the complete original world/file oracles without ignored metadata imports. */
export async function originalSkyScenes(): Promise<SkyWorldSceneValues> {
  const rows = await originalSkySceneInputs();
  return skyWorldSceneValues(rows.mill, rows.staticScenes, rows.routes);
}

/** The offline output fixture uses exactly the same explicit-value constructor as publication. */
export async function originalSkyOutput(): Promise<SkySourceOutput> {
  return skyOutputValues(await originalSkyScenes());
}
