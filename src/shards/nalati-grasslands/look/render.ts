/**
 * Nalati's look strategy (E357 S3.2, 07 §6.2; 01 §13.1): the painterly look the engine used to branch on
 * (`style === 'painterly'` in Game.ts, Terrain.ts and Grass.ts), declared as the manifest's `render`.
 *   compose         'replace': the whole chain — RenderPass → bloom (desktop) + the one grade (grade.ts `lookV2Passes`);
 *                   the composer's MSAA is the manifest's `msaa` tier knob (phone 2, desktop 4)
 *   engineKnobs     that chain as an engine chain's knobs, for a page shell drawing its grid cell (SF63)
 *   fog             the painted air (air.ts), then the panorama-coloured fog (fog.ts), slot 300, after the engine fog
 *   terrainPainter  the painted ground (terrainPainter.ts)
 *   grass           the GPU blade rings + shader flowers (grass.ts `GrassV2`)
 *   sky             no engine cloud layer or planet; the cloud shadows' field + drift (air.ts `NALATI_SKY`)
 * The panorama dome, the day keys and the per-frame look are still wired by `wireLookV2` (index.ts) until 07 §6.2 step 6.
 */
import type { LookStrategy, TerrainPainter } from '@wildshard/engine/render/look';
import { installPaintedAir, NALATI_SKY } from './air';
import { installLookV2Fog } from './fog';
import { lookV2EngineKnobs, lookV2Passes } from './grade';
import { createGrass } from './field';
import * as THREE from 'three';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { applyPaintedTerrain, bindPaintedTerrainBake } from '@wildshard/engine/render/families/paintedTerrain';
import { materialColourGraph } from '@wildshard/engine/render/graph/colourFunction';
import { parsePaintedTerrain } from '@wildshard/format/materialFamilies';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { createClientScene } from '@wildshard/game/plugin/ui';
import { bakeUniforms } from './capture';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
import { loadSpecimenTexture } from '@wildshard/game/models/specimenCatalogue';
import type { NalatiTexName } from './nalatiTextures';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import layoutRows from '../boot/layout.generated.json' with { type: 'json' };

const { SNOW_LINE, GLACIER } = layoutRows;
const SURFACE = parsePaintedTerrain({
  maps: { base: 'meadow', track: 'path', gravel: 'gravel', rock: 'rock', snow: 'snow' },
  metres: { base: paintedTextures.metres.meadow, track: paintedTextures.metres.path, gravel: paintedTextures.metres.gravel, rock: paintedTextures.metres.rock, snow: paintedTextures.metres.snow },
  means: { base: [...paintedTextures.mean.meadow], rock: [...paintedTextures.mean.rock] },
  snow: { line: SNOW_LINE, high: [44, 84] }, wet: [-9.2, -9.9],
  ice: { from: [GLACIER.x0, GLACIER.z0], to: [GLACIER.x1, GLACIER.z1], half: GLACIER.half },
});
const LAYERS = ['meadow', 'path', 'gravel', 'rock', 'snow'] as const satisfies readonly NalatiTexName[];

function terrainMesh(value: THREE.Object3D | undefined): value is THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> {
  if (!(value instanceof THREE.Mesh)) return false;
  const geometry: unknown = value.geometry, material: unknown = value.material;
  return geometry instanceof THREE.BufferGeometry && material instanceof THREE.MeshLambertMaterial;
}

/** Painterly appearance stays live; terrain and slab topology are authored scene data. */
const NALATI_TERRAIN_PAINTER: TerrainPainter = { build: async (terrain, field) => {
  const [, textures, product] = await Promise.all([field.ready(), Promise.all(LAYERS.map(name => loadSpecimenTexture(specimenData.materials[name].texture))), loadFirstPartyProduct('nalati-grasslands')]);
  const material = painterlyMaterial(null, { bands: 0.5, rim: 0, shade: 0.85 });
  const colour = product.section('look/colour-functions')['terrain'];
  if (colour === undefined) throw new Error('Missing terrain colour graph');
  applyPaintedTerrain(material, SURFACE, Object.fromEntries(LAYERS.map((name, index) => { const texture = textures[index]; if (texture === undefined) throw new Error(`Missing painted tile ${name}`); return [name, texture]; })));
  materialColourGraph(material, 'terrain.colour', colour, true);
  bindPaintedTerrainBake(material, {
    famTBakeShadow: bakeUniforms.tBakeShadow, famTBakeMatrix: bakeUniforms.uBakeMatrix, famTBakeInfo: bakeUniforms.uBakeInfo,
    famTBakeContact: bakeUniforms.tBakeContact, famTContactXf: bakeUniforms.uContactXf,
  });
  const shapes = new Map<string, THREE.BufferGeometry>();
  for (const id of ['ground', 'slab']) {
    const file = `world/terrain/${id}.glb`, owned = createOwnedGeometry(file);
    await owned.load(await product.file(file));
    const geometry = owned.take(); geometry.computeBoundingSphere(); shapes.set(id, geometry);
  }
  const { terrain: recipe } = await product.json<{ readonly terrain: unknown }>('world/water.json');
  const scene = createClientScene(parseWorldScene(recipe).scene, { geometry: shapes, materials: new Map([['terrain', material]]) });
  const ground = scene.parts.get('ground'), slab = scene.parts.get('slab');
  if (!terrainMesh(ground) || !terrainMesh(slab)) throw new Error('Missing named terrain mesh');
  terrain.material = material; terrain.mesh = ground;
  terrain.group.add(...scene.root.children);
} };

export const shardRender = (): LookStrategy => ({
  mode: 'replace',
  compose: (c) => ({ chain: lookV2Passes(c) }),
  engineKnobs: lookV2EngineKnobs,
  fog: { order: 300, install: () => { installPaintedAir(); installLookV2Fog(); } },
  terrainPainter: NALATI_TERRAIN_PAINTER,
  grass: { build: (sky, forest) => createGrass(sky, forest) },
  sky: NALATI_SKY,
});
