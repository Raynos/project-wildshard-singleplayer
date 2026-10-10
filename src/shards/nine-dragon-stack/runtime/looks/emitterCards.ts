// emitterCards — one instanced quad per light emitter (SHARD-PLATFORM M3, ex Nine Dragon's look/streaks.ts): the card's
// four corners (`aCorner`, x −1…1 by y 0…1, its positions all zero: the program places it), and per instance the
// emitter's position (`aE`), colour (`aCol`) and size and power (`aSize` = w, h, power). A wet-ground reflection or a
// glow card program lays each one out from these.
//
//   new Mesh(emitterCardsGeometry(emitters), streakMaterial)
import { Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Uint16BufferAttribute } from 'three';
import type { Emitter } from './vertexSpill';

/** An instanced card geometry with one instance per emitter (aE, aCol, aSize) over a zeroed quad with aCorner. */
export function emitterCardsGeometry(emitters: readonly Emitter[]): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  g.setAttribute('aCorner', new Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
  g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  const e = new Float32Array(emitters.length * 3), col = new Float32Array(emitters.length * 3), size = new Float32Array(emitters.length * 3);
  emitters.forEach((m, i) => {
    e.set([m.at.x, m.at.y, m.at.z], i * 3);
    col.set([m.color.r, m.color.g, m.color.b], i * 3);
    size.set([m.w, m.h, m.power], i * 3);
  });
  g.setAttribute('aE', new InstancedBufferAttribute(e, 3));
  g.setAttribute('aCol', new InstancedBufferAttribute(col, 3));
  g.setAttribute('aSize', new InstancedBufferAttribute(size, 3));
  g.instanceCount = emitters.length;
  return g;
}
