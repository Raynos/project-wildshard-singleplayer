/**
 * Nalati POI layout (B5, layout v2). The shard's geography — every POI anchor — lives in `src/chunks/nalatiLayout.ts`
 * (re-exported by the chunk def); this module re-exports those under the POI names and adds the placements that are
 * only POI detail (the hitching rail, the corral …).
 *
 * Coordinates: origin at the slab centre, **+z = north, +x = west** (−x = east), ±250 m. A `rot` is a yaw about +y:
 * for a building, the way its door / front faces — 0 faces −z (south), π/2 faces −x (east), π faces +z (north),
 * −π/2 faces +x (west). (The unit vector a `rot` faces is (−sin rot, −cos rot).)
 */
import {
  CAMP as CHUNK_CAMP, BRIDGE as CHUNK_BRIDGE, EAGLE_ROCK as CHUNK_EAGLE_ROCK, KURGANS as CHUNK_KURGANS, CRAGS as CHUNK_CRAGS,
  WEST_CRAGS as CHUNK_WEST_CRAGS, SNOW_LINE, SUMMER_YURTS, CAIRN, LEOPARD_CAVE, WATCHTOWER as CHUNK_WATCHTOWER,
} from '../../chunks/nalati-grasslands';

/** the kokpar field (an oval of trodden earth); the great kurgan's doorway faces west (+x), toward the bowl */
export { KOKPAR, GREAT_KURGAN_DOOR } from '../../chunks/nalati-grasslands';

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
/** the Titan's Wind Cairn (Jel Ata's threshold): a stone pile with cloth-strip poles */
export const WIND_CAIRN: PoiSpot = { x: CAIRN.x, z: CAIRN.z, rot: 0 };
/** the snow ring's two massifs: the Crags (east) and the west massif (the leopard's cave) */
export const CRAGS = { x: CHUNK_CRAGS.x, z: CHUNK_CRAGS.z, peak: CHUNK_CRAGS.peak, snowLine: SNOW_LINE };
export const WEST_CRAGS = { x: CHUNK_WEST_CRAGS.x, z: CHUNK_WEST_CRAGS.z, peak: CHUNK_WEST_CRAGS.peak, snowLine: SNOW_LINE };
/** the snow leopard's ledge cave (Aqbars' lair) on the west massif's flank; the mouth faces `rot` (NE, the valley head) */
export const CRAG_CAVE: PoiSpot = { x: LEOPARD_CAVE.x, z: LEOPARD_CAVE.z, rot: LEOPARD_CAVE.rot };
/** the ruined watchtower on the east rim */
export const WATCHTOWER: PoiSpot = { x: CHUNK_WATCHTOWER.x, z: CHUNK_WATCHTOWER.z, rot: Math.PI / 2 };


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
export const GREAT_KURGAN: Kurgan = CHUNK_KURGANS.find((k) => k.great === true) ?? { x: -191, z: 75, r: 19, h: 6.5, great: true };
/** kurgans (by index into KURGANS) with balbals on their crown — the balbal circle is cut (layout v2): these are all the
 *  shard's balbals, two to a mound (B11 wakes them) */
export const KURGAN_BALBALS = [1, 2, 3, 4, 5, 6];
