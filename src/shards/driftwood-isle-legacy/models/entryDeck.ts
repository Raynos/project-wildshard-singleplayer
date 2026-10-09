/**
 * The entry road deck (G170, SHARD-PLATFORM SF46; Jake's C3-R2-C1 pick: "road decks over the water"): with G164's world
 * lowered, each of Driftwood's four midpoint entries is an asphalt road deck at road height over the sea, not a floating
 * plane. One copy per entry (world/entryDeck.ts places them), in its own frame: the cell edge's midpoint at the origin,
 * +Z running in, X across, the asphalt's top at y = 0.
 *
 * In the road's style (the boulevard's asphalt and kerb concrete, `src/game/grid/roadLook.ts`): an 8 m slab with a
 * concrete edge face, a thin fascia lip down both sides and across the inner end, white edge lines on the asphalt, and
 * three concrete bents (a cap beam on two square columns down to the seabed). Vertex colours, no texture, no shadow
 * casting. No colliders here: the socket's floor is the platform's (`installEntrySockets`) and the inner `LANDING_RUN`
 * is the shardfile's declared landing (world/sea.ts), installed as declared by the world build.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { defineModel } from '@wildshard/engine/models/model';

export interface EntryDeckParams {
  /** how far in from the cell edge the deck runs, metres (the 15 m socket and its landing) */
  readonly run: number;
  /** the seabed under the columns, own y (they stand on it) */
  readonly bed: number;
}

/** the slab's thickness under its y = 0 top */
export const DECK_SLAB = 0.55;
const CAP_DEPTH = 0.45, CAP_RUN = 0.7, COLUMN = 0.6, COLUMN_ACROSS = 2.7, FASCIA = 0.12, LIP = 0.05;
/** the road look's colours (roadLook.ts ASPHALT / KERB / WHITE), the columns a shade darker */
const ASPHALT = new THREE.Color(0x3a3c40), CONCRETE = new THREE.Color(0x9a9c98), COLUMN_GREY = new THREE.Color(0x7c7e7b), LINE = new THREE.Color(0xe9ebe6);

/** an axis-aligned box (`x0..x1` across, `z0..z1` in, `y0..y1` up), its top face one colour and every other face another */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top: THREE.Color, sides: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const normals = g.getAttribute('normal'), colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const c = normals.getY(i) > 0.5 ? top : sides;
    colours[i * 3] = c.r; colours[i * 3 + 1] = c.g; colours[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.deleteAttribute('uv');
  return g;
}

/** one deck's geometry in its own frame */
export function entryDeckGeometry(p: EntryDeckParams): THREE.BufferGeometry {
  const half = ENTRY_WIDTH / 2, run = p.run, parts: THREE.BufferGeometry[] = [];
  // the slab: asphalt on top, the concrete edge face round its sides and inner end
  parts.push(box(-half, half, -DECK_SLAB, 0, 0, run, ASPHALT, CONCRETE));
  // the fascia lip down both sides (5 cm proud of the asphalt: it reads as the deck's edge, never a step) and the inner end
  for (const s of [-1, 1]) parts.push(box(Math.min(s * half, s * (half + FASCIA)), Math.max(s * half, s * (half + FASCIA)), -DECK_SLAB - 0.08, LIP, 0, run, CONCRETE, CONCRETE));
  parts.push(box(-half - FASCIA, half + FASCIA, -DECK_SLAB - 0.08, 0, run, run + FASCIA, CONCRETE, CONCRETE));
  // white edge lines on the asphalt (the boulevard's solid edge line)
  for (const s of [-1, 1]) parts.push(box(Math.min(s * (half - 0.35), s * (half - 0.2)), Math.max(s * (half - 0.35), s * (half - 0.2)), -0.01, 0.004, 0.3, run - 0.3, LINE, LINE));
  // three bents: a cap beam under the slab on two square columns down to the seabed
  const capFoot = -DECK_SLAB - CAP_DEPTH, bed = Math.min(capFoot - 0.5, p.bed);
  for (const a of [1.4, run / 2, run - 1.4]) {
    parts.push(box(-half - 0.25, half + 0.25, capFoot, -DECK_SLAB, a - CAP_RUN / 2, a + CAP_RUN / 2, CONCRETE, CONCRETE));
    for (const s of [-1, 1]) parts.push(box(s * COLUMN_ACROSS - COLUMN / 2, s * COLUMN_ACROSS + COLUMN / 2, bed, capFoot, a - COLUMN / 2, a + COLUMN / 2, COLUMN_GREY, COLUMN_GREY));
  }
  const geometry = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return geometry;
}

export const entryDeck = defineModel<EntryDeckParams>({
  id: 'driftwood-isle/entry-deck', name: 'Entry road deck', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/entryDeck.ts', surface: 'stone',
  defaults: { run: 16.5, bed: -6 },
  variants: [
    { id: 'deep', label: 'Over deep water', params: {} },
    { id: 'shallow', label: 'Over the shallows', params: { bed: -2.5 } },
  ],
  seed: 0xdec4,
  build: (ctx, p) => {
    const material = ctx.once('driftwood-isle/entry-deck:concrete', () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
      ctx.sky.setupMaterial(m);
      return m;
    });
    return [{ geometry: entryDeckGeometry(p), material, castShadow: false, receiveShadow: true }];
  },
});
