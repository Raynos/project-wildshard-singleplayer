import { BufferAttribute, BufferGeometry } from 'three';

/** Original Hunyuan head intake and neck fit, run offline with unchanged Float32 rounding and AO colours. */
export function castawayHead(source: BufferGeometry): BufferGeometry {
  const g = source.index !== null ? source.toNonIndexed() : source;
  g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const count = p.count, pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i);
    nrm[i * 3] = n.getX(i); nrm[i * 3 + 1] = n.getY(i); nrm[i * 3 + 2] = n.getZ(i);
    if (c === null) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; continue; }
    const ao = c.itemSize === 4 ? 0.4 + 0.6 * c.getW(i) : 1;
    col[i * 3] = c.getX(i) * ao; col[i * 3 + 1] = c.getY(i) * ao; col[i * 3 + 2] = c.getZ(i) * ao;
  }
  let top = -Infinity, bot = Infinity;
  for (let i = 1; i < pos.length; i += 3) { top = Math.max(top, pos[i] ?? 0); bot = Math.min(bot, pos[i] ?? 0); }
  const neck = top - 0.7698 * (top - bot), k = 0.335 / Math.max(1e-6, top - neck);
  let cx = 0, cz = 0, countAbove = 0;
  for (let i = 0; i < count; i++) if ((pos[i * 3 + 1] ?? 0) > neck) { cx += pos[i * 3] ?? 0; cz += pos[i * 3 + 2] ?? 0; countAbove++; }
  cx /= Math.max(1, countAbove); cz /= Math.max(1, countAbove);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = ((pos[i * 3] ?? 0) - cx) * k; pos[i * 3 + 1] = ((pos[i * 3 + 1] ?? 0) - neck) * k; pos[i * 3 + 2] = ((pos[i * 3 + 2] ?? 0) - cz) * k + 0.01;
  }
  const result = new BufferGeometry();
  result.setAttribute('position', new BufferAttribute(pos, 3)); result.setAttribute('normal', new BufferAttribute(nrm, 3));
  result.setAttribute('color', new BufferAttribute(col, 3)); result.computeBoundingSphere();
  if (g !== source) g.dispose(); source.dispose();
  return result;
}
