import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { BRIDGE_REST_INPUTS } from './bridgeRestProgram';
import { skyRouteValues } from './routeScene';

/** Original native deck input; route identities and all other rows come from the defining source. */
export const ROUTE_SCENE_INPUTS: readonly string[] = [...BRIDGE_REST_INPUTS];
/** One owned wire carries every original static route, kit and motion port. */
export const ROUTE_SCENE_FILES: readonly string[] = ['route-scenes.json'];

/** Compile the typed source producer directly, without invoking a publication script or CLI. */
export async function skyRouteSceneSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== ROUTE_SCENE_INPUTS.length || ROUTE_SCENE_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky route scene input inventory differs');
  }
  const rows = await skyRouteValues(name => {
    const input = inputs.get(name);
    if (input === undefined) throw new Error(`Missing declared Sky route model ${name}`);
    return input;
  });
  return new Map([['route-scenes.json', new TextEncoder().encode(`${JSON.stringify(rows)}\n`)]]);
}

/** Bind route bytes to their complete native input and bundled author-program identities. */
export async function skyRouteSceneProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'route-scenes', native: true, inputs: ROUTE_SCENE_INPUTS }, skyRouteSceneSource);
  if (files.size !== ROUTE_SCENE_FILES.length || ROUTE_SCENE_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Sky route scene cache inventory differs');
  }
  return files;
}
