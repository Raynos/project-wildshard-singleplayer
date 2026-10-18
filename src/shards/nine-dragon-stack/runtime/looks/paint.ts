export const FLAG = { rh: 0.62, l0: 0.64, lr: 0.28, bond: 1.1 } as const;

const f = (x: number): string => x.toFixed(3);
/** GLSL: the stone a point lies in — xy = its id (column, course), zw = its local metres */
export const FLAG_GLSL = /* glsl */ `
vec4 flagCell(vec2 p) {
  float r = floor(p.y / ${f(FLAG.rh)});
  float off = h11(r * 3.7) * ${f(FLAG.bond)};
  float L = ${f(FLAG.l0)} + ${f(FLAG.lr)} * h11(r * 9.1 + 2.0);
  float cx = floor((p.x + off) / L);
  return vec4(cx, r, p.x + off - cx * L, p.y - r * ${f(FLAG.rh)});
}
float flagLen(float r) { return ${f(FLAG.l0)} + ${f(FLAG.lr)} * h11(r * 9.1 + 2.0); }
`;

