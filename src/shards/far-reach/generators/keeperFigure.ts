import { BufferGeometry, BufferAttribute, Float32BufferAttribute } from 'three';
import { KEEPER_FIGURE } from '../data/keeperFigure';
import { fitModel } from './modelIntake';

function partition(source: BufferGeometry, parts: number, of: (x: number, y: number, z: number) => number, flat: boolean): BufferGeometry[] {
  const p = source.getAttribute('position'), index = source.index, triangles = Math.floor((index?.count ?? p.count) / 3);
  const side = new Uint8Array(triangles), counts = new Uint32Array(parts);
  const vertex = (i: number): number => index === null ? i : index.getX(i);
  // Match toNonIndexed's base-attribute interpretation, including normalized and half storage.
  const attributes = Object.entries(source.attributes).map(([name, attribute]) => {
    const interleaved = 'isInterleavedBufferAttribute' in attribute;
    const reader = index === null ? attribute : new BufferAttribute(interleaved ? attribute.data.array : attribute.array,
      interleaved ? attribute.data.stride : attribute.itemSize, attribute.normalized);
    return { name, attribute, reader, offset: index !== null && interleaved ? attribute.offset : 0 };
  });
  const position = attributes.find(attribute => attribute.name === 'position');
  if (position === undefined) throw new Error('Missing pivot positions');
  const coordinate = (at: number, component: number): number => position.reader.getComponent(at, position.offset + component);
  for (let t = 0; t < triangles; t++) {
    const a = vertex(t * 3), b = vertex(t * 3 + 1), c = vertex(t * 3 + 2);
    const part = of((coordinate(a, 0) + coordinate(b, 0) + coordinate(c, 0)) / 3, (coordinate(a, 1) + coordinate(b, 1) + coordinate(c, 1)) / 3, (coordinate(a, 2) + coordinate(b, 2) + coordinate(c, 2)) / 3);
    side[t] = part; counts[part] = (counts[part] ?? 0) + 3;
  }
  const offsets = new Uint32Array(parts);
  const out = Array.from({ length: parts }, (_, part) => {
    const geometry = new BufferGeometry();
    for (const { name, attribute } of attributes) geometry.setAttribute(name, new Float32BufferAttribute((counts[part] ?? 0) * attribute.itemSize, attribute.itemSize));
    return geometry;
  });
  // Read indexed source components once, directly into each exactly sized part.
  const targets = out.map(geometry => attributes.map(({ name }) => geometry.getAttribute(name)));
  for (let t = 0; t < triangles; t++) {
    const part = side[t], target = part === undefined ? undefined : targets[part];
    if (part === undefined || target === undefined) throw new Error('Missing pivot partition');
    const offset = offsets[part] ?? 0;
    for (let local = 0; local < 3; local++) {
      const at = vertex(t * 3 + local);
      for (let i = 0; i < attributes.length; i++) {
        const entry = attributes[i], destination = target[i];
        if (entry === undefined || destination === undefined) throw new Error('Missing pivot attribute');
        for (let c = 0; c < entry.attribute.itemSize; c++) destination.array[(offset + local) * entry.attribute.itemSize + c] = entry.reader.getComponent(at, entry.offset + c);
      }
    }
    offsets[part] = offset + 3;
  }
  for (const geometry of out) {
    if (flat) geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  source.dispose(); return out;
}


/** The keeper's exact four local pivot geometries; motion still belongs to the native NPC host. */
export function bakeKeeperFigure(source: BufferGeometry): readonly [BufferGeometry, BufferGeometry, BufferGeometry, BufferGeometry] {
  const fig = KEEPER_FIGURE, neck = fig.neck, [sx, sy, sz] = fig.shoulder;
  const top = fig.armTopY, slope = fig.armSlope, cut = fig.elbow;
  const [ex, ey, ez] = cut.at;
  const whole = fitModel(source, { size: fig.height, by: 'height', centre: fig.centre });
  const [body, head, arm, fore] = partition(whole, 4, (x, y) => neck !== undefined && y >= neck[1] ? 1
    : x < fig.armBelowX + slope * y && y > fig.armAboveY && y < top ? ((x - ex) * cut.axis[0] + (y - ey) * cut.axis[1] > 0 ? 3 : 2) : 0, fig.flat);
  if (body === undefined || head === undefined || arm === undefined || fore === undefined) throw new Error('Incomplete keeper pivots');
  if (neck !== undefined) head.translate(-neck[0], -neck[1], -neck[2]);
  arm.translate(-sx, -sy, -sz); fore.translate(-ex, -ey, -ez);
  return [body, head, arm, fore];
}
