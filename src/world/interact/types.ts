/**
 * Interactables kit — the DATA schema (A2, docs/plans/DRIFTWOOD-REMASTER.md). Every chest, key, door, lever, pressure
 * plate, barrel, pickup, beacon, bench and altar on a shard is one plain-JSON row of an `InteractTable`; nothing is code
 * per placement. The rows talk to each other (and to quests) only through FLAGS — plain strings in a `Flags` store:
 *
 *   automatic flags an interactable raises           what raises it
 *   `open:<id>`                                      a chest / door opened
 *   `taken:<id>`                                     a pickup / key taken
 *   `lever:<id>`                                     a lever is pulled (toggles)
 *   `plate:<id>`                                     a plate is pressed right now (transient, never persisted)
 *   `lit:<id>`                                       a beacon lit
 *   `used:<id>`                                      a bench sat on / an altar used
 *   `key:<keyId>`                                    you hold that key (a key pickup, or a chest's loot)
 *   anything in `sets`                               the row's own extra flag(s), raised with the automatic one
 *
 * and they react through CONDITIONS (`Cond`): `{ all?, any?, none? }` over flags. A door with `opensWhen` opens by
 * itself (plates, levers); `requires` gates the E action (a locked-away strongbox, the altar's three shards); `showWhen`
 * hides a row until its condition holds (a key that appears where the sailor fell). Flags a row reads but nothing in the
 * table raises (`dead:sailor`, `talked:castaway`) are declared in `external` — `validateTable` (validate.ts) proves every
 * flag read is raised by something, every lock has a key, every id is unique: the shape a chunk upload would be checked
 * against before the server loads it as config.
 *
 * Placement: `at` is a point in a POI's local frame (`poi` + local x / z, `yaw` in the same frame; world = POI origin +
 * R_y(POI rotation) · local — the convention of Hut / Lookout / Wreck / Shrine / Cove), or `poi: 'world'` for world
 * coordinates. `anchor` names a model-supplied point (`wreck.holdDoor`) that wins over x / z when the model exports it.
 * y comes from the walkable floor there (platforms, else the terrain) unless `y` pins it (absolute) or `dy` lifts it.
 */

export type PoiId = 'world' | 'hut' | 'lookout' | 'wreck' | 'shrine' | 'cave' | 'pier';

export interface Place {
  poi: PoiId;
  x: number;
  z: number;
  /** facing in the POI's frame (radians about +Y; 0 = the model's front faces +Z) */
  yaw?: number;
  /** absolute world y — skips the floor lookup */
  y?: number;
  /** metres above the floor found at (x, z) */
  dy?: number;
  /** a model anchor name (`<poi>.<name>`, e.g. `wreck.holdDoor`); used instead of x / z / yaw when the model exports it */
  anchor?: string;
}

export interface Cond { all?: string[]; any?: string[]; none?: string[] }

/** what a chest hands out */
export type Loot =
  | { item: string; n?: number }
  | { key: string; label: string }
  | { flag: string; label: string };

interface Base {
  /** unique within the table, persisted (flags are named after it) */
  id: string;
  at: Place;
  /** the E action is refused (the prompt shows `lockedLabel`) until this holds */
  requires?: Cond;
  lockedLabel?: string;
  /** the row is not there at all (no mesh, no prompt, no collider) until this holds */
  showWhen?: Cond;
  /** extra flags raised when the row fires (with its automatic flag) */
  sets?: string[];
  /** a toast when it fires */
  toast?: string;
}

export interface ChestDef extends Base { kind: 'chest'; /** a key id; the chest is locked without `key:<lock>` */ lock?: string; loot: Loot[]; /** 'crate' (plain) | 'chest' (banded) | 'strongbox' (iron, small) */ look?: 'chest' | 'strongbox' | 'treasure' }
export interface KeyDef extends Base { kind: 'key'; key: string; label: string }
export interface DoorDef extends Base {
  kind: 'door';
  /** clear opening, metres */
  w: number; h: number;
  look: 'plank' | 'grate' | 'sluice';
  lock?: string;
  /** opens by itself while this holds (plates / levers); closes again when it stops holding unless `latch` */
  opensWhen?: Cond;
  latch?: boolean;
}
export interface LeverDef extends Base { kind: 'lever'; label?: string }
export interface PlateDef extends Base { kind: 'plate'; /** square side, metres */ size: number; by: 'player' | 'barrel' | 'any' }
export interface BarrelDef extends Base { kind: 'barrel'; /** the barrel is returned here if it strays further than this (m) from its start */ leash: number }
export interface PickupDef extends Base {
  kind: 'pickup';
  look: 'seaglass' | 'shard' | 'flint' | 'coin';
  /** an inventory item id to add (Inventory.ts ItemId) */
  item?: string;
  label: string;
  /** walk into it (feet within 1.1 m) instead of pressing E */
  touch?: boolean;
  /** tint for the glow looks (hex) */
  color?: string;
}
export interface BeaconDef extends Base { kind: 'beacon'; label: string }
export interface BenchDef extends Base { kind: 'bench'; label: string }
export interface AltarDef extends Base { kind: 'altar'; label: string; /** how many shard sockets to draw; socket i is filled while `fills[i]` is set */ fills: string[] }

export type InteractDef = ChestDef | KeyDef | DoorDef | LeverDef | PlateDef | BarrelDef | PickupDef | BeaconDef | BenchDef | AltarDef;
export type InteractKind = InteractDef['kind'];

export interface InteractTable {
  /** flags raised outside the table (quest dialogue, enemy deaths) that rows may read */
  external: string[];
  rows: InteractDef[];
}

/** the automatic flag each kind raises when it fires */
export function autoFlag(d: InteractDef): string | null {
  switch (d.kind) {
    case 'chest': case 'door': return `open:${d.id}`;
    case 'key': case 'pickup': return `taken:${d.id}`;
    case 'lever': return `lever:${d.id}`;
    case 'plate': return `plate:${d.id}`;
    case 'beacon': return `lit:${d.id}`;
    case 'bench': case 'altar': return `used:${d.id}`;
    case 'barrel': return null;
    default: return null;
  }
}

/** every flag a row can raise: its automatic flag, `sets`, a key's `key:`, a chest's key / flag loot */
export function flagsRaised(d: InteractDef): string[] {
  const out: string[] = [];
  const a = autoFlag(d); if (a !== null) out.push(a);
  if (d.sets) out.push(...d.sets);
  if (d.kind === 'key') out.push(`key:${d.key}`);
  if (d.kind === 'chest') for (const l of d.loot) { if ('key' in l) out.push(`key:${l.key}`); else if ('flag' in l) out.push(l.flag); }
  return out;
}

/** every flag a row reads */
export function flagsRead(d: InteractDef): string[] {
  const out: string[] = [];
  const add = (c: Cond | undefined) => { if (c) out.push(...(c.all ?? []), ...(c.any ?? []), ...(c.none ?? [])); };
  add(d.requires); add(d.showWhen);
  if (d.kind === 'door') add(d.opensWhen);
  if (d.kind === 'altar') out.push(...d.fills);
  if ((d.kind === 'chest' || d.kind === 'door') && d.lock !== undefined) out.push(`key:${d.lock}`);
  return out;
}

/** flags that describe a moment, not progress — never persisted */
export const TRANSIENT_PREFIXES = ['plate:'];
