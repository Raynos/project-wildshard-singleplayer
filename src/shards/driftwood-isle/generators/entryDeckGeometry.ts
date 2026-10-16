/**
 * The entry road decks (runtime/models/entryDeck.ts, G170), baked from their box rows (data/entryDeckBoxes.json): each box
 * merged non-indexed, its top face one colour and every other face another. Loaded as the fixed-model templates
 * `entry-deck-<world|deep|shallow>` through the shard's geometry intake.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import rows from '../data/entryDeckBoxes.json' with { type: 'json' };

function box([x0 = 0, x1 = 0, y0 = 0, y1 = 0, z0 = 0, z1 = 0, top = 0, sides = 0]: readonly number[]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed().translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const normals = g.getAttribute('normal'), colour = new THREE.Color(), colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) colour.set(rows.colours[normals.getY(i) > 0.5 ? top : sides] ?? '#ffffff').toArray(colours, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3)).deleteAttribute('uv');
  return g;
}

/** the three baked decks: the world's (its four entries share one seabed) and the Explorer's deep and shallow */
export function entryDeckGeometries(): Record<keyof typeof rows.decks, THREE.BufferGeometry> {
  const merged = (boxes: readonly (readonly number[])[]): THREE.BufferGeometry => mergeGeometries(boxes.map(box), false);
  return { world: merged(rows.decks.world), deep: merged(rows.decks.deep), shallow: merged(rows.decks.shallow) };
}
