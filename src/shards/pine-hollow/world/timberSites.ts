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
import { readWholeGeometry, type WholeGeometryView } from '@wildshard/game/plugin/geometry';
import { Timber } from './timber';
import { colliderOf, TimberRowSchema, type TimberRow } from './timberBake';
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

/** Recreate original draws and unchanged facts; the native timber material and shadow policy still finishes them. */
export function timberFromViews(ctx: ModelContext, name: string, identity: string, row: TimberRow): Timber {
  const ready = ctx.once<Map<string, WholeGeometryView>>('pine-hollow/timber:ready', () => { throw new Error('[timber] admitted views not ready'); });
  const draw = (key: string): THREE.BufferGeometry => {
    const view = ready.get(`${identity}-${key}`);
    if (view === undefined) throw new Error(`[timber] missing original draw ${identity}-${key}`);
    return view.geometry.clone();
  };
  const parts = new Map(row.parts.filter(part => part.counts.length > 0).map(part => [part.key, [draw(part.key)]]));
  const glass = row.glass.length === 0 ? [] : [draw('glass')];
  const anchors = Object.fromEntries(Object.entries(row.anchors).map(([key, point]) => [key, new THREE.Vector3(...point)]));
  return Timber.baked(name, parts, glass, { colliders: row.colliders.map(colliderOf), floors: row.floors, anchors });
}

/** one copy's timber from the bake, unfinished */
export function siteTimber(ctx: ModelContext, name: string, site: TimberSite, rows: SiteTimberRows = SITE_TIMBER_ROWS): Timber {
  const copies = name === LANDING.name ? rows.landing : name === BRIDGE.name ? rows.bridge : undefined;
  if (copies === undefined) throw new Error(`[timber] unknown copy ${name}`);
  return timberFromViews(ctx, name, site === 'world' ? name : `${name}-turntable`, copies[site]);
}

/** the identity a copy's facts are kept by (`timberFacts` keys by object) */
export const SITE_KEYS: Readonly<Record<TimberSite, object>> = { world: {}, turntable: {} };

/** Borrow one authored rest shape, retaining the original native culling sphere. */
export function propShapeGeometry(views: ReadonlyMap<string, WholeGeometryView>, name: string, sphere: readonly number[]): THREE.BufferGeometry {
  const view = views.get(name); if (view === undefined) throw new Error(`[props] missing authored shape ${name}`);
  const [x, y, z, radius] = v.parse(v.tuple([num, num, num, v.pipe(num, v.minValue(0))]), sphere);
  const geometry = view.geometry.clone(); geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y, z), radius);
  return geometry;
}
