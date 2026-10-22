/**
 * A painterly level's painted world as look parts from rows (G600 L1: "grade, fog, ground, grass, sky as rows"), beside its
 * post-graph look (game/looks/postGraphLook): the static capture's shade, the panorama fog (a colour ramp to its haze over
 * the painted heading LUT, re-tinted live by the engine's panorama tint), the painted air (cloud shadows, `paintedAir`),
 * the painted ground (`paintedGroundPainter`) and the grass (game/looks/grassPresentation), all shaded by the one capture.
 * Built once per page per level slug; the level's world wiring reads the same parts by its slug (`paintedWorldOf`) and
 * `wire`s its painterly world (game/looks/painterlyLook: the panorama dome, the painter's key light, the static capture,
 * the grass's mood) from the optional `world` rows, lending the grade's live uniforms the post-graph look reads.
 * Client-only presentation.
 */
import { Vector4, type DataTexture, type IUniform, type Object3D, type Scene } from 'three';
import * as v from 'valibot';
import type { FogModel, GrassDriver, SkyDressing, TerrainPainter } from '@wildshard/engine/render/look';
import { headingTexture } from '@wildshard/engine/render/dataLook';
import { ColourRampFog, panoramaTint } from '@wildshard/engine/world/Atmosphere';
import { paintedAir } from './paintedLook';
import { PainterlyWorld, paintedGroundPainter } from './painterlyLook';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { uniformsFrom } from '../plugin/shaderFamily';
import { lendUniforms } from '../shardfile/lentLooks';
import { GrassPresentation, GrassPresentationProfile } from './grassPresentation';
import { staticCaptureUniforms, type StaticCaptureUniforms } from './staticCapture';

const finite = v.pipe(v.number(), v.finite());
const v3 = v.tuple([finite, finite, finite]), v4 = v.tuple([finite, finite, finite, finite]);
/** The painted world's rows; each part's own host admits its row (air, ground, tiles, capture, grass). */
export const PaintedWorldSchema = v.strictObject({
  /** the ramp from `start` to `end` metres toward `haze`, the panorama's aerial / edge haze, its fog slot, and the heading
   *  LUT (sRGB triples round the azimuth, un-graded at build time so the level's grade maps them back onto the painting) */
  fog: v.strictObject({ start: finite, end: finite, haze: v3, aerial: v4, edge: v4, order: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1000)),
    lut: v.pipe(v.array(finite), v.minLength(3), v.maxLength(3 * 4096), v.check(rows => rows.length % 3 === 0, 'RGB triples')) }),
  air: v.unknown(), ground: v.unknown(), tiles: v.unknown(), capture: v.unknown(),
  /** the grass rows and its cards' atlas (a phone and a full size) */
  /** the painterly world's rows, its panorama's and key light's (null: none), the panorama's ridge; the grade's uniforms
   *  (lent as `lend` for the level's post-graph look; every one but the key's `saturation` reaches the panorama) and the
   *  panorama's names for the engine's panorama tint */
  world: v.exactOptional(v.strictObject({ rows: v.unknown(), panorama: v.unknown(), key: v.unknown(), ridge: v.pipe(v.array(finite), v.maxLength(8192)),
    grade: v.strictObject({ lend: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), uniforms: v.record(v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u)), finite), saturation: v.string() }),
    tint: v.record(v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u)), v.picklist(['key', 'moon', 'light', 'veil', 'veilColour', 'flash'])) })),
  grass: v.strictObject({ rows: v.unknown(), cards: v.strictObject({ url: v.pipe(v.string(), v.regex(/^\/[A-Za-z0-9/_.-]+$/u)), phoneUrl: v.pipe(v.string(), v.regex(/^\/[A-Za-z0-9/_.-]+$/u)), name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)) }) }),
});

/** What a painted world lends its level: the parts its world wiring shares, and the look's parts. */
export interface PaintedWorldParts {
  readonly bake: StaticCaptureUniforms;
  /** the fog's heading LUT (scene-linear, half float, repeating round the azimuth), shared with the panorama dome */
  readonly fogLut: DataTexture;
  readonly tint: typeof panoramaTint;
  readonly grass: GrassPresentationProfile;
  readonly look: { readonly fog: FogModel; readonly terrainPainter: TerrainPainter; readonly grass: GrassDriver; readonly sky: SkyDressing };
  /** the level's world (its world wiring): lend the grade, build the painterly world (null: no world rows, or none built) */
  readonly wire: (ports: PaintedWorldPorts) => Promise<PainterlyWorld | null>;
}
/** The world-stage owners a painterly world draws into and follows. */
export interface PaintedWorldPorts {
  readonly renderer: Renderer; readonly scene: Scene; readonly scope: Scope; readonly sky: SkyRig; readonly stars: Object3D;
  readonly groups: Readonly<Record<string, Object3D>>; readonly casters: readonly Object3D[];
  /** the level's daytime saturation the key light eases from */
  readonly daySaturation: number;
}

const built = new Map<string, PaintedWorldParts>();

/** The painted world of the level `slug` from its rows, built on the first call of the page. */
export function paintedWorld(slug: string, input: unknown): PaintedWorldParts {
  const had = built.get(slug);
  if (had !== undefined) return had;
  const row = v.parse(PaintedWorldSchema, input), { fog } = row;
  const bake = staticCaptureUniforms(row.capture), grass = new GrassPresentationProfile(row.grass.rows), air = paintedAir(row.air);
  const fogLut = headingTexture({ samples: fog.lut, stride: 3, half: true, name: `${slug}-fog-lut` });
  const ramp = new ColourRampFog({ start: fog.start, end: fog.end, near: fog.haze, zenith: fog.haze, panorama: { lut: { value: fogLut },
    aerial: { value: v4Of(fog.aerial) }, edge: { value: v4Of(fog.edge) }, tint: panoramaTint } }).model(fog.order);
  const cards = row.grass.cards, world = row.world, grade: Record<string, IUniform<number>> = world === undefined ? {} : uniformsFrom(world.grade.uniforms);
  const wire = (ports: PaintedWorldPorts): Promise<PainterlyWorld | null> => {
    if (world === undefined) return Promise.resolve(null);
    lendUniforms(ports.scope, world.grade.lend, grade);
    const saturation = grade[world.grade.saturation];
    if (saturation === undefined) throw new Error(`Painted world grade has no ${world.grade.saturation}`);
    const uniforms = { ...Object.fromEntries(Object.entries(grade).filter(([name]) => name !== world.grade.saturation)),
      ...Object.fromEntries(Object.entries(world.tint).map(([name, part]) => [name, panoramaTint[part]])) };
    return PainterlyWorld.build(world.rows, { ...ports, grass, capture: { rows: row.capture, uniforms: bake },
      panorama: { rows: world.panorama, ridge: world.ridge, lut: fogLut, uniforms }, key: { rows: world.key, daySaturation: ports.daySaturation, saturation } });
  };
  const parts: PaintedWorldParts = { bake, fogLut, tint: panoramaTint, grass, wire, look: {
    // the cloud shadows first, then the panorama fog: every fogged material fades into the painted haze behind it
    fog: { ...ramp, install: () => { air.install(); ramp.install(); } },
    terrainPainter: paintedGroundPainter(slug, row.ground, row.tiles, bake),
    grass: { build: (sky, forest) => new GrassPresentation(grass, sky, forest, bake, cards).build() },
    sky: air.sky,
  } };
  built.set(slug, parts);
  return parts;
}

/** The painted world the level `slug`'s look built; throws before it has. */
export function paintedWorldOf(slug: string): PaintedWorldParts {
  const parts = built.get(slug);
  if (parts === undefined) throw new Error(`No painted world for ${slug}: its look builds it before its world wiring`);
  return parts;
}

function v4Of(row: readonly [number, number, number, number]): Vector4 { return new Vector4(...row); }
