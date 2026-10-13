import { BufferGeometry, Float32BufferAttribute } from 'three';
import { fitModel } from './modelIntake';

/** Split a flat vertex-coloured geometry by triangle centroid: [below `y`, above `y`], each with flat normals; disposes the input. */
function splitAbove(g: BufferGeometry, y: number): [BufferGeometry, BufferGeometry] {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), out = [{ pos: [] as number[], col: [] as number[] }, { pos: [] as number[], col: [] as number[] }];
  for (let t = 0; t + 2 < p.count; t += 3) {
    const side = out[(p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3 > y ? 1 : 0];
    if (side) for (let v = t; v < t + 3; v++) { side.pos.push(p.getX(v), p.getY(v), p.getZ(v)); side.col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const make = (part: { pos: number[]; col: number[] } | undefined): BufferGeometry => {
    const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(part?.pos ?? [], 3)); r.setAttribute('color', new Float32BufferAttribute(part?.col ?? [], 3));
    r.computeVertexNormals(); return r;
  };
  g.dispose(); return [make(out[0]), make(out[1])];
}

/** The vane's exact rest channels; the native rotor continues to own its local 2.2 metre pivot. */
export function bakeVaneParts(source: BufferGeometry): readonly [BufferGeometry, BufferGeometry] {
  const [post, rotor] = splitAbove(fitModel(source, { size: 3.6, by: 'height', floor: 0, centre: 'base' }), 2.2);
  rotor.translate(0, -2.2, 0);
  for (const geometry of [post, rotor]) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  return [post, rotor];
}
