import { Vector3 } from 'three';
import { SIGN_STYLES } from '../data/signs';
import type { SignPlace, SignBoardBox, SignBoardKit } from '../data/signPlacement';

/** Author-only face sizing; permanent tests compare it with the runtime sign renderer. */
export function signSize(p: SignPlace): { w: number; h: number } {
  const row = SIGN_STYLES[p.spec.style];
  const n = Array.from(p.spec.text).length, isV = p.spec.vertical;
  const fixed = row.face?.kind === 'fixed' ? row.face : null;
  const h = fixed !== null ? p.size * fixed.h : isV ? p.size * (n + 0.62) : p.size * 1.36;
  const w = fixed !== null ? p.size * fixed.w : isV ? p.size * 1.36 : p.size * (n + 0.62);
  return { w, h };
}

/** Author-only calligraphy sizing, including supplementary Unicode code points. */
export function neonSize(text: string, em: number, vertical: boolean): { w: number; h: number } {
  const n = Array.from(text).length;
  return { w: vertical ? em * 1.42 : em * (n + 0.62), h: vertical ? em * (n + 0.58) : em * 1.42 };
}

/** Exact board placement before the kit packs its native attributes. */
export function signBoardBox(p: SignPlace, w: number, h: number): SignBoardBox {
  const row = SIGN_STYLES[p.spec.style];
  const up = row.up === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const right = new Vector3().crossVectors(up, p.normal).normalize();
  const depth = p.blade === true ? 0.12 : 0.1;
  const c = p.at.clone();
  if (p.blade !== true) c.addScaledVector(p.normal, -depth / 2 + 0.01);
  return { c, right, up, normal: p.normal.clone(), hx: w / 2 + 0.05, hy: h / 2 + 0.05, hz: depth / 2 };
}

/** Put the same dark board into any writer implementing the authored contract. */
export function signBoard(kit: SignBoardKit, p: SignPlace, w: number, h: number): void {
  const b = signBoardBox(p, w, h);
  kit.boxAxes(b.c, b.right, b.up, b.normal, b.hx, b.hy, b.hz, { wash: 0x24262c, line: 1 });
}
