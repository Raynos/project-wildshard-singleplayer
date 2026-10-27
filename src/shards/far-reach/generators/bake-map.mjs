import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { skyMapWorldSources } from './mapWorldSources.ts';
import { PREPARED_MODEL_INPUTS, preparedModelSource } from './preparedModelProgram.ts';
import { BRIDGE_REST_INPUTS, skyBridgeRestSource } from './bridgeRestProgram.ts';
import { MILL_REST_INPUTS, skyMillRestSource } from './millRestProgram.ts';
import { STATIC_SCENE_INPUTS, skyStaticSceneSource } from './staticSceneProgram.ts';
import { skyRouteSceneSource } from './routeSceneProgram.ts';
import { skyVaneSource, VANE_INPUTS } from './vaneProgram.ts';
import { restPoolGlbs } from './restScene.ts';
import { REST_URLS, ISLET_POOL } from './restFiles.ts';
import { isletGlb, isletScenes } from './isletScene.ts';
import { isletMotionRows } from './isletMotion.ts';
import { mapSceneRest } from '@wildshard/sdk/bake/mapRest';

/** The exact authored model bank; repeated roles share their original bytes. */
export const SKY_MAP_INPUTS = [...new Set([...PREPARED_MODEL_INPUTS, ...BRIDGE_REST_INPUTS, ...MILL_REST_INPUTS, ...VANE_INPUTS])];

/** Construct all map geometry and initial presentation without file or raster publication authority.
 * @param {ReadonlyMap<string, Uint8Array>} native
 * @returns {Promise<Map<string, Uint8Array>>} */
export async function skyMapSources(native) {
  if (native.size !== SKY_MAP_INPUTS.length || SKY_MAP_INPUTS.some(name => (native.get(name)?.byteLength ?? 0) === 0)) throw new Error('Sky map native input inventory differs');
  /** @param {string} name */
  const read = name => {
    const bytes = native.get(name); if (bytes === undefined) throw new Error(`Missing declared Sky map model ${name}`); return bytes;
  };
  const inputs = new Map(PREPARED_MODEL_INPUTS.map(url => [url,
    read(url)]));
  const sources = skyMapWorldSources(bytes => encodeBuildBytes(bytes, 'deflate', 9, 'native'));
  const staticInputs = new Map(STATIC_SCENE_INPUTS.map(url => {
    const bytes = inputs.get(url);
    if (bytes === undefined) throw new Error(`Missing owned map static model ${url}`);
    return [url, bytes];
  }));
  const staticScenes = (await skyStaticSceneSource(staticInputs)).get('static-scenes.json');
  if (staticScenes === undefined) throw new Error('Missing owned map static scenes');
  sources.set('owned-static-scenes.json', staticScenes);
  sources.set('prepared-models.glb', await preparedModelSource(inputs));
  const bridgeInputs = new Map(BRIDGE_REST_INPUTS.map(url => [url,
    read(url)]));
  const bridge = await skyBridgeRestSource(bridgeInputs);
  const routes = (await skyRouteSceneSource(bridgeInputs)).get('route-scenes.json');
  if (routes === undefined) throw new Error('Missing owned map route scenes');
  sources.set('owned-route-scenes.json', routes);
  const bridgeGeometry = bridge.get('bridge-rest.glb');
  if (bridgeGeometry === undefined) throw new Error('Missing owned map bridge inputs');
  sources.set('../../../public/assets/far-reach/baked/bridge-rest.glb', bridgeGeometry);
  const millInputs = new Map(MILL_REST_INPUTS.map(url => [url,
    read(url)]));
  const mill = await skyMillRestSource(millInputs), millGeometry = mill.get('mill-rest.glb');
  if (millGeometry === undefined) throw new Error('Missing owned map mill input');
  sources.set('../../../public/assets/far-reach/baked/mill-rest.glb', millGeometry);
  const vaneInputs = new Map(VANE_INPUTS.map(url => [url,
    read(url)]));
  for (const [file, bytes] of await skyVaneSource(vaneInputs)) {
    const part = file === 'vane-post.glb' ? 'post' : 'rotor';
    sources.set(`../../../public/assets/far-reach/models/wind-vane/${part}.glb`, bytes);
  }
  for (const [index, bytes] of restPoolGlbs().entries()) {
    const url = REST_URLS[index];
    if (url === undefined) throw new Error('Missing declared map rest pool');
    sources.set(`../../../public${url}`, bytes);
  }
  sources.set(`../../../public${ISLET_POOL.url}`, isletGlb());
  const islets = isletScenes(), motion = isletMotionRows();
  sources.set('data/isletScenes.generated.json', new TextEncoder().encode(`${JSON.stringify(islets)}\n`));
  sources.set('data/mapRest.generated.json', new TextEncoder().encode(`${JSON.stringify(mapSceneRest(islets.scene, motion.channels, motion.rest))}\n`));
  return sources;
}
