import { SKY_CLIENT_PLAN } from './clientPlan';
import { skyPaintedPresentation, SKY_PAINTED_ATTRIBUTE_SOURCES } from './paintedLook';
import { FAN_ID } from './rows/items';
import { skyWorldSceneValues, readMillSceneValues, type SkyWorldSceneValues } from './worldScenes';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import STRINGS from '../data/strings.json' with { type: 'json' };
import { SKY_PAGE_PROGRAM } from './rows/population';
import { SKY_GUST_TARGETS } from './gustTargets';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { ROC_DECISION, ROC_MOVES, ROC_WORLD_TARGETS } from './rows/rocDecision';
import { ROC_STRIKES } from './rows/brains';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { SKY_NATIVE_WORLD } from './rows/nativeWorld';
import { skyPhysics } from './physics';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { preparedModelProgram } from './preparedModelProgram';
import { skyHeroSource, skyBakeSource, skyModelSource } from './sceneSources';
import { skyWorldPieceProgram } from './worldPieceProgram';
import { BAKED_PIECES } from './fileInventory';
import { skyWorldTileProgram } from './worldTileProgram';
import { SKY_WORLD_TILE_ROWS } from './worldTileRows';
import { skyBridgeRestProgram } from './bridgeRestProgram';
import { skyMillRestProgram } from './millRestProgram';
import { skyFanPoolProgram } from './fanPoolProgram';
import { skySwardAtlasProgram } from './swardAtlasProgram';
import { SWARD_ATLAS_FILE } from './rows/swardAtlas';
import { skyCreatureRigOutput } from './creatureRigOutput';
import { skyRigAssetSources } from './rigAssetSources';
import { skyRigLibrary } from './rigLibrary';
import { GPU_FILES } from '../ktx2.generated';
import { skyMillSceneProgram } from './millSceneProgram';
import { skyStaticSceneProgram } from './staticSceneProgram';
import { readSkyStaticSceneEnvelope } from './staticSceneIntake';

type SectionName = Parameters<Parameters<typeof emitPlatformSections>[0]['get']>[0];
/** Build-only declarations; the compiled client features own all presentation. */
// Match the retained writer's JSON transport, including omitted optional fields.
const physicsJson = JSON.stringify(skyPhysics());
const baked: unknown = JSON.parse(physicsJson);
export interface SkySourceOutput {
  readonly blobs: typeof SKY_PAINTED_ATTRIBUTE_SOURCES;
  readonly namedFiles: ReturnType<typeof emitNamedBlobs>['files'];
  readonly assets: ReturnType<typeof emitNamedBlobs>['assets'];
  readonly platform: ReturnType<typeof emitPlatformSections>;
}
/** Build every output from explicit admitted scene values; no offline handoff is imported. */
export function skyOutputValues(scenes: SkyWorldSceneValues): SkySourceOutput {
  const sources = emitNamedBlobs(scenes.blobs);
  return { blobs:SKY_PAINTED_ATTRIBUTE_SOURCES,namedFiles: sources.files, assets: sources.assets,
  platform: emitPlatformSections(new Map<SectionName, unknown>([
    ['ui/strings', STRINGS],
    ['client/plan', SKY_CLIENT_PLAN],
    ['look/painted', skyPaintedPresentation()],
    ['explore/catalogue', {"version": 1, "entries": [{"kind": "held", "item": FAN_ID}, {"kind": "scene", "part": "specimen-mill.root"}, {"kind": "scene", "part": "specimen-bridge.root"}, {"kind": "scene", "part": "specimen-vane.root"}, {"kind": "rigs", "library": "sky"}, {"kind": "npc", "npc": "far.keeper"}]}],
    ['world/scenes', scenes.scenes],
    ['actors/species-programs', { page: SKY_PAGE_PROGRAM.species.page.map(({ body: _body, brain: _brain, ...row }) => row), native: [], program: SKY_PAGE_PROGRAM.species.program }],
    ['sim/runtime-plan', { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked }],
    ['sim/scripts', ROC_DECISION], ['actors/moves', ROC_MOVES], ['actors/strikes', ROC_STRIKES], ['world/targets', { targets: SKY_GUST_TARGETS, spots: ROC_WORLD_TARGETS.spots }],
  ])),
} satisfies ProjectOutput;
}

/** Publish original prepared geometry, world pieces and island tiles through normal owned-asset admission. */
export async function prepareOutput(ctx: ProjectGenerationContext): Promise<SkySourceOutput> {
  const millScenes = await skyMillSceneProgram(ctx), staticScenes = await skyStaticSceneProgram(ctx);
  const millWire = millScenes.get('mill-scene.json'), staticWire = staticScenes.get('static-scenes.json');
  if (millWire === undefined || staticWire === undefined) throw new Error('Missing owned scene hierarchy');
  const sceneValues = skyWorldSceneValues(readMillSceneValues(millWire), readSkyStaticSceneEnvelope(staticWire));
  const prepared = skyOutputValues(sceneValues);
  const rigs = await skyCreatureRigOutput(ctx);
  const rigSources = skyRigAssetSources(rigs.files, GPU_FILES);
  const name = 'world/geometry/prepared-models.glb';
  const geometry = nameBlob(name, 'glb', await preparedModelProgram(ctx)), hero = skyHeroSource(name);
  const pieces = await skyWorldPieceProgram(ctx);
  const world = BAKED_PIECES.map(piece => {
    const bytes = pieces.get(`baked/${piece}.glb`);
    if (bytes === undefined) throw new Error('Missing owned world piece');
    return nameBlob(`world/geometry/pieces/${piece}.glb`, 'glb', bytes);
  });
  const bakes = skyBakeSource(Object.fromEntries(BAKED_PIECES.map(piece => [piece, `world/geometry/pieces/${piece}.glb`])));
  const bridgeFiles = await skyBridgeRestProgram(ctx), bridgeBytes = bridgeFiles.get('bridge-rest.glb');
  if (bridgeBytes === undefined) throw new Error('Missing owned bridge geometry');
  const bridgeName = 'world/geometry/bridge-rest.glb', bridge = nameBlob(bridgeName, 'glb', bridgeBytes);
  const millFiles = await skyMillRestProgram(ctx), millBytes = millFiles.get('mill-rest.glb');
  if (millBytes === undefined) throw new Error('Missing owned mill geometry');
  const millName = 'world/geometry/mill-rest.glb', mill = nameBlob(millName, 'glb', millBytes);
  const fanName = 'world/geometry/fan.glb', fan = nameBlob(fanName, 'glb', await skyFanPoolProgram(ctx));
  const assets = new Map([...prepared.assets, ...rigs.assets]), replacements = [hero, bakes,
    skyModelSource(bridgeName, millName, fanName, skyRigLibrary(rigSources.urls))];
  for (const replacement of replacements) {
    const previous = prepared.namedFiles.find(file => file.name === replacement.file.name);
    if (previous === undefined) throw new Error('Missing original scene source output');
    assets.delete(previous.hash); assets.set(replacement.file.hash, replacement.bytes);
  }
  for (const blob of [geometry, ...world, bridge, mill, fan]) assets.set(blob.file.hash, blob.bytes);
  assets.set(SWARD_ATLAS_FILE.hash, await skySwardAtlasProgram(ctx));
  const tiles = await skyWorldTileProgram(ctx);
  if (tiles.size !== SKY_WORLD_TILE_ROWS.files.length + 1) throw new Error('Sky world tile publication inventory differs');
  for (const file of SKY_WORLD_TILE_ROWS.files) {
    const bytes = tiles.get(`assets/${file.hash}`);
    if (bytes === undefined) throw new Error('Sky world tile publication misses a declared asset');
    assets.set(file.hash, bytes);
  }
  return { ...prepared, namedFiles: [...prepared.namedFiles.map(file => replacements.find(row => row.file.name === file.name)?.file ?? file),
    geometry.file, ...world.map(blob => blob.file), bridge.file, mill.file, fan.file, ...rigs.files], assets };
}
