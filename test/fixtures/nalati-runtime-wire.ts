import type { PlaceRuntimeRows } from '../../src/shards/nalati-grasslands/generators/placeRuntimeSource.mjs';
import { jsonBytes } from '../../scripts/bake-output.mjs';

/** Reconstruct the retired publication envelope only for immutable predecessor byte oracles. */
export function nalatiRuntimeWire(packet: PlaceRuntimeRows): ReadonlyMap<string, Uint8Array> {
  const floorSources = packet.floors.map((floor, index) => ({ name: floor.name, kind: 'bin', source: `data/place-floor-${String(index)}.generated.bin` }));
  if (packet.runtime === null || typeof packet.runtime !== 'object' || Array.isArray(packet.runtime)) throw new Error('Missing original runtime metadata');
  const runtime = jsonBytes({ floorSources, ...packet.runtime });
  const files = new Map<string, Uint8Array>([
    ['boot/placeRuntime.generated.json', runtime], ['data/placeRuntime.generated.json', runtime],
    ['boot/modelMetrics.generated.json', jsonBytes(packet.metrics)],
    ['data/staticCapture.generated.json', jsonBytes(packet.capture)],
    ['data/shapeBook.generated.json', jsonBytes(packet.shapeBook)],
  ]);
  for (const [index, floor] of packet.floors.entries()) files.set(`data/place-floor-${String(index)}.generated.bin`, floor.bytes);
  return files;
}
