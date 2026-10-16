import floor from '../data/floor.generated.json' with { type: 'json' };
import type { UnderPlacements } from '../runtime/looks/groundCover';
/**
 * Pine Hollow's two site-fitted timber landmarks, the zipline landing and the creek footbridge (E315 M2; PH-B3), where
 * they stand and their offline bake (G285, SF72 "bake the code-built worlds"). Each is fitted to the ground under it: the
 * landing's posts and stair foot, the bridge's deck from bank to bank and its trestles down to the gully's floor. Their
 * builders run at build time (`../generators/siteTimbers.ts`, `src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs`) over the page's own
 * baked terrain. The combined timber Scene emits admitted world tiles and an Explorer-only library; the fact rows
 * remain unchanged. The shared reader reconstructs each original draw before the native material/shadow finisher.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import type { ModelContext } from '@wildshard/engine/models/model';
import { resourceScope } from '@wildshard/engine/app/resources';
import { readWholeGeometry, fetchLaneBake, type WholeGeometryView } from '@wildshard/game/plugin/geometry';
import type { TimberCopy } from '../runtime/world/timber';
import { mossHint, TimberRowSchema } from './timberBake';
import siteJson from '../data/siteTimbers.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import source from '../shard.config';

/** the tower / landing turn: local −Z points from the lookout down the cable to the landing (the ride and the vista bench, PH-C1 / C8) */
export const ZIP_YAW = authored.placements.lookout.yaw;
/** the footbridge's half length (m) */
export const BRIDGE_HALF = 12;
/** a site-fitted timber's copy: at its site in the world, or on the turntable's flat ground */
export type TimberSite = 'world' | 'turntable';
/** Retained native identities; stream salts exist only in the author generator. */
export const LANDING = { name: 'zipline-landing' } as const;
export const BRIDGE = { name: 'creek-footbridge' } as const;

/** the landing's frame: on the ground at the cable's foot, turned with the tower */
export function landingSite(): { at: THREE.Matrix4; y: number } {
  const at = new THREE.Matrix4().fromArray(authored.placements.landing.matrix);
  return { at, y: at.elements[13] };
}

/** the footbridge's frame: along the E road through the crossing (its previous vertex to its next), between its banks */
export function bridgeSite(): { at: THREE.Matrix4; y: number; yaw: number } {
  // The shipping browser's atan2 has a different last ulp from Node. Keep native collision ownership exact.
  const [numerator, denominator] = v.parse(v.tuple([v.number(), v.number()]), authored.placements.bridge.turn);
  const yaw = Math.atan2(numerator, denominator), root = new THREE.Object3D();
  root.position.fromArray(authored.placements.bridge.matrix, 12); root.rotation.y = yaw; root.updateMatrixWorld(true);
  return { at: root.matrixWorld.clone(), y: root.position.y, yaw };
}

/** Declared double-precision lookout frame; native owners still install its floors, collider and ride. */
export function lookoutSite(): THREE.Matrix4 { return new THREE.Matrix4().fromArray(authored.placements.lookout.matrix); }

const num = v.pipe(v.number(), v.finite());
const Copies = v.strictObject({ world: TimberRowSchema, turntable: TimberRowSchema });
export const SiteTimberRowsSchema = v.strictObject({ bin: v.string(), bytes: num, seed: num, landing: Copies, bridge: Copies });
export type SiteTimberRows = v.InferOutput<typeof SiteTimberRowsSchema>;
/** the bake's rows, parsed strictly once */
export const SITE_TIMBER_ROWS: SiteTimberRows = v.parse(SiteTimberRowsSchema, siteJson);

const KEY = 'pine-hollow/timber:views';

/** Fetch the site timbers' bake into this shard's context (once). */
export async function loadSiteTimbers(ctx: ModelContext): Promise<Map<string, WholeGeometryView>> {
  if (source.props === null) throw new Error('[timber] missing admitted props');
  const refs = authored.shardfile.files.filter(file => file.kind === 'glb').map(file => file.hash);
  const pending = ctx.once(KEY, () => readWholeGeometry(resourceScope(), source,
    refs));
  const ready = await pending; ctx.once('pine-hollow/timber:ready', () => ready);
  return ready;
}

/** One original timber draw from the bake: a fresh copy, its moss channel named as the timber's look reads it. */
export function timberDraw(ctx: ModelContext, name: string): THREE.BufferGeometry {
  const ready = ctx.once<Map<string, WholeGeometryView>>('pine-hollow/timber:ready', () => { throw new Error('[timber] admitted views not ready'); });
  const view = ready.get(name);
  if (view === undefined) throw new Error(`[timber] missing original draw ${name}`);
  return mossHint(view.geometry.clone());
}

/** A site-fitted copy: its draws' prefix and its bake's rows, at its site in the world or on the turntable. */
export function siteCopy(name: string, site: TimberSite): TimberCopy {
  const copies = name === LANDING.name ? SITE_TIMBER_ROWS.landing : name === BRIDGE.name ? SITE_TIMBER_ROWS.bridge : undefined;
  if (copies === undefined) throw new Error(`[timber] unknown copy ${name}`);
  return { identity: site === 'world' ? name : `${name}-turntable`, row: copies[site] };
}

/** Borrow one authored rest shape, retaining the original native culling sphere. */
export function propShapeGeometry(views: ReadonlyMap<string, WholeGeometryView>, name: string, sphere: readonly number[]): THREE.BufferGeometry {
  const view = views.get(name); if (view === undefined) throw new Error(`[props] missing authored shape ${name}`);
  const [x, y, z, radius] = v.parse(v.tuple([num, num, num, v.pipe(num, v.minValue(0))]), sphere);
  const geometry = view.geometry.clone(); geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y, z), radius);
  return geometry;
}

/** Required hash-named floor records; the temporary byte view is not retained beside the layout. */
export async function loadUnderPlacements(): Promise<UnderPlacements> {
  const bytes = await fetchLaneBake(floor.url), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 32 || view.getUint32(0, true) !== 0x46555357 || view.getUint32(4, true) !== 2) throw new Error('[undergrowth] invalid floor records');
  const kinds = ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'] as const;
  const counts = kinds.map((_, i) => view.getUint32(8 + i * 4, true));
  const count = counts.reduce((total, n) => total + n, 0);
  if (count > 40_000 || bytes.length !== 32 + count * 12 || counts.some((n, i) => n !== floor.counts[i])) throw new Error('[undergrowth] invalid floor counts');
  const layout: UnderPlacements = { ferns: [], shrubs: [], litter: [], stones: [], moss: [], reeds: [] };
  let offset = 32;
  const tints = [[.5,.78,.72,.82,.48,.6],[.8,1,.9,.8,.6,.55],[.7,.9,.68,.82,.62,.75],[.75,1,.75,.98,.75,.95],[.6,.85,.62,.78,.5,.62],[.75,1,.85,.95,.45,.6]] as const;
  for (const [i, kind] of kinds.entries()) for (let j = 0; j < (counts[i] ?? 0); j++) {
    const tint = tints[i]; if (tint === undefined) throw new Error('[undergrowth] missing tint');
    const nx = view.getInt8(offset + 8) / 127, nz = view.getInt8(offset + 9) / 127, hue = view.getUint8(offset + 11) / 255;
    const mix = (a: number, b: number): number => a + (b - a) * hue;
    layout[kind].push({ x: view.getUint16(offset, true) / 65535 * 500 - 250, y: view.getUint16(offset + 2, true) / 65535 * 256 - 128, z: view.getUint16(offset + 4, true) / 65535 * 500 - 250,
      nx, ny: Math.sqrt(1 - nx * nx - nz * nz), nz, rot: view.getUint16(offset + 6, true) / 65535 * (2 * Math.PI), scale: .5 + view.getUint8(offset + 10) / 200,
      r: mix(tint[0], tint[1]), g: mix(tint[2], tint[3]), b: mix(tint[4], tint[5]) });
    offset += 12;
  }
  return layout;
}
