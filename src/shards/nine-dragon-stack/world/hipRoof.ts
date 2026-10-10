// A hip roof (dome B's square, E169): drawn by the layout's builders (../generators/) and by the page's entry decks'
// lantern pillars (world/entries.ts), which still draw at load.
import { Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Kit, type Look } from './kit';
import { MIN, METAL } from '../util';

/** a hip roof with upturned corners, glazed tiles, a ridge with end-beasts, painted eaves and a neon eave tube */
export function hipRoof(ctx: Ctx, k: Kit, cx: number, y0: number, cz: number, w: number, d: number, h: number, up: number, tile: number, neon: number | null): void {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const rx0 = x0 + d * 0.42, rx1 = x1 - d * 0.42;
  const yr = y0 + h;
  const tl: Look = { wash: tile, kind: K.tiles, line: 1, accent: true };
  const A = new Vector3(x0, y0 + up, z1), B = new Vector3(x1, y0 + up, z1), C = new Vector3(x1, y0 + up, z0), D = new Vector3(x0, y0 + up, z0);
  const mA = new Vector3(cx, y0, z1), mC = new Vector3(cx, y0, z0);
  const R0 = new Vector3(rx0, yr, cz), R1 = new Vector3(rx1, yr, cz);
  const slant = Math.hypot(h, d / 2);
  // each long slope in two halves so its eave sags to the middle (the curve of a Chinese roof)
  k.quad4(A, mA, new Vector3(cx, yr, cz), R0, w / 2, slant, tl, 0, 0, E.u0 | E.v0);
  k.quad4(mA, B, R1, new Vector3(cx, yr, cz), w / 2, slant, tl, 0, 0, E.u1 | E.v0);
  k.quad4(C, mC, new Vector3(cx, yr, cz), R1, w / 2, slant, tl, 0, 0, E.u0 | E.v0);
  k.quad4(mC, D, R0, new Vector3(cx, yr, cz), w / 2, slant, tl, 0, 0, E.u1 | E.v0);
  k.tri(D, A, R0, tl);
  k.tri(B, C, R1, tl);
  // painted soffit and the eave fascia
  k.quad4(D, C, B, A, w, d, { wash: MIN.azurite, line: 1, accent: true });
  k.box(cx, y0 - 0.22, z1 - 0.05, w - 0.2, 0.22, 0.12, { wash: MIN.lightMalachite, line: 1, accent: true });
  k.box(cx, y0 - 0.22, z0 + 0.05, w - 0.2, 0.22, 0.12, { wash: MIN.lightMalachite, line: 1, accent: true });
  // ridge + chiwen
  k.box((rx0 + rx1) / 2, yr - 0.05, cz, rx1 - rx0 + 0.3, 0.32, 0.3, { wash: 0x245e48, line: 1, accent: true });
  for (const rx of [rx0, rx1]) {
    k.box(rx, yr + 0.2, cz, 0.3, 0.5, 0.24, { wash: 0x245e48, line: 1, accent: true });
    k.box(rx + (rx === rx0 ? -0.12 : 0.12), yr + 0.5, cz, 0.12, 0.3, 0.14, { wash: METAL.gold, line: 1, accent: true });
  }
  if (neon !== null) {
    const f = new Vector3(0, 0.35, 1).normalize();
    const lift = new Vector3(0, 0.03, 0.03);
    ctx.signs.tube(A.clone().add(lift), mA.clone().add(lift), f, 0.07, neon, 4.5);
    ctx.signs.tube(mA.clone().add(lift), B.clone().add(lift), f, 0.07, neon, 4.5);
    ctx.signs.tube(A.clone().add(lift), R0.clone().add(lift), new Vector3(-1, 0.4, 0.3).normalize(), 0.06, neon, 4.5);
    ctx.signs.tube(B.clone().add(lift), R1.clone().add(lift), new Vector3(1, 0.4, 0.3).normalize(), 0.06, neon, 4.5);
  }
}
