/**
 * Bridge — the timber bridge carrying the N road over the Kunes at (0, 160) (map-01 "BRIDGE", deck −6): places the
 * Kunes bridge model (E306 / E315 M3, src/shards/nalati-grasslands/models/kunesBridge.ts), painted into its own mesh.
 * It finds its ends from the terrain, so a terrain tweak doesn't leave it floating or buried.
 *
 *   const bridge = buildBridge(ctx);  // PoiPiece: the bridge registers itself (`register`: one `place` — the deck as plank
 *                                     // slabs, rails / cribs as boxes, its floor the deck)
 */
import { PaintKit } from './paint';
import { NalatiSet } from './painted';
import { BRIDGE } from './layout';
import type { PoiCtx, PoiPiece } from './types';
import { kunesBridge } from '../models/kunesBridge';

export function buildBridge(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xb21d);
  const set = new NalatiSet(kit, ctx);
  set.paint(kunesBridge, { x: BRIDGE.x, y: BRIDGE.deckY, z: BRIDGE.z, yaw: 0 }, { width: BRIDGE.width, span: BRIDGE.span });
  const mesh = kit.mesh(sky, { ground, aoH: 0.6 });
  mesh.name = 'nalati-bridge';
  return { name: 'bridge', object: mesh, colliders: set.boxes, surface: 'wood', tris: mesh.geometry.getAttribute('position').count / 3, register: (o) => set.register({ ...o, object: mesh }) };
}
