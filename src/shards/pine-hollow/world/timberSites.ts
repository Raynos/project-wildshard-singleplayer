/**
 * Pine Hollow's two site-fitted timber landmarks, the zipline landing and the creek footbridge (E315 M2; PH-B3), where
 * they stand and their offline bake (G285, SF72 "bake the code-built worlds"). Each is fitted to the ground under it: the
 * landing's posts and stair foot, the bridge's deck from bank to bank and its trestles down to the gully's floor. Their
 * builders run at build time (`../generators/siteTimbers.ts`, `src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs`) over the page's own
 * baked terrain, once at their sites and once on the Model Explorer's flat turntable; the binary
 * (`public/assets/pine-hollow/baked/site-timbers.bin`) holds their parts in that order, `../data/siteTimbers.json` the rows.
 */
import type * as THREE from 'three';
import * as v from 'valibot';
import type { ModelContext } from '@wildshard/engine/models/model';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { CREEK_BRIDGE, E_ROAD, ZIPLINE } from '../layout';
import { fetchBake } from './bakeBytes';
import { timberFrame, type Timber } from './timber';
import { TimberBlocks, TimberRowSchema, type TimberRow } from './timberBake';
import siteJson from '../data/siteTimbers.json' with { type: 'json' };

/** the tower / landing turn: local −Z points from the lookout down the cable to the landing (the ride and the vista bench, PH-C1 / C8) */
export const ZIP_YAW = Math.atan2(ZIPLINE.from.x - ZIPLINE.to.x, ZIPLINE.from.z - ZIPLINE.to.z);
/** the footbridge's half length (m) */
export const BRIDGE_HALF = 12;
/** a site-fitted timber's copy: at its site in the world, or on the turntable's flat ground */
export type TimberSite = 'world' | 'turntable';
/** the timbers' names and streams (the level seed + these) */
export const LANDING = { name: 'zipline-landing', seed: 902 } as const;
export const BRIDGE = { name: 'creek-footbridge', seed: 903 } as const;

/** the landing's frame: on the ground at the cable's foot, turned with the tower */
export function landingSite(): { at: THREE.Matrix4; y: number } {
  const y = heightAt(ZIPLINE.to.x, ZIPLINE.to.z);
  return { at: timberFrame(ZIPLINE.to.x, y, ZIPLINE.to.z, ZIP_YAW), y };
}

/** the footbridge's frame: along the E road through the crossing (its previous vertex to its next), between its banks */
export function bridgeSite(): { at: THREE.Matrix4; y: number; yaw: number } {
  const i = E_ROAD.findIndex(([x, z]) => x === CREEK_BRIDGE.x && z === CREEK_BRIDGE.z);
  const a = E_ROAD[i - 1] ?? E_ROAD[0], b = E_ROAD[i + 1] ?? E_ROAD[1];
  const dx = (b?.[0] ?? 1) - (a?.[0] ?? 0), dz = (b?.[1] ?? 0) - (a?.[1] ?? 0);
  const { x, z } = CREEK_BRIDGE, yaw = Math.atan2(-dz, dx);
  const y = (heightAt(x - BRIDGE_HALF, z) + heightAt(x + BRIDGE_HALF, z)) / 2;
  return { at: timberFrame(x, y, z, yaw), y, yaw };
}

const num = v.pipe(v.number(), v.finite());
const Copies = v.strictObject({ world: TimberRowSchema, turntable: TimberRowSchema });
export const SiteTimberRowsSchema = v.strictObject({ bin: v.string(), bytes: num, seed: num, landing: Copies, bridge: Copies });
export type SiteTimberRows = v.InferOutput<typeof SiteTimberRowsSchema>;
/** the bake's rows, parsed strictly once */
export const SITE_TIMBER_ROWS: SiteTimberRows = v.parse(SiteTimberRowsSchema, siteJson);

/** the bake's binary (`src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const SITE_TIMBER_BAKE_URL = '/assets/pine-hollow/baked/site-timbers.bin';
const KEY = 'pine-hollow/site-timbers:bake';

/** Fetch the site timbers' bake into this shard's context (once). */
export async function loadSiteTimbers(ctx: ModelContext): Promise<void> {
  const bytes = await fetchBake(SITE_TIMBER_BAKE_URL);
  ctx.once(KEY, () => bytes);
}

/** the binary's order: the landing's copies, then the bridge's */
const ORDER = (rows: SiteTimberRows): [string, TimberSite, TimberRow][] => [
  [LANDING.name, 'world', rows.landing.world], [LANDING.name, 'turntable', rows.landing.turntable],
  [BRIDGE.name, 'world', rows.bridge.world], [BRIDGE.name, 'turntable', rows.bridge.turntable],
];

/** one copy's timber from the bake, unfinished */
export function siteTimber(ctx: ModelContext, name: string, site: TimberSite, rows: SiteTimberRows = SITE_TIMBER_ROWS): Timber {
  const blocks = new TimberBlocks(ctx.once<Uint8Array>(KEY, () => { throw new Error('[timber] loadSiteTimbers(ctx) first'); }), rows.bytes);
  for (const [n, s, row] of ORDER(rows)) {
    if (n === name && s === site) return blocks.timber(name, row);
    blocks.skip(row);
  }
  throw new Error(`[timber] the bake has no ${name} (${site})`);
}

/** the identity a copy's facts are kept by (`timberFacts` keys by object) */
export const SITE_KEYS: Readonly<Record<TimberSite, object>> = { world: {}, turntable: {} };
