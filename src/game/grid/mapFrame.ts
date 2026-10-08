/**
 * A grid resident's maps in the home frame (playtest round 3). The page's minimap and full map draw in the home cell's
 * metres (the grid's overlays, `mapAt` in play.ts), while a resident shard registers its points of interest, zone names and
 * marks in its own cell's metres, as it does standalone. These facades move what a resident registers by its cell's offset
 * from the home, so Pine Hollow's THE RIDGE lands in Pine Hollow's cell and not in the home's. Everything else passes through.
 *
 *   const fullMap = shiftedFullMap(page.fullMap, cell.origin.x - home.x, cell.origin.z - home.z);
 */
import type { FullMap, MapPoi, MapZone } from '@wildshard/engine/ui/Map';
import type { MapMark } from '@wildshard/engine/ui/Minimap';

type Method = (...args: unknown[]) => unknown;
/** `service` with `overrides` in place of its own methods; every other member reads through, its methods bound to `service` */
function overlay<T extends object>(service: T, overrides: Partial<T>): T {
  if (typeof service !== 'object') return service; // a host double without the service (the play host's maps are optional to tests)
  const bound = new Map<PropertyKey, Method>();
  return new Proxy(service, {
    get(target, key) {
      if (Object.hasOwn(overrides, key)) return Reflect.get(overrides, key);
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      const known = bound.get(key); if (known !== undefined) return known;
      const method = value as Method, call: Method = (...args) => Reflect.apply(method, target, args);
      bound.set(key, call);
      return call;
    },
    set(target, key, value: unknown) { return Reflect.set(target, key, value, target); },
  });
}

const shift = <P extends { x: number; z: number }>(dx: number, dz: number) => (p: P): P => ({ ...p, x: p.x + dx, z: p.z + dz });

/** The full map for a resident whose cell sits (dx, dz) metres from the home's: its pins and zone names move by that much. */
export function shiftedFullMap(map: FullMap, dx: number, dz: number): FullMap {
  if (dx === 0 && dz === 0) return map;
  const poi = shift<MapPoi>(dx, dz), zone = shift<MapZone>(dx, dz);
  const setPois: FullMap['setPois'] = (source, opts) => { map.setPois(() => source().map(poi), opts); };
  const addPois: FullMap['addPois'] = (source) => map.addPois(() => source().map(poi));
  const setZones: FullMap['setZones'] = (zones) => { map.setZones(zones.map(zone)); };
  return overlay(map, { setPois, addPois, setZones });
}

/** what a resident's play host reaches of the minimap (ShardPlayHost.minimap) */
export interface MarkSink { setMarks: (source: (() => readonly MapMark[]) | null) => void; addMarks: (source: () => readonly MapMark[]) => () => void }
/** The minimap for a resident whose cell sits (dx, dz) metres from the home's: its marks move by that much. */
export function shiftedMinimap(minimap: MarkSink, dx: number, dz: number): MarkSink {
  if (dx === 0 && dz === 0) return minimap;
  const mark = shift<MapMark>(dx, dz);
  const setMarks: MarkSink['setMarks'] = (source) => { minimap.setMarks(source === null ? null : () => source().map(mark)); };
  const addMarks: MarkSink['addMarks'] = (source) => minimap.addMarks(() => source().map(mark));
  return overlay(minimap, { setMarks, addMarks });
}
