import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Uint32BufferAttribute, Vector2, Vector3 } from 'three';

/** the lantern's lathe: `rings` bands down the body, `segs` around; caps + tassel only on the dressed one */
export function lanternLathe(row: { readonly radius: number; readonly halfHeight: number }, rings: number, segs: number, dressing: boolean): BufferGeometry {
  const R = row.radius, H = row.halfHeight;
  const pts: Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = -1 + (2 * i) / rings;
    pts.push(new Vector2(Math.max(0.1, R * Math.sqrt(Math.max(0, 1 - t * t * 0.86))), t * H));
  }
  const parts: { g: BufferGeometry; part: number }[] = [{ g: new LatheGeometry(pts, segs), part: 0 }];
  if (dressing) {
    const cap = (y0: number, y1: number, r: number): BufferGeometry => new LatheGeometry([new Vector2(0, y0), new Vector2(r, y0), new Vector2(r, y1), new Vector2(0, y1)], 6);
    parts.push({ g: cap(H - 0.01, H + 0.05, 0.105), part: 1 });
    parts.push({ g: cap(-H - 0.05, -H + 0.01, 0.105), part: 1 });
    parts.push({ g: new LatheGeometry([new Vector2(0.012, -H - 0.05), new Vector2(0.03, -H - 0.2), new Vector2(0.04, -H - 0.36), new Vector2(0, -H - 0.36)], 4), part: 2 });
  }
  const pos: number[] = [], nrm: number[] = [], part: number[] = [], idx: number[] = [];
  let base = 0;
  for (const { g, part: p } of parts) {
    const gp = g.getAttribute('position');
    const gn = g.getAttribute('normal');
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      nrm.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      part.push(p);
    }
    const gi = g.getIndex();
    if (gi !== null) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + base);
    else for (let i = 0; i < gp.count; i++) idx.push(i + base);
    base += gp.count;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  out.setAttribute('aPart', new Float32BufferAttribute(part, 1));
  out.setIndex(new Uint32BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * A lantern string strung from `a` to `b`: the cord as a sagging polyline and the hooks the lanterns hang from, one every
 * `spacing` metres, the cord dropping `sag` metres at mid-span. Pure geometry: the caller hangs a lantern at each hook and
 * draws the cord.
 */
export function lanternString(a: Vector3, b: Vector3, spacing: number, sag: number, segs = 10): { cord: Vector3[]; hooks: Vector3[] } {
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  const cord: Vector3[] = [];
  for (let i = 0; i <= segs; i++) cord.push(at(i / segs));
  const hooks: Vector3[] = [];
  const n = Math.max(1, Math.floor(a.distanceTo(b) / Math.max(0.5, spacing)));
  for (let i = 1; i < n; i++) hooks.push(at(i / n));
  return { cord, hooks };
}

