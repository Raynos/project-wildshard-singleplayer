import { WAVES, seaDamp } from '@wildshard/engine/world/waves';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MoverData } from '@wildshard/game/shardfile/movers';
import manifest, { BOAT_MOOR, BRIDGE } from '../manifest';
import { LOWERED_SEA, WORLD_DROP } from '../world/sea';
import { boatColliders } from '../models/boat';
import { ropeBridgeSegments } from '../models/ropeBridge';

/** Movers run only in SF46's hybrid world, lowered as one by WORLD_DROP (G164): the boat rides the lowered sea at its
 *  mooring by the pier, the rope bridge hangs between the lowered banks. This build-only capture runs in Node, where no
 *  Debug row is saved, so it reads the authored field and applies the drop itself. */
const SEA = LOWERED_SEA, BOAT = BOAT_MOOR;
/** Trusted build-only capture of the unchanged model's collision/rest layout on today's exact terrain, lowered. */
export function captureDriftwoodMovers(boatModule: string, bridgeModule: string): MoverData {
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Missing island terrain');
  const ground = (x: number, z: number): number => terrain.heightAt(x, z) - WORLD_DROP;
  const boxes = boatColliders().map((box: ColliderDesc) => { if (box.kind !== 'box') throw new Error('Boat primitive changed'); return { x: box.x, y: box.y, z: box.z, hx: box.hx, hy: box.hy, hz: box.hz, rot: box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) } }; });
  return [
    { id: 'driftwood.boat', entity: 7001, module: boatModule, kind: 'platform', at: { x: BOAT.x, y: SEA, z: BOAT.z }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes, input: [BOAT.x, SEA, BOAT.z, 0, seaDamp(SEA - ground(BOAT.x, BOAT.z)), ...WAVES.flat()] },
    { id: 'driftwood.bridge', entity: 7002, module: bridgeModule, kind: 'chain', at: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes: [], chain: { segments: ropeBridgeSegments(BRIDGE, ground), hx: 0.85, hy: 0.05, mass: 14 }, input: [0] },
  ];
}
