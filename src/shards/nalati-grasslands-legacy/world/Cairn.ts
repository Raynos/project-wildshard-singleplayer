/**
 * Cairn — the Wind Cairn (Jel Ata the Storm Titan's threshold, B14) on the bowl's south rim: places the Wind Cairn model
 * (E306 / E315 M3, src/shards/nalati-grasslands/models/windCairn.ts — the heap, the pole bundle, the lines to the stakes;
 * its cloth strips go into `ctx.flutter`), painted into its own mesh.
 *
 *   const { piece, tieSpot } = buildCairn(ctx);   // tieSpot: where a rider stops to TIE A CLOTH STRIP (B14)
 */
import * as THREE from 'three';
import { PaintKit } from './paint';
import { NalatiSet } from './painted';
import { WIND_CAIRN } from './layout';
import type { PoiCtx, PoiPiece } from './types';
import { windCairn } from '../models/windCairn';

export function buildCairn(ctx: PoiCtx): { piece: PoiPiece; tieSpot: THREE.Vector3 } {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xca19);
  const set = new NalatiSet(kit, ctx);
  const cx = WIND_CAIRN.x, cz = WIND_CAIRN.z, gy = ground(cx, cz);
  set.paint(windCairn, { x: cx, y: gy, z: cz, yaw: 0 }, {});
  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-cairn';
  const tieSpot = new THREE.Vector3(cx + 3.6, gy, cz);
  return { piece: { name: 'cairn', object: mesh, colliders: set.boxes, surface: 'stone', tris: mesh.geometry.getAttribute('position').count / 3, register: (o) => set.register({ ...o, object: mesh }) }, tieSpot };
}
