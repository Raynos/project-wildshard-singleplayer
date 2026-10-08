import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import { markUnload } from '@wildshard/engine/boot/lastEnd';
import { setTitleArrival } from '@wildshard/engine/boot/titleArrival';
import type { SaveSlot } from '@wildshard/engine/saves/store';
import { chunkUrl, findShard } from '../shard/registry';
import { shards } from '../shard/list';
import type { ShardSlug } from '../shard/slugs.generated';
import type { SpawnPose } from '../shard/manifest';
import type { Inventory, ItemId } from '../Inventory';
import { isItemId, ITEMS } from '../bag/itemCatalog';
import type { ItemRow } from '../bag/items';

export interface TravelRequest { to: ShardSlug; mode: 'enter' | 'explore' | 'arena'; arrive?: SpawnPose }
export interface TravelHandoff {
  v: 1; from: ShardSlug | null; to: ShardSlug; mode: TravelRequest['mode'];
  arrive: SpawnPose | null; carry: readonly { id: ItemId; count: number }[]; at: number;
}
const finite = v.pipe(v.number(), v.finite());
const slug = v.custom<ShardSlug>((value) => typeof value === 'string' && shards().map((entry) => entry.slug).includes(value as ShardSlug));
const item = v.custom<ItemId>((value) => typeof value === 'string' && isItemId(value));
const schema: v.GenericSchema<unknown, TravelHandoff | null> = v.nullable(v.object({
  v: v.literal(1), from: v.nullable(slug), to: slug, mode: v.picklist(['enter', 'explore', 'arena']),
  arrive: v.nullable(v.object({ x: finite, z: finite, yaw: finite, y: v.exactOptional(finite) })),
  carry: v.array(v.object({ id: item, count: v.pipe(finite, v.integer(), v.minValue(1)) })), at: finite,
}));
export interface TravelSource { shard: ShardSlug; inventory: Inventory; rows: ReadonlyMap<string, ItemRow> }
interface TravelPorts {
  source: () => TravelSource | null;
  slot: SaveSlot<TravelHandoff | null>;
  now: () => number;
  navigate: (request: TravelRequest) => void;
}
/** Per-tab handoff. The injectable ports exercise a real write/read/delete round trip in node tests. */
export function travelService(ports: TravelPorts): { travel: (request: TravelRequest) => void; consume: (to: ShardSlug) => TravelHandoff | null } {
  return {
    travel: (request: TravelRequest): void => {
      const source = ports.source();
      const carry = source?.inventory.items.filter((line) => (source.rows.get(line.id)?.travels ?? ITEMS[line.id].travels) && line.count > 0).map(({ id, count }) => ({ id, count })) ?? [];
      const handoff: TravelHandoff = { v: 1, from: source?.shard ?? null, to: request.to, mode: request.mode, arrive: request.arrive ?? null, carry, at: ports.now() };
      // Carry is removed together, only once the receiving page has a durable handoff.
      if (ports.slot.write(handoff)) source?.inventory.takeTravel(source.rows);
      ports.navigate(request);
    },
    consume: (to: ShardSlug): TravelHandoff | null => {
      const handoff = ports.slot.read();
      ports.slot.reset();
      if (handoff === null || handoff.to !== to) return null;
      const age = ports.now() - handoff.at;
      return age >= 0 && age <= 60_000 ? handoff : null;
    },
  };
}
export function travelSlot(store = app.saves): SaveSlot<TravelHandoff | null> {
  return store.define({ key: 'travel.handoff', scope: 'session', version: 1, schema, initial: () => null });
}
let running: TravelSource | null = null;
/** The composition root binds the live Bag and rows; the cold title has no running shard. */
export function bindTravelInventory(source: TravelSource): () => void {
  running = source;
  return () => { if (running === source) running = null; };
}
const service = travelService({ source: () => running, slot: travelSlot(), now: () => Date.now(), navigate: (request) => {
  setTitleArrival({ slug: request.to, mode: request.mode, name: findShard(request.to)?.name ?? request.to });
  const url = new URL(chunkUrl(request.to));
  for (const name of ['at', 'glreload', 'x', 'z', 'yaw', 'pitch', 'explore', 'cam', 'model', 'skipintro', 'tour', 'quest', 'drop']) url.searchParams.delete(name);
  if (request.mode === 'explore') url.searchParams.set('explore', 'hub');
  // Replacing releases WebKit's previous page rather than parking its heap in the back/forward cache.
  markUnload(`shard switch to ${request.to} (fresh page)`);
  location.replace(url.toString());
} });
export function travel(request: TravelRequest): void { if (findShard(request.to) !== undefined) service.travel(request); }
export function consumeTravelHandoff(to: ShardSlug): TravelHandoff | null { return service.consume(to); }
/** Arrival goes through the target shard's Bag rules, never writes another shard's inventory directly. */
export function applyTravelCarry(handoff: TravelHandoff | null, inventory: Inventory): void {
  if (handoff?.to !== inventory.chunkId) return;
  for (const line of handoff.carry) inventory.add(line.id, line.count);
}
