import { Group } from 'three';
import { Mover, swellDriver, type MoverData } from '@wildshard/sharddev/movers';
import type { ColliderDesc } from '@wildshard/sharddev/bake/placement';
import { BRIDGE } from './worldSites';
import authoredLayout from '../data/layout.json' with { type: 'json' };
import { DECLARED_SEA, WORLD_DROP } from './sea';
import { driftwoodGroundField } from './groundRows';
import { boatColliders } from './staticWorld';
import { BOAT_LAYOUT } from './boatLayout';
import { ropeBridgeSegments } from './ropeBridge';

const { BOAT_MOOR } = authoredLayout;


/** Movers run only in SF46's hybrid world, lowered as one by WORLD_DROP (G164): the boat rides the lowered sea at its
 *  mooring by the pier, the rope bridge hangs between the lowered banks. This build-only capture runs in Node, where no
 *  Debug row is saved, so it reads the manifest field, whose datum is already lowered. */
const SEA = DECLARED_SEA.level, BOAT = BOAT_MOOR;
/** Trusted build-only capture of the unchanged model's collision/rest layout on today's exact terrain, lowered. */
export function captureDriftwoodMovers(boatModule?: string, bridgeModule?: string): MoverData {
  const terrain = driftwoodGroundField();
  const ground = (x: number, z: number): number => terrain.heightAt(x, z) - WORLD_DROP;
  const boxes = boatColliders(BOAT_LAYOUT).map((box: ColliderDesc) => { if (box.kind !== 'box') throw new Error('Boat primitive changed'); return { x: box.x, y: box.y, z: box.z, hx: box.hx, hy: box.hy, hz: box.hz, rot: box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) } }; });
  const boat = new Group(); boat.name = 'driftwood.boat'; boat.position.set(BOAT.x, SEA, BOAT.z);
  const bridge = new Group(); bridge.name = 'driftwood.bridge';
  const rows = [
    new Mover(boat, { trigger: { kind: 'always' }, driver: swellDriver(SEA - ground(BOAT.x, BOAT.z)) }).toMoverData({ id: boat.name, execution: 'native', entity: 7001, kind: 'platform', at: { x: BOAT.x, y: SEA, z: BOAT.z }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes }),
    new Mover(bridge, { trigger: { kind: 'always' }, driver: { kind: 'static' } }).toMoverData({ id: bridge.name, execution: 'native', entity: 7002, kind: 'chain', at: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true, boxes: [], chain: { segments: ropeBridgeSegments(BRIDGE, ground), hx: 0.85, hy: 0.05, mass: 14 } }),
  ];
  if ((boatModule !== undefined || bridgeModule !== undefined) && (rows[0]?.module !== boatModule || rows[1]?.module !== bridgeModule)) throw new Error('Compiled fixed driver hash changed');
  return rows;
}
