import { WAVES, seaDamp } from '@wildshard/engine/world/waves';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MoverData } from '@wildshard/game/shardfile/movers';
import manifest, { BOAT_MOOR, BRIDGE, OCEAN } from '../manifest';
import { boatColliders } from '../models/boat';
import { ropeBridgeSegments } from '../models/ropeBridge';

/** Trusted build-only capture of the unchanged model's collision/rest layout on today's exact terrain. */
export function captureDriftwoodMovers(boatModule: string, bridgeModule: string): MoverData {
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Missing island terrain');
  const boxes = boatColliders().map((box: ColliderDesc) => { if (box.kind !== 'box') throw new Error('Boat primitive changed'); return { x: box.x, y: box.y, z: box.z, hx: box.hx, hy: box.hy, hz: box.hz, rot: box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) } }; });
  return [
    { id: 'driftwood.boat', entity: 7001, module: boatModule, kind: 'platform', at: { x: BOAT_MOOR.x, y: OCEAN.level, z: BOAT_MOOR.z }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes, input: [BOAT_MOOR.x, OCEAN.level, BOAT_MOOR.z, 0, seaDamp(OCEAN.level - terrain.heightAt(BOAT_MOOR.x, BOAT_MOOR.z)), ...WAVES.flat()] },
    { id: 'driftwood.bridge', entity: 7002, module: bridgeModule, kind: 'chain', at: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes: [], chain: { segments: ropeBridgeSegments(BRIDGE, terrain.heightAt), hx: 0.85, hy: 0.05, mass: 14 }, input: [0] },
  ];
}
