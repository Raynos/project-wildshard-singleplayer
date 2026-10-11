import type { SimHost } from '@wildshard/engine/sim';
import { proveTerrainEntries, type TerrainEntryway } from '@wildshard/game/plugin/mover';

/** Walk every declared opening with the shipping capsule in Nalati's installed native collision world. */
export function proveNalatiEntryways(host: SimHost, entryways: readonly TerrainEntryway[], heightAt: (x: number, z: number) => number): { lanes: number; steps: number } {
  return proveTerrainEntries(host.physics, entryways, heightAt, { lanes: 23, walk: 40, start: 249, maxTicks: 800 });
}
