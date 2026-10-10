import { Float32BufferAttribute, Uint16BufferAttribute, type BufferGeometry } from 'three';
import { fitGeometry } from '@wildshard/sdk/looks/modelLibrary';
import { duneMesh } from '../world/meshes';

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** A tint for the generated manta's painted facets (linear): the back × `top`, the underside lerped to `belly`. */
export interface MantaTint { top: readonly [number, number, number]; belly: readonly [number, number, number]; bellyMix: number }

/**
 * Her own body (loop 2, R6: `art/sunscar-dunes/round-11-loop-2/ref-matriarch.jpg` → Hunyuan3D-2, painted facets): a
 * sand-hided manta with spined back, curled cephalic horns and a long whip tail, 5.3 m wing tip to wing tip (×3.6 in the
 * world), nose at the code ray's (+Z, z 1.78). Skinned per vertex to the ray's five bones with the ray's own blend, so
 * a shared corner never splits: wings by |x|, the head forward of z 1.0, the tail behind the wings' trailing edge.
 */
export function mantaBody(tint: MantaTint | null = null): BufferGeometry | null {
  const source = duneMesh('dune-matriarch'); if (source === null) return null;
  const g = fitGeometry(source, { size: 5.3, by: 'span', floor: 0.05 }), b = g.boundingBox;
  if (b !== null) g.translate(0, 0, 1.78 - b.max.z);
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), z = p.getZ(i), wing = smooth((Math.abs(x) - 0.5) / 1.6), tail = smooth((-1.0 - z) / 0.5) * (1 - wing);
    const head = smooth((z - 1.0) / 0.6) * (1 - wing), body = Math.max(0, 1 - wing - tail - head);
    index.set([0, 1, x < 0 ? 2 : 3, 4], i * 4); weight.set([body, head, wing, tail], i * 4);
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  if (tint !== null && g.hasAttribute('color')) {
    const col = g.getAttribute('color');
    // round 1 (R1C-2 / R1B-15): the dune ray is this body at its own scale, a lighter hide over a pale belly, so it
    // reads against the dusk sky instead of a black kite
    if (!g.hasAttribute('normal')) g.computeVertexNormals();
    const nrm = g.getAttribute('normal');
    for (let i = 0; i < n; i++) {
      const under = smooth((-nrm.getY(i) - 0.1) / 0.5) * tint.bellyMix;
      for (let c = 0; c < 3; c++) {
        const v = (c === 0 ? col.getX(i) : c === 1 ? col.getY(i) : col.getZ(i)) * (tint.top[c] ?? 1);
        const out = v + ((tint.belly[c] ?? v) - v) * under;
        if (c === 0) col.setX(i, out); else if (c === 1) col.setY(i, out); else col.setZ(i, out);
      }
    }
    col.needsUpdate = true;
  }
  return g;
}
