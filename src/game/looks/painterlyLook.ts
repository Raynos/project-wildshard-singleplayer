/** The painterly look host's world pieces (G478 point 3, with game/looks/paintedLook): a level that paints its own world
 * (Nalati's panorama painterly) declares them as rows; renderer construction and lifetime hooks stay here. */
import { BufferGeometry, Mesh, MeshLambertMaterial, type Texture } from 'three';
import * as v from 'valibot';
import type { TerrainPainter } from '@wildshard/engine/render/look';
import { applyPaintedTerrain, bindPaintedTerrainBake } from '@wildshard/engine/render/families/paintedTerrain';
import { materialColourGraph } from '@wildshard/engine/render/graph/colourFunction';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { parsePaintedTerrain } from '@wildshard/format/materialFamilies';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import { SpecimenTextureSchema } from '@wildshard/format/specimenCatalogue';
import { loadSpecimenTexture } from '../models/specimenCatalogue';
import { createClientScene } from '../plugin/ui';
import { loadFirstPartyProduct } from '../shardfile/runtimeProduct';
import type { StaticCaptureUniforms } from './staticCapture';

const finite = v.pipe(v.number(), v.finite());
const shapeId = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*$/u));
/**
 * The painted ground (the painterly look host, G478): the level's `surface` (the painted-terrain family's maps, metres,
 * snow and ice) over `layers` of tiled specimen textures (the specimen materials of those names), in a painterly material (`bands`, `rim`, `shade`), recoloured
 * by the product's `colour` function (look/colour-functions) and shaded by the static bake. Its meshes are the product's
 * `shapes` (world/terrain/<id>.glb), stood by the `recipe` (a world scene in a product JSON file's key); `mesh` is the
 * one the terrain answers for.
 */
export const PaintedGroundSchema = v.strictObject({ surface: v.unknown(), layers: v.pipe(v.array(shapeId), v.minLength(1), v.maxLength(8)),
  material: v.strictObject({ bands: finite, rim: finite, shade: finite }), colour: shapeId,
  shapes: v.pipe(v.array(shapeId), v.minLength(1), v.maxLength(8)), recipe: v.strictObject({ file: v.string(), key: shapeId }), mesh: shapeId });
function isGroundMesh(value: unknown): value is Mesh<BufferGeometry, MeshLambertMaterial> {
  return value instanceof Mesh && value.geometry instanceof BufferGeometry && value.material instanceof MeshLambertMaterial;
}
const SpecimenTilesSchema = v.record(v.string(), v.looseObject({ texture: v.optional(SpecimenTextureSchema) }));
/** The level's painted ground from its rows over its specimen materials' `tiles`, shaded by the static capture's `bake`. */
export function paintedGroundPainter(slug: string, input: unknown, tiles: unknown, bake: StaticCaptureUniforms): TerrainPainter {
  const rows = v.parse(PaintedGroundSchema, input), surface = parsePaintedTerrain(rows.surface), materials = v.parse(SpecimenTilesSchema, tiles);
  return { build: async (terrain, field) => {
    const [, textures, product] = await Promise.all([field.ready(), Promise.all(rows.layers.map(name => {
      const texture = materials[name]?.texture; if (texture === undefined) throw new Error(`Missing painted tile ${name}`); return loadSpecimenTexture(texture);
    })), loadFirstPartyProduct(slug)]);
    const material = painterlyMaterial(null, rows.material);
    const colour = product.section('look/colour-functions')[rows.colour];
    if (colour === undefined) throw new Error(`Missing ground colour graph ${rows.colour}`);
    applyPaintedTerrain(material, surface, Object.fromEntries(rows.layers.map((name, index) => [name, textures[index] ?? null]).filter((row): row is [string, Texture] => row[1] !== null)));
    materialColourGraph(material, `${rows.colour}.colour`, colour, true);
    bindPaintedTerrainBake(material, { famTBakeShadow: bake.tBakeShadow, famTBakeMatrix: bake.uBakeMatrix, famTBakeInfo: bake.uBakeInfo,
      famTBakeContact: bake.tBakeContact, famTContactXf: bake.uContactXf });
    const shapes = new Map<string, BufferGeometry>();
    for (const id of rows.shapes) {
      const file = `world/terrain/${id}.glb`, owned = createOwnedGeometry(file);
      await owned.load(await product.file(file));
      const geometry = owned.take(); geometry.computeBoundingSphere(); shapes.set(id, geometry);
    }
    const recipe = (await product.json<Readonly<Record<string, unknown>>>(rows.recipe.file))[rows.recipe.key];
    const scene = createClientScene(parseWorldScene(recipe).scene, { geometry: shapes, materials: new Map([['terrain', material]]) });
    const ground = scene.parts.get(rows.mesh);
    if (!isGroundMesh(ground) || !rows.shapes.every(id => isGroundMesh(scene.parts.get(id)))) throw new Error('Missing named ground mesh');
    terrain.material = material; terrain.mesh = ground;
    terrain.group.add(...scene.root.children);
  } };
}
