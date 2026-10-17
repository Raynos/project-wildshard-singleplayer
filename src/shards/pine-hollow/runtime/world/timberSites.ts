import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { UnderPlacements } from '../looks/groundCover';
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
import type { TimberCopy } from './timber';
import { mossHint, TimberRowSchema } from '../../world/timberBake';
import siteJson from '../../data/siteTimbers.json' with { type: 'json' };
import authored from '../../data/timberWorld.generated.json' with { type: 'json' };
import source from '../../shard.config';

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

const floorKinds = ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'] as const;
const floorPlace = v.strictObject({ x: num, y: num, z: num, nx: num, ny: num, nz: num, rot: num, scale: num, r: num, g: num, b: num, matrix: v.pipe(v.array(num), v.length(16)) });
const floorList = v.pipe(v.array(floorPlace), v.maxLength(40_000)), count = v.pipe(v.number(), v.integer(), v.minValue(0));
/** Exact ordered layouts; malformed records, count mismatches and oversized floors refuse. */
export const FloorRowsSchema = v.pipe(v.strictObject({ counts: v.tuple([count, count, count, count, count, count]),
  layout: v.strictObject({ ferns: floorList, shrubs: floorList, litter: floorList, stones: floorList, moss: floorList, reeds: floorList }) }),
  v.check(row => row.counts.reduce((total, n) => total + n, 0) <= 40_000 && floorKinds.every((kind, i) => row.layout[kind].length === row.counts[i])));
/** Required named floor records, decoded during authoring rather than on the page. */
export async function loadUnderPlacements(): Promise<UnderPlacements> {
  const product = await loadFirstPartyProduct('pine-hollow');
  return v.parse(FloorRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file('world/floor.json')))).layout;
}
