/**
 * Nalati POI layout (B5). The shard's geography — and so the POI anchors that are shaped into the terrain (the
 * bridge, the camp pad, Eagle Rock's knoll, the balbal knoll, the kurgan domes, the Crags, the cairn) — lives in the
 * chunk def, `src/chunks/nalati-grasslands.ts` (B0); this module re-exports those and adds the placements that are
 * only POI detail (the hitching rail, the corral, the leopard's cave, the great kurgan's door …).
 *
 * Coordinates: origin at the slab centre, **+z = north, +x = west** (−x = east), ±250 m. A `rot` is a yaw about +y:
 * for a building, the way its door / front faces — 0 faces −z (south), π/2 faces −x (east), π faces +z (north),
 * −π/2 faces +x (west). (The unit vector a `rot` faces is (−sin rot, −cos rot).)
 */
import { CAMP as CHUNK_CAMP, BRIDGE as CHUNK_BRIDGE, EAGLE_ROCK as CHUNK_EAGLE_ROCK, BALBAL_KNOLL, KURGANS as CHUNK_KURGANS, CRAGS as CHUNK_CRAGS, SNOW_LINE, SUMMER_YURTS, CAIRN } from '../../chunks/nalati-grasslands';

export interface PoiSpot { x: number; z: number; rot: number }

/** the spring camp in the valley (6 yurts, corral, hitching rail, eagle perch, ribbon pole) — the yard centre */
export const CAMP: PoiSpot = { x: CHUNK_CAMP.x, z: CHUNK_CAMP.z, rot: 0 };
/** the hitching rail where the tamed horse waits (TULPAR): rail centre; the rail runs north–south (along z) */
export const HITCHING_RAIL = { x: CAMP.x - 17, z: CAMP.z + 3, length: 6.5, height: 1.1 };
/** where a horse stands tied at the rail: on its east (road) side, nose to the rail — `face` is the unit xz direction it faces */
export const HITCH_HORSE_SPOTS: { x: number; z: number; face: { x: number; z: number } }[] = [
  { x: HITCHING_RAIL.x - 1.9, z: HITCHING_RAIL.z - 1.6, face: { x: 1, z: 0 } },
  { x: HITCHING_RAIL.x - 1.9, z: HITCHING_RAIL.z + 1.9, face: { x: 1, z: 0 } },
];
/** the round pole corral west of the yard — centre + radius (its gate faces the yard, east) */
export const CORRAL = { x: CAMP.x + 27, z: CAMP.z + 9, r: 9 };
/** timber bridge on log cribs carrying the N road over the Kunes (deck height −6, length = the corridor span) */
export const BRIDGE = { x: CHUNK_BRIDGE.x, z: CHUNK_BRIDGE.z, rot: 0, deckY: CHUNK_BRIDGE.deckY, width: 4.4, span: CHUNK_BRIDGE.span };
/** the jailau (summer) camp on the plateau, SW — 3 yurts round a hearth */
export const SUMMER_CAMP = { x: SUMMER_YURTS.x, z: SUMMER_YURTS.z };
/** the granite tor on the W rim (the Tianjie terrace view) — its top terrace is at `top` */
export const EAGLE_ROCK = { x: CHUNK_EAGLE_ROCK.x, z: CHUNK_EAGLE_ROCK.z, top: CHUNK_EAGLE_ROCK.top };
/** the ring of 9 balbals on the knoll (24 m across) */
export const BALBAL_CIRCLE = { x: BALBAL_KNOLL.x, z: BALBAL_KNOLL.z, r: 12, count: 9 };
/** the Titan's Wind Cairn (Jel Ata's threshold): a stone pile with cloth-strip poles */
export const WIND_CAIRN: PoiSpot = { x: CAIRN.x, z: CAIRN.z, rot: 0 };
/** the Crags massif (SE corner) */
export const CRAGS = { x: CHUNK_CRAGS.x, z: CHUNK_CRAGS.z, peak: CHUNK_CRAGS.peak, snowLine: SNOW_LINE };
/** the snow leopard's ledge cave (Aqbars' lair) on the Crags' plateau-facing (NW) flank; the mouth faces `rot` */
export const CRAG_CAVE: PoiSpot = { x: -160, z: -164, rot: -Math.PI * 0.75 };

// ── kurgans ─────────────────────────────────────────────────────────────────────────────────────────

export interface Kurgan {
  x: number; z: number;
  /** footprint radius (m) */
  r: number;
  /** crown height above the plateau (m) */
  h: number;
  great?: boolean;
}

/** the mounds (the terrain shapes the domes; `KurganField` adds kerbs, stones, balbals and the great one's entrance) */
export const KURGANS: Kurgan[] = CHUNK_KURGANS;
/** the great kurgan (the Golden King's tomb; B13 builds the inside) */
export const GREAT_KURGAN: Kurgan = CHUNK_KURGANS.find((k) => k.great === true) ?? { x: -140, z: -105, r: 19, h: 6.5, great: true };
/** the entrance of the great kurgan faces NW, toward where the sky road tops out on the rim */
export const GREAT_KURGAN_DOOR = -Math.PI * 0.66;
/** kurgans (by index into KURGANS) with a balbal on their crown */
export const KURGAN_BALBALS = [1, 3, 5];
