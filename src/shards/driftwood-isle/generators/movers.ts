import { WAVES, seaDamp } from '@wildshard/engine/world/waves';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MoverData } from '@wildshard/game/shardfile/movers';
import manifest, { BRIDGE } from '../manifest';
import { ANCHORED_BOAT, LOWERED_SEA } from '../world/sea';
import { boatColliders } from '../models/boat';
import { ropeBridgeSegments } from '../models/ropeBridge';

/** Movers run only in SF46's hybrid world, whose sea is lowered to road level (G134): the boat rides LOWERED_SEA at anchor,
 *  its boarding ladder's steps among its boxes. */
const SEA = LOWERED_SEA, BOAT = ANCHORED_BOAT;
/** Trusted build-only capture of the unchanged model's collision/rest layout on today's exact terrain. */
export function captureDriftwoodMovers(boatModule: string, bridgeModule: string): MoverData {
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Missing island terrain');
  const boxes = boatColliders(true).map((box: ColliderDesc) => { if (box.kind !== 'box') throw new Error('Boat primitive changed'); return { x: box.x, y: box.y, z: box.z, hx: box.hx, hy: box.hy, hz: box.hz, rot: box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) } }; });
  return [
    { id: 'driftwood.boat', entity: 7001, module: boatModule, kind: 'platform', at: { x: BOAT.x, y: SEA, z: BOAT.z }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes, input: [BOAT.x, SEA, BOAT.z, 0, seaDamp(SEA - terrain.heightAt(BOAT.x, BOAT.z)), ...WAVES.flat()] },
    { id: 'driftwood.bridge', entity: 7002, module: bridgeModule, kind: 'chain', at: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes: [], chain: { segments: ropeBridgeSegments(BRIDGE, terrain.heightAt), hx: 0.85, hy: 0.05, mass: 14 }, input: [0] },
  ];
}
