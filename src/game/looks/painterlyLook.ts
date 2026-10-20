/** The painterly look host's world pieces (G478 point 3, with game/looks/paintedLook): a level that paints its own world
 * (Nalati's panorama painterly) declares them as rows; renderer construction and lifetime hooks stay here. */
import { BufferGeometry, ClampToEdgeWrapping, Color, Material, Vector3, Mesh, MeshLambertMaterial, SphereGeometry, type IUniform, type Scene, type Texture } from 'three';
import * as v from 'valibot';
import type { TerrainPainter } from '@wildshard/engine/render/look';
import type { Scope } from '@wildshard/engine/app/scope';
import { loadTextureRow } from '@wildshard/engine/core/assets';
import { smoothstep } from '@wildshard/engine/core/noise';
import { TIER } from '@wildshard/engine/core/tier';
import { headingTexture } from '@wildshard/engine/render/dataLook';
import { applyPaintedTerrain, bindPaintedTerrainBake } from '@wildshard/engine/render/families/paintedTerrain';
import { painterlyMaterial, painterlyUniforms, syncPainterlySun } from '@wildshard/engine/world/painterly';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { materialColourGraph } from '@wildshard/engine/render/graph/colourFunction';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { parsePaintedTerrain } from '@wildshard/format/materialFamilies';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import { SpecimenTextureSchema } from '@wildshard/format/specimenCatalogue';
import { loadSpecimenTexture } from '../models/specimenCatalogue';
import { createClientScene } from '../plugin/ui';
import { lentLook, setLentParam, setLentTexture } from '../shardfile/lentLooks';
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

const tiers = <T extends v.GenericSchema>(schema: T) => v.strictObject({ phone: schema, desktop: schema });
const triple = v.tuple([finite, finite, finite]);
/**
 * The painted panorama (the painterly look host, G478): a level whose sky is one painting. The `dome` (a sphere of
 * `radius` and `segments`, drawn first at `order`, centred on the camera) wears its lent `look`, given the painting
 * (`image` per tier, its edge `pad` pixels over the image width, `fallbackWidth` until it reports one), the ridge line's
 * heading texture (the level's `ridge`: v per azimuth sample), the level's fog LUT, the `zenith` colour per tier, the sun each frame
 * and a night fade over the sun's elevation (`night` [from, to] degrees). The level's `sea` mesh (by name) takes its own
 * lent look, sunk to `y`, with the same LUT and sun. Each frame both looks hear the level's lent uniforms, and the `lit`
 * looks hear the painterly world's shade, rim and wet.
 */
export const PaintedPanoramaSchema = v.strictObject({
  dome: v.strictObject({ name: shapeId, look: shapeId, image: tiers(v.pipe(v.string(), v.regex(/^\/assets\/[a-zA-Z0-9/_.-]+$/u))), pad: finite, fallbackWidth: v.pipe(finite, v.minValue(1)),
    zenith: tiers(triple), radius: v.pipe(finite, v.minValue(1)),
    segments: v.tuple([v.pipe(finite, v.integer(), v.minValue(3), v.maxValue(256)), v.pipe(finite, v.integer(), v.minValue(2), v.maxValue(256))]), order: v.pipe(finite, v.integer()),
    night: v.tuple([finite, finite]), params: v.strictObject({ image: shapeId, ridge: shapeId, lut: shapeId, pad: shapeId, zenith: shapeId, sun: shapeId, night: shapeId }) }),
  sea: v.strictObject({ name: shapeId, look: shapeId, y: finite, lut: shapeId, sun: shapeId }),
  lit: v.strictObject({ looks: v.pipe(v.array(shapeId), v.maxLength(16)), shade: shapeId, rim: shapeId, wet: shapeId }),
});
type LentValue = number | { toArray: () => number[] };
const shade: number[] = [0, 0, 0], rim: number[] = [0, 0, 0];
/** The painted panorama built from its rows over the level's ridge, fog LUT and lent uniforms. */
export class PaintedPanorama {
  readonly dome: Mesh;
  private readonly rows: v.InferOutput<typeof PaintedPanoramaSchema>;
  private constructor(rows: v.InferOutput<typeof PaintedPanoramaSchema>, dome: Mesh, private readonly uniforms: Readonly<Record<string, IUniform<LentValue>>>) { this.rows = rows; this.dome = dome; }
  static async build(scene: Scene, anisotropy: number, scope: Scope, input: unknown, level: { readonly ridge: readonly number[]; readonly lut: Texture; readonly uniforms: Readonly<Record<string, IUniform<LentValue>>> }): Promise<PaintedPanorama | null> {
    const rows = v.parse(PaintedPanoramaSchema, input), d = rows.dome, p = d.params;
    const image = scope.own(await loadTextureRow({ url: d.image[TIER], srgb: true, wrapT: ClampToEdgeWrapping, anisotropy }));
    if (scope.disposed) return null;
    setLentTexture(d.look, p.image, image); setLentTexture(d.look, p.ridge, scope.own(headingTexture({ samples: level.ridge, stride: 1, half: true })));
    setLentTexture(d.look, p.lut, level.lut);
    const size: unknown = image.image;
    const width = typeof size === 'object' && size !== null && 'width' in size && typeof size.width === 'number' ? size.width : d.fallbackWidth;
    setLentParam(d.look, p.pad, d.pad / Math.max(1, width)); setLentParam(d.look, p.zenith, d.zenith[TIER]);
    const dome = new Mesh(scope.own(new SphereGeometry(d.radius, d.segments[0], d.segments[1])), lentLook(d.look));
    dome.name = d.name; dome.frustumCulled = false; dome.renderOrder = d.order;
    dome.onBeforeRender = (_renderer, _scene, camera) => { camera.getWorldPosition(dome.position); scene.worldToLocal(dome.position); dome.updateMatrixWorld(); };
    scene.add(dome);
    const sea = scene.getObjectByName(rows.sea.name);
    if (sea instanceof Mesh) {
      const old: unknown = sea.material;
      sea.material = lentLook(rows.sea.look); sea.position.y = rows.sea.y;
      setLentTexture(rows.sea.look, rows.sea.lut, level.lut);
      if (old instanceof Material) old.dispose();
    }
    return new PaintedPanorama(rows, dome, level.uniforms);
  }
  /** Push this frame's sun and lent uniforms; the night (0 … 1) the dome fades to. */
  update(sunDir: Vector3, sunElevation: number): number {
    const { dome: d, sea, lit } = this.rows, sun = sunDir.toArray(), night = smoothstep(d.night[0], d.night[1], sunElevation);
    setLentParam(d.look, d.params.sun, sun); setLentParam(sea.look, sea.sun, sun); setLentParam(d.look, d.params.night, night);
    for (const look of [d.look, sea.look]) for (const [key, uniform] of Object.entries(this.uniforms)) {
      const value = uniform.value; setLentParam(look, key, typeof value === 'number' ? value : value.toArray());
    }
    painterlyUniforms.uPShade.value.toArray(shade); painterlyUniforms.uPRimColor.value.toArray(rim);
    for (const look of lit.looks) { setLentParam(look, lit.shade, shade); setLentParam(look, lit.rim, rim); setLentParam(look, lit.wet, painterlyUniforms.uPWet.value); }
    return night;
  }
}

/**
 * The painter's key light (the painterly look host, G478): the sky keeps its painted sun, but the light that shades the
 * world swings `turn` degrees further round (compass, clockwise) and `lift` degrees higher, easing back onto the real sun
 * as it sets (fully cheated above `ease[1]` degrees, not at all below `ease[0]`); only while the key is the sun. The fill
 * goes `mix` of the way to `sky` and `ground` (linear RGB) at `fill` × the hour's intensity, and the grade's saturation
 * follows the hour's own saturation relative to the day's.
 */
export const PainterKeyLightSchema = v.strictObject({ turn: finite, lift: finite, ease: v.tuple([finite, finite]), sky: triple, ground: triple,
  mix: v.pipe(finite, v.minValue(0), v.maxValue(1)), fill: v.pipe(finite, v.minValue(0)) });
/** What the key light reads of the hour's look. */
export interface PainterSkyLook { readonly sunDir: Vector3; readonly keyColor: Color; readonly keyIntensity: number; readonly moon: number;
  readonly hemiSky: Color; readonly hemiGround: Color; readonly hemiIntensity: number; readonly saturation: number }
const D2R = Math.PI / 180, keyDir = new Vector3(), mixed = new Color();
/** The painter's key on a sky rig; `apply` after the rig set the hour's look. */
export class PainterKeyLight {
  private readonly rows: v.InferOutput<typeof PainterKeyLightSchema>;
  private readonly sky: Color; private readonly ground: Color;
  constructor(input: unknown, private readonly rig: SkyRig, private readonly daySaturation: number, private readonly saturation: IUniform<number>) {
    this.rows = v.parse(PainterKeyLightSchema, input); this.sky = new Color(...this.rows.sky); this.ground = new Color(...this.rows.ground);
  }
  apply(look: PainterSkyLook): void {
    const r = this.rows, rig = this.rig;
    if (look.moon <= 0) {
      const d = look.sunDir, el = Math.asin(Math.min(1, Math.max(-1, d.y))), az = Math.atan2(-d.x, d.z);   // compass: 0 = north (+z), +π/2 = east (−x)
      const k = smoothstep(r.ease[0] * D2R, r.ease[1] * D2R, el), az2 = az + r.turn * D2R * k, el2 = Math.max(el, el + r.lift * D2R * k);
      rig.setKeyLight(keyDir.set(-Math.sin(az2) * Math.cos(el2), Math.sin(el2), Math.cos(az2) * Math.cos(el2)), look.keyColor, look.keyIntensity);
      syncPainterlySun(rig);
    }
    rig.hemi.color.copy(look.hemiSky).lerp(mixed.copy(this.sky), r.mix);
    rig.hemi.groundColor.copy(look.hemiGround).lerp(mixed.copy(this.ground), r.mix);
    rig.hemi.intensity = look.hemiIntensity * r.fill;
    this.saturation.value = Math.max(0, 1 + (look.saturation - this.daySaturation));
  }
}
