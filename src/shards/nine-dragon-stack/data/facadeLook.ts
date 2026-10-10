// Copied from the facade lab (the dev labs (deleted in E357 F7), round-7-lab-facade) into the clean room.
// The facade lab's programs (a simple Jiehua Neon: P1 "ink" owns the real surface look).
//  - jiehua: flat wash × two hard bands of top light, ruled ink edges from aFace + fwidth (constant px, fading into
//    the wash when sub-pixel), the kit's patterns (slab bands, glazed tiles, bars, stripes, leaves, AC fans, slats,
//    pipe brackets, lit sign boxes), silk fog. Opaque only: no discard anywhere (the iPhone's hidden-surface removal).
//  - window: interior mapping (Spider-Man / Matrix Awakens) on ONE instanced quad per window — the reveal, the glass
//    with its mullions, a curtain, a room box with a partition and a fluorescent tube, all ruled; lit or dark.
//  The ink-wash shadow under each projection, the drip stains and the neon spill are baked into the shell's vertex
//  colours by the grammar (no transparent decals: overdraw is the phone's enemy).
//
// SHARD-PLATFORM M3 (look-family rows): the facade programs as data for the SDK shader family
// (@wildshard/sdk/looks/shaderFamily), on the clean room's shared GLSL (data/look.ts); look/facadeMaterial.ts makes the
// materials. `@{paint}` / `@{lightvol}` splice the painted surfaces' and the light volume's GLSL.
import type { ShaderProgramRow, UniformRows } from '@wildshard/sdk/looks/shaderFamily';
import { EMIT_FOG, FOG_GLSL, NOISE_GLSL, PAPER_GLSL } from './look';

/** the facade programs' own uniforms, over the clean room's shared ones */
export const FACADE_UNIFORMS = { uSky: { rgb: 0xbcc4d2 }, uFacadeWash: { rgb: 0xe0e3ef } } as const satisfies UniformRows;

// the clean room's noise + banded silk fog (style.ts), plus the facade lab's periodic ruling helper
export const COMMON_GLSL = /* glsl */ `
${NOISE_GLSL}
${FOG_GLSL}
${PAPER_GLSL}
uniform vec3 uPaintStone;
@{paint}
uniform vec2 uTilePitch;
uniform float uNear;
uniform vec3 uWashTint;
uniform vec3 uFacadeWash;
varying float vViewZ;
// a periodic line every p metres (distance to the nearest), faded out when the pitch drops under ~4 px
float ruleEvery(float x, float p, float fw, float w) {
  float d = abs(fract(x / p + 0.5) - 0.5) * p;
  return lineAt(d, fw, w) * smoothstep(2.5, 5.0, p / max(fw, 1e-6));
}
`;

export const VS_JIEHUA = /* glsl */ `
attribute vec4 aFace;
attribute vec3 aTan;
attribute vec4 aPat;
attribute vec2 aMisc;
uniform vec3 uCam;
uniform vec2 uShrink;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec2 vMisc;
varying float vViewZ;
void main() {
  mat4 m = modelMatrix;
  vec3 pos = position;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
  // small clutter shrinks into the wall past uShrink.x .. uShrink.y (it is fog and wash there anyway)
  if (uShrink.y > 0.0) pos *= 1.0 - smoothstep(uShrink.x, uShrink.y, distance(m[3].xyz, uCam));
#endif
  mat3 m3 = mat3(m);
  // keep aFace in metres under a non-uniform instance scale: rescale by the stretch along u and along v = n × u
  // (the directions come as normalized bytes: re-normalized here)
  vec3 tn = normalize(aTan), nn = normalize(normal);
  float su = length(m3 * tn);
  float sv = length(m3 * cross(nn, tn));
  vFace = aFace * vec4(su, sv, su, sv);
  vec4 wp = m * vec4(pos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(transpose(inverse(m3)) * nn);
  vColor = color.rgb;
  // kind + 32 marks a face the instance colour leaves alone (a shack's walls under its tinted roof)
  float keep = step(31.5, aPat.x);
#ifdef USE_INSTANCING_COLOR
  vColor *= mix(instanceColor, vec3(1.0), keep);
#endif
  vPat = vec4(aPat.x - 32.0 * keep, aPat.yzw);
  vMisc = aMisc;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

export const FS_JIEHUA = /* glsl */ `
uniform float uLinePx;
uniform vec2 uLineFade;
uniform vec3 uInk;
uniform vec3 uInkFar;
uniform vec3 uLightDir;
uniform vec3 uShade;
uniform sampler2D uSilk;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec2 vMisc;
${COMMON_GLSL}
@{lightvol}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float kind = floor(vPat.x + 0.5);
  float fl = floor(vPat.w + 0.5);
  float eU0 = mod(fl, 2.0), eU1 = mod(floor(fl * 0.5), 2.0), eV0 = mod(floor(fl * 0.25), 2.0), eV1 = mod(floor(fl * 0.125), 2.0);
  vec2 q = vFace.xy;
  vec2 fq = max(fwidth(q), vec2(1e-6));
  float Wp = uLinePx * uDpr * 0.62;
  float lw = Wp * vMisc.y;
  float lines = 0.0;
  if (vMisc.y > 0.0) {
    lines = max(lines, eU0 * lineAt(q.x, fq.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - q.x, fq.x, lw));
    lines = max(lines, eV0 * lineAt(q.y, fq.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - q.y, fq.y, lw));
  }
  vec3 col = vColor * uWashTint * uFacadeWash;
  vec3 emitC = vColor * vMisc.x;
  float p1 = vPat.y, p2 = vPat.z;
  if (kind == 1.0) {
    // one bay-floor cell of tower wall (its wash, AO and neon spill are baked per vertex): the slab band at its foot
    // ruled top and bottom, a faint seam at the bay line, rain streaks under the slab lip, a drip stain under an AC
    float fh = vFace.w;
    float band = cover1(q.y, 0.0, 0.24, fq.y);
    col = mix(col, col * 0.88, band);
    float wx = vWorld.x + vWorld.z;
    // a mottled wash (weather, soot, repairs): two octaves of value noise, ±7 %
    col *= 0.93 + 0.1 * vnoise(vec2(wx * 0.45, vWorld.y * 0.3)) + 0.04 * vnoise(vec2(wx * 1.7, vWorld.y * 1.3));
    float streak = vnoise(vec2(wx * 2.1, q.y * 0.5 + 3.0)) * vnoise(vec2(wx * 0.7 + 5.0, 1.0));
    col *= 1.0 - 0.2 * smoothstep(0.2, 0.6, streak) * smoothstep(0.1, 1.0, q.y / fh);
    // rain-run striations from the slab above (dark just under the lip, fading down) and soot / splash at the foot
    float runs = smoothstep(0.5, 0.85, vnoise(vec2(wx * 6.5, 0.5))) * vnoise(vec2(wx * 1.3 + 9.0, floor(vWorld.y / 3.0)));
    col *= 1.0 - 0.28 * runs * smoothstep(0.25, 1.0, q.y / fh);
    col *= 1.0 - 0.16 * (1.0 - smoothstep(0.24, 1.1, q.y));
    // p2 packs the cell's finish (floor(p2 / 2): 0 render, 1 mosaic tile, 2 boarded panels) and its stain (the rest)
    float finish = floor(p2 * 0.5 + 1e-3);
    float stain = p2 - finish * 2.0;
    if (stain > 0.0) {
      float wob = (vnoise(vec2(q.y * 2.5, p1 * 7.0)) - 0.5) * 0.14;
      float sx = abs(q.x - p1 + wob);
      float st = (1.0 - smoothstep(0.04, 0.2 + 0.1 * (1.0 - q.y / fh), sx)) * smoothstep(0.0, 0.5 * fh, q.y) * (1.0 - smoothstep(0.62 * fh, 0.7 * fh, q.y));
      col *= 1.0 - 0.3 * stain * st;
    }
    // string courses at sill and lintel height (every cell), then the finish's own ruling
    lines = max(lines, max(lineAt(abs(q.y - 0.72), fq.y, Wp * 0.6), lineAt(abs(q.y - 2.58), fq.y, Wp * 0.6)) * 0.45);
    if (finish == 1.0) {
      float tg = max(ruleEvery(q.x, 0.3, fq.x, Wp * 0.5), ruleEvery(q.y, 0.3, fq.y, Wp * 0.5));
      lines = max(lines, tg * 0.32);
      col *= 0.96 + 0.08 * h12(floor(q / 0.3) + p1);
    } else if (finish == 2.0) {
      lines = max(lines, max(ruleEvery(q.x + 0.3, 1.25, fq.x, Wp * 0.7), lineAt(abs(q.y - 1.5), fq.y, Wp * 0.7)) * 0.55);
      col *= 0.97 + 0.07 * h12(floor(vec2(q.x / 1.25, q.y / 1.5)) + 3.0);
    } else if (finish == 3.0) {
      // timber cladding (E281): vertical planks, each its own tone, a rail at sill and lintel height
      float wx2 = vWorld.x + vWorld.z;
      lines = max(lines, ruleEvery(wx2, 0.26, fq.x, Wp * 0.55) * 0.6);
      col *= 0.9 + 0.2 * h12(vec2(floor(wx2 / 0.26), floor(vWorld.y / 3.0)));
      lines = max(lines, max(lineAt(abs(q.y - 0.8), fq.y, Wp * 0.9), lineAt(abs(q.y - 2.62), fq.y, Wp * 0.9)) * 0.7);
    }
    lines = max(lines, max(lineAt(q.y, fq.y, Wp * 1.3), lineAt(fh - q.y, fq.y, Wp * 1.3)));
    lines = max(lines, lineAt(abs(q.y - 0.24), fq.y, Wp * 0.7) * 0.75);
    lines = max(lines, max(lineAt(q.x, fq.x, Wp * 0.6), lineAt(vFace.z - q.x, fq.x, Wp * 0.6)) * 0.3);
  } else if (kind == 2.0) {
    // glazed roof tiles: courses down the slope, joints across, a tint per tile
    // the glazed-tile texture's pitch (uTilePitch) for the rulings, no running-bond jog (the barrels align)
    vec2 tp = uTilePitch;
    float cr = ruleEvery(q.y, tp.y, fq.y, Wp * 0.9);
    float cj = ruleEvery(q.x, tp.x, fq.x, Wp * 0.6) * 0.7;
    col *= 0.92 + 0.14 * h12(floor(q / tp));
    col *= paintTiles(q, tp, uPaintK.x * uPaintK.w);
    lines = max(lines, max(cr, cj));
    // (E281 pass 6) the barrels' roundness near; far and from above, a glazed roof is its barrels and their dark
    // joints averaged — a deeper, greyer glaze than one tile's, not the flat bright panel mockup D's eaves read as
    float farT = 1.0 - smoothstep(2.0, 5.0, tp.x / max(fq.x, 1e-6));
    float bx = abs(fract(q.x / tp.x) - 0.5) * 2.0;
    col *= mix(0.8 + 0.3 * (1.0 - bx * bx), 1.0, farT);
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, mix(vec3(lum), col, 0.68) * 0.72, farT);
  } else if (kind == 3.0) {
    // railings / grilles: vertical bars every p1, rails every p2 (0 = only the frame)
    float bars = ruleEvery(q.x, p1, fq.x, Wp * 0.95);
    float rails = p2 > 0.0 ? ruleEvery(q.y, p2, fq.y, Wp * 0.95) : 0.0;
    float dens = smoothstep(2.5, 5.0, p1 / fq.x);
    // a far railing drawn as a panel (a painted rail, opaque): the bars average into the wash when under 4 px
    lines = max(max(bars, rails), max(lines, (1.0 - dens) * 0.35));
  } else if (kind == 4.0) {
    // cloth: stripes every p1 (0 = plain), p2 = how white the alternate stripe is
    if (p1 > 0.0) {
      float s = cover1(fract(q.x / p1), 0.0, 0.5, fq.x / p1);
      col = mix(col, vec3(0.86, 0.84, 0.78), s * p2);
    }
    col *= 0.94 + 0.12 * vnoise(q * 3.0);
  } else if (kind == 5.0) {
    // foliage: gongbi leaves, each outlined and tinted (world-space cells)
    vec3 an = abs(n);
    vec2 lp = (an.y > max(an.x, an.z) ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy)) / 0.16;
    vec2 cc = floor(lp), fc = fract(lp);
    float d1 = 9.0, d2 = 9.0, idv = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 rr = o + vec2(h12(cc + o), h12(cc + o + 17.3)) - fc;
      float dd = dot(rr, rr);
      if (dd < d1) { d2 = d1; d1 = dd; idv = h12(cc + o + 3.1); } else if (dd < d2) { d2 = dd; }
    }
    float flw = max(fwidth(lp.x), fwidth(lp.y)) * 0.16;
    float det = smoothstep(2.0, 5.0, 0.16 / flw);
    lines = max(lines, lineAt((sqrt(d2) - sqrt(d1)) * 0.08, flw, Wp * 0.8) * det * 0.6);
    col = mix(col, col * (0.7 + 0.6 * idv), det);
  } else if (kind == 6.0) {
    // air-con front: a fan ring with a hub and a louvre grille on the left
    vec2 ctr = vec2(vFace.z * 0.66, vFace.w * 0.5);
    float rr = vFace.w * 0.36;
    float dc = length(q - ctr);
    float fwm = max(fq.x, fq.y);
    float ring = lineAt(abs(dc - rr), fwm, Wp * 0.9);
    float hub = lineAt(abs(dc - rr * 0.22), fwm, Wp * 0.7);
    float spokes = lineAt(abs(fract(atan(q.y - ctr.y, q.x - ctr.x) / 6.2831853 * 6.0 + 0.5) - 0.5) * dc * 1.047, fwm, Wp * 0.5) * step(rr * 0.22, dc) * step(dc, rr);
    float grille = ruleEvery(q.y, 0.06, fq.y, Wp * 0.6) * step(0.05, q.x) * step(q.x, vFace.z * 0.36) * step(0.05, q.y) * step(q.y, vFace.w - 0.05);
    col = mix(col, col * 0.62, step(dc, rr));
    lines = max(lines, max(max(ring, hub), max(spokes * 0.8, grille * 0.8)) * smoothstep(3.0, 8.0, rr / fwm));
  } else if (kind == 7.0) {
    // slats: louvres, roll shutters, timber boards
    lines = max(lines, ruleEvery(q.y, p1, fq.y, Wp * 0.7) * 0.85);
    col *= 0.96 + 0.08 * h12(vec2(floor(q.y / p1), vPat.w));
  } else if (kind == 8.0) {
    // drain pipe: a bracket ring every p1 of height (world y), a socket joint every 3 m
    lines = max(lines, ruleEvery(vWorld.y, p1, fwidth(vWorld.y), Wp * 1.1));
    col *= 0.9 + 0.2 * vnoise(vec2(q.x * 4.0, vWorld.y * 0.3));
  } else if (kind == 9.0) {
    // a lit sign box / lamp: emissive wash inside a ruled frame
    float ins = min(min(q.x, vFace.z - q.x), min(q.y, vFace.w - q.y));
    float inner = lineAt(abs(ins - 0.05), max(fq.x, fq.y), Wp * 0.8);
    lines = max(lines, inner);
    emitC = vColor * vMisc.x * mix(0.7, 1.0, step(0.05, ins));
  } else if (kind == 10.0) {
    // carved panel: a double inset frame
    float ins = min(min(q.x, vFace.z - q.x), min(q.y, vFace.w - q.y));
    float fwm = max(fq.x, fq.y);
    lines = max(lines, max(lineAt(abs(ins - 0.06), fwm, Wp * 0.8), lineAt(abs(ins - 0.11), fwm, Wp * 0.55)) * smoothstep(2.0, 5.0, 0.06 / fwm));
    col *= mix(1.0, 0.92, step(0.11, ins));
  } else if (kind == 12.0) {
    // tile ends (瓦当, E281): round glazed caps along an eave's lip, one every p1, the dark gaps between them
    float pc = p1 > 0.0 ? p1 : 0.2;
    float cxx = (fract(q.x / pc) - 0.5) * pc;
    float cyy = q.y - vFace.w * 0.5;
    float rr = min(pc * 0.43, vFace.w * 0.47);
    float dd = length(vec2(cxx, cyy));
    float fwm = max(fq.x, fq.y);
    float detail = smoothstep(2.0, 5.0, pc / max(fq.x, 1e-6));
    float disc = 1.0 - smoothstep(rr - fwm, rr + fwm, dd);
    col = mix(col * 0.25, col * 1.2, mix(0.66, disc, detail));
    lines = max(lines, lineAt(abs(dd - rr), fwm, Wp * 0.8) * detail);
    lines = max(lines, lineAt(abs(dd - rr * 0.45), fwm, Wp * 0.5) * detail * 0.55);
  } else if (kind == 11.0) {
    // painted facade (far LOD): the same Kowloon bays as pattern only (E281: no longer a slab's even window grid) —
    // bays of 2–3 windows, each its own tone, some timber-clad, some with a balcony on every floor (a pale slab lip, a
    // dark railing band), glazed eave stripes across the face every few floors; the face's seed rides in vPat.w ≥ 16
    float fseed = floor(fl / 16.0);
    vec2 g = q / vec2(p2, p1);
    vec2 cell = floor(g), f = fract(g);
    vec2 fg = max(fwidth(g), vec2(1e-6));
    float det = smoothstep(2.0, 6.0, 1.0 / max(fg.x, fg.y));
    float bw = 2.0 + step(0.5, h12(vec2(fseed, 1.7)));
    float bay = floor(cell.x / bw);
    float timber = step(0.72, h12(vec2(bay, fseed + 3.3)));
    float balc = step(0.5, h12(vec2(bay, fseed + 9.1)));
    col *= 0.84 + 0.26 * h12(vec2(bay, fseed + 5.7));
    col = mix(col, col * vec3(0.55, 0.42, 0.32), timber * 0.85);
    float isLit = step(h12(cell + fseed * 7.0), 0.48 + 0.12 * timber);
    // (pass 4) each cell its own opening — narrow, wide or bricked up — so the face never reads as an even grid
    float hw = h12(cell + fseed * 3.7 + 11.0);
    float wx0 = 0.14 + 0.16 * hw, wx1 = 0.86 - 0.16 * h12(cell + fseed * 5.3 + 2.0);
    float win = cover1(f.x, wx0, wx1, fg.x) * cover1(f.y, 0.3, 0.78 + 0.06 * hw, fg.y) * step(0.07, h12(cell.yx + fseed));
    // (pass 5) most cells are two small windows with a pier between, each lit or dark on its own
    float two = step(h12(cell + fseed * 2.3 + 4.0), 0.65);
    win *= 1.0 - two * cover1(f.x, 0.47, 0.55, fg.x);
    isLit = mix(isLit, step(h12(cell * 2.0 + vec2(step(0.5, f.x), 0.0) + fseed * 7.0), 0.48 + 0.12 * timber), two);
    vec3 dark = col * vec3(0.42, 0.47, 0.58);
    vec3 cellC = mix(col, dark, win * (1.0 - isLit));
    float lip = balc * cover1(f.y, 0.0, 0.07, fg.y);
    float rail = balc * cover1(f.y, 0.07, 0.34, fg.y);
    cellC = mix(cellC, col * 1.18, lip);
    cellC = mix(cellC, col * 0.32, rail * 0.8);
    float eave = step(0.8, h12(vec2(cell.y, fseed + 2.9))) * cover1(f.y, 0.85, 1.0, fg.y);
    vec3 tile = mix(vec3(0.1, 0.3, 0.23), vec3(0.11, 0.2, 0.38), step(0.8, h12(vec2(cell.y, fseed))));
    cellC = mix(cellC, tile, eave);
    // (pass 4) painted neon: now and then a vertical sign two floors tall on a bay's first column, in one of the five
    // neon hues — the far stacks keep the near walls' clutter of signs
    vec2 sc = vec2(bay, floor(cell.y / 2.0));
    float pSign = step(h12(sc + fseed * 1.3 + 7.0), 0.06) * step(cell.x - bay * bw, 0.5)
      * cover1(f.x, 0.28, 0.72, fg.x) * cover1(g.y - sc.y * 2.0, 0.25, 1.75, fg.y);
    float hn = h12(sc + fseed);
    vec3 neonC = hn < 0.2 ? vec3(1.0, 0.25, 0.64) : hn < 0.4 ? vec3(0.25, 0.9, 1.0) : hn < 0.6 ? vec3(0.2, 0.94, 0.69) : hn < 0.8 ? vec3(1.0, 0.23, 0.19) : vec3(1.0, 0.7, 0.28);
    cellC = mix(cellC, neonC * 0.35, pSign);
    col = mix(mix(col, dark, 0.3), cellC, det);
    emitC = vec3(1.0, 0.7, 0.38) * mix(0.45 * 0.3, win * isLit * (1.0 - rail * 0.6) * (1.0 - eave) * (1.0 - pSign), det) * 1.15;
    emitC += neonC * pSign * det * 1.6;
    lines = max(lines, ruleEvery(q.y, p1, fq.y, Wp) * 0.8);
  }

  // every concrete-ish surface of the dressing (the shell cells, far painted faces, parapet panels, plain modules and
  // slabs, AC boxes, slats, pipes) takes the painted concrete, world-anchored (walls: along x + z and up; slabs: xz),
  // so neither the cells' nor the pieces' seams show; glass, cloth, leaves, bars and signs keep their own
  if (kind != 2.0 && kind != 3.0 && kind != 4.0 && kind != 5.0 && kind != 9.0 && kind != 12.0) {
    vec2 wq = abs(n.y) > 0.6 ? vWorld.xz : vec2(vWorld.x + vWorld.z, vWorld.y);
    col *= pInk(paintWall(4, 2, wq, 6.0, 0.0, uPaintK.x * uPaintK.z * uPaintStone.z), uPaintInk);
  }

  // two hard bands of top light (the sky screens), never black; undersides drop to a deeper ink wash
  float ndl = dot(n, uLightDir);
  float lit = smoothstep(-0.03, 0.03, ndl - 0.08);
  vec3 albedo = col;
  col = mix(col * uShade, col, lit);
  col *= mix(1.0, 0.5, smoothstep(0.35, 0.8, -n.y));
  // (lab P6) the ambient, then warm pools from the lanterns / shops / lit windows
  col *= uLpAmb;
  col += poolAlbedo(albedo) * poolLight(vWorld, n) * uLpGain.x;
  vec3 an2 = abs(n);
  vec2 sp = an2.y > 0.6 ? vWorld.xz : (an2.x > an2.z ? vWorld.zy : vWorld.xy);
  col *= 1.0 + (texture(uSilk, sp * 0.9).r - 0.5) * 0.08;

  float dist = length(uCam - vWorld);
  vec3 inkC = mix(uInk, uInkFar, smoothstep(8.0, 70.0, dist));
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  col = mix(col, inkC, clamp(lines, 0.0, 1.0) * fade);
  vec4 fg = silkFog(vWorld, 1.0);
  // alpha = near / viewZ: the clean room's composite reads the silhouette from it
  gl_FragColor = vec4(col * fg.a + fg.rgb * silkPaper(gl_FragCoord.xy) + emitC * pow(max(fg.a, 1e-4), ${EMIT_FOG}), uNear / max(vViewZ, uNear));
}
`;

// ── windows: interior mapping on a unit quad (x ∈ [-0.5, 0.5], y ∈ [0, 1], facing +z), scaled to the window ──
// E281 pass 5 (the targets' walls carry hundreds of small, varied windows): a plain window opening is split into
// panes — 1–4 across with a pier of wall between them, and on some tall ones a small transom pane over the main one —
// and each pane rolls its own state from the window's seed: lit warm (its own hue), lit cool fluorescent, dark, a
// curtain, a roller shutter part-way down, venetian blinds. The piers are the wall (the shell's wash, paint, top light
// and light pools). Far off, every pane is drawn flat (its lit / dark / shutter colour, antialiased by coverage), so a
// wall keeps its many small windows until they are under a pixel instead of collapsing each opening into one block.
export const VS_WIN = /* glsl */ `
attribute vec4 aWin;
attribute vec3 aWall;
varying vec3 vP;
varying vec3 vWorld;
flat varying vec3 vCamL;
flat varying vec2 vSize;
flat varying vec4 vWin;
flat varying vec3 vWallC;
flat varying vec3 vTint;
flat varying vec3 vN;
varying float vViewZ;
uniform vec3 uCam;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 ax = m[0].xyz, ay = m[1].xyz, az = m[2].xyz;
  float W = length(ax), H = length(ay);
  vec3 ux = ax / W, uy = ay / H, uz = normalize(az);
  vec3 o = m[3].xyz;
  vec3 rc = uCam - o;
  vCamL = vec3(dot(rc, ux), dot(rc, uy), dot(rc, uz));
  vSize = vec2(W, H);
  vN = uz;
  vP = vec3(position.x * W, position.y * H, 0.0);
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vWin = aWin;
  vWallC = aWall;
  vTint = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  vTint = instanceColor;
#endif
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

export const FS_WIN = /* glsl */ `
uniform sampler2D uSilk;
uniform float uLinePx;
uniform vec2 uLineFade;
uniform vec3 uInk;
uniform vec3 uInkFar;
uniform vec3 uSky;
uniform vec3 uShade;
uniform vec3 uLightDir;
varying vec3 vP;
varying vec3 vWorld;
flat varying vec3 vCamL;
flat varying vec2 vSize;
flat varying vec4 vWin;
flat varying vec3 vWallC;
flat varying vec3 vTint;
flat varying vec3 vN;
${COMMON_GLSL}
@{lightvol}

// the wall between panes: the shell's wash, its painted concrete, the two bands of top light and the light pools
vec3 wallAt(vec3 wp, vec3 n) {
  vec3 col = vWallC * uWashTint * uFacadeWash;
  col *= pInk(paintWall(4, 2, vec2(wp.x + wp.z, wp.y), 6.0, 0.0, uPaintK.x * uPaintK.z * uPaintStone.z), uPaintInk);
  vec3 albedo = col;
  float tl = smoothstep(-0.03, 0.03, dot(n, uLightDir) - 0.08);
  col = mix(col * uShade, col, tl) * uLpAmb;
  return col + poolAlbedo(albedo) * poolLight(wp, n) * uLpGain.x;
}

// one pane, interior-mapped: P and camL in the pane's frame (x ∈ [-W/2, W/2], y ∈ [0, H]); writes col, emit, lines
void pane(vec3 P, vec3 camL, float W, float H, float seed, float lit, float curtain, float style, float sill,
  vec3 lightC, float shutter, float blinds, float Wp, out vec3 col, out vec3 emitC, out float lines) {
  float mull = mod(style, 4.0);
  float frameK = mod(floor(style / 4.0), 4.0);
  float isDoor = mod(floor(style / 16.0), 2.0);
  float lattice = mod(floor(style / 32.0), 2.0);
  vec3 d = normalize(P - camL);
  d.z = min(d.z, -1e-3);
  lines = 0.0;
  emitC = vec3(0.0);
  // 1) the reveal: the glass sits r behind the wall face
  float r = 0.16;
  float tg = r / -d.z;
  vec3 g = P + d * tg;
  float hs = h11(seed * 7.1);
  bool inGlass = abs(g.x) <= W * 0.5 && g.y >= 0.0 && g.y <= H;
  if (!inGlass) {
    float tx = abs(d.x) > 1e-5 ? ((d.x > 0.0 ? W * 0.5 : -W * 0.5) - P.x) / d.x : 1e9;
    float ty = abs(d.y) > 1e-5 ? ((d.y > 0.0 ? H : 0.0) - P.y) / d.y : 1e9;
    float t = min(tx, ty);
    vec3 h = P + d * t;
    float depth = -h.z;
    float shade = tx < ty ? 0.86 : (d.y > 0.0 ? 0.6 : 1.04);
    col = vWallC * shade;
    lines = lineAt(r - depth, max(fwidth(depth), 1e-5), Wp);
    return;
  }
  // 2) the glass: frame + mullions by style
  vec2 gq = vec2(g.x + W * 0.5, g.y);
  float fwg = max(fwidth(gq.x), fwidth(gq.y));
  float fr = 0.04;
  float frameM = 1.0 - cover1(gq.x, fr, W - fr, fwg) * cover1(gq.y, fr, H - fr, fwg);
  float mv = 0.0, mh = 0.0;
  if (mull == 0.0) { mv = 1.0 - cover1(abs(gq.x - W * 0.5), 0.02, 99.0, fwg); mh = (1.0 - cover1(abs(gq.y - H * 0.7), 0.02, 99.0, fwg)); }
  else if (mull == 1.0) { float px = fract(gq.x / (W / 3.0) + 0.5) - 0.5; mv = 1.0 - cover1(abs(px) * W / 3.0, 0.02, 99.0, fwg); }
  else if (mull == 2.0) { mv = 1.0 - cover1(abs(gq.x - W * 0.5), 0.02, 99.0, fwg); mh = 1.0 - cover1(abs(gq.y - H * 0.5), 0.02, 99.0, fwg); }
  else { mv = 1.0 - cover1(abs(gq.x - W * 0.52), 0.028, 99.0, fwg); }
  float mullM = max(frameM, max(mv, mh));
  if (lattice > 0.5) {
    // a timber lattice (窗格, E281): square panes of ~0.3 m, the bars as thick as the mullions
    vec2 np = max(vec2(2.0, 3.0), floor(vec2(W, H) / vec2(0.3, 0.32) + 0.5));
    vec2 pp = vec2(W, H) / np;
    vec2 ld = abs(fract(gq / pp + 0.5) - 0.5) * pp;
    mullM = max(mullM, 1.0 - cover1(min(ld.x, ld.y), 0.017, 99.0, fwg));
  }
  vec3 frameC = frameK == 0.0 ? vec3(0.1, 0.11, 0.13) : frameK == 1.0 ? vec3(0.72, 0.74, 0.74) : frameK == 2.0 ? vec3(0.2, 0.36, 0.3) : vec3(0.42, 0.18, 0.12);
  if (lattice > 0.5) frameC = vec3(0.2, 0.12, 0.08);
  // 3) the room behind: a box as wide as the window + a margin, floor at the sill, ceiling 2.8 m above the floor
  float Rw = max(W + 1.4, 2.8);
  float D = 2.6 + 2.8 * hs;
  float y0 = -sill, y1 = 2.75 - sill;
  float zb = -r - D;
  float tx = ((d.x > 0.0 ? Rw * 0.5 : -Rw * 0.5) - g.x) / (abs(d.x) > 1e-5 ? d.x : 1e-5);
  float ty = ((d.y > 0.0 ? y1 : y0) - g.y) / (abs(d.y) > 1e-5 ? d.y : 1e-5);
  float tz = (zb - g.z) / d.z;
  float t = min(min(abs(tx), abs(ty)), tz);
  vec3 h = g + d * t;
  vec3 wallR = h11(seed * 3.3) < 0.5 ? vec3(0.86, 0.8, 0.66) : (h11(seed * 5.9) < 0.5 ? vec3(0.7, 0.8, 0.72) : vec3(0.7, 0.76, 0.84));
  // a lit room reads warm whatever its paint (the blue-hour targets: every lit window is amber)
  wallR = mix(wallR, vec3(0.95, 0.78, 0.56), 0.6 * lit);
  vec3 rc;
  float eD;
  if (t == tz) { rc = wallR; eD = min(Rw * 0.5 - abs(h.x), min(h.y - y0, y1 - h.y)); }
  else if (t == abs(tx)) { rc = wallR * 0.78; eD = min(abs(h.z - zb), min(h.y - y0, y1 - h.y)); }
  else if (d.y > 0.0) { rc = wallR * 1.05; eD = min(abs(h.z - zb), Rw * 0.5 - abs(h.x)); }
  else { rc = vec3(0.46, 0.34, 0.24) * (0.9 + 0.2 * h11(seed)); eD = min(abs(h.z - zb), Rw * 0.5 - abs(h.x)); }
  float fwh = max(fwidth(h.x) + fwidth(h.y) + fwidth(h.z), 1e-5);
  float roomLines = lineAt(max(eD, 0.0), fwh, Wp * 0.9);
  // a partition / wardrobe mid-room and a scroll or calendar on the back wall
  float zf = -r - D * (0.45 + 0.25 * h11(seed * 9.1));
  float tf = (zf - g.z) / d.z;
  vec3 hf = g + d * tf;
  float fx0 = (h11(seed * 2.7) - 0.5) * Rw * 0.8, fw2 = 0.5 + 0.6 * h11(seed * 4.3);
  float fTop = y0 + 1.0 + 1.1 * h11(seed * 8.3);
  bool furn = tf < t && abs(hf.x - fx0) < fw2 && hf.y < fTop;
  if (furn) {
    rc = vec3(0.3, 0.22, 0.17);
    float fe = min(fw2 - abs(hf.x - fx0), fTop - hf.y);
    roomLines = lineAt(fe, max(fwidth(hf.x) + fwidth(hf.y), 1e-5), Wp * 0.9);
  } else if (t == tz) {
    float scroll = cover1(h.x, fx0 * -0.6 - 0.25, fx0 * -0.6 + 0.25, fwh) * cover1(h.y, y0 + 1.3, y0 + 2.2, fwh) * step(0.5, h11(seed * 6.1));
    rc = mix(rc, vec3(0.7, 0.2, 0.14), scroll);
  }
  // a fluorescent tube across the ceiling (the HK room light) or a warm pendant
  float tubeZ = -r - D * 0.35;
  float tube = 0.0;
  if (t != tz && d.y > 0.0 && t == abs(ty) && !furn) tube = cover1(h.z, tubeZ - 0.06, tubeZ + 0.06, fwh) * cover1(abs(h.x), 0.0, 0.6, fwh);
  float fall = 1.0 - 0.35 * clamp((-h.z - r) / D, 0.0, 1.0);
  vec3 litC = rc * lightC * (0.95 * fall) + lightC * tube * 2.5;
  vec3 darkC = rc * vec3(0.13, 0.15, 0.2);
  vec3 roomC = mix(darkC, litC, lit);
  // 4) the curtain just behind the glass, drawn across from one side
  float side = step(0.5, h11(seed * 1.9));
  float cx = mix(gq.x, W - gq.x, side);
  float cur = curtain > 0.0 ? cover1(cx, 0.0, curtain * W, fwg) : 0.0;
  vec3 curC = h11(seed * 12.7) < 0.4 ? vec3(0.78, 0.7, 0.52) : (h11(seed * 13.1) < 0.5 ? vec3(0.6, 0.18, 0.12) : vec3(0.42, 0.56, 0.66));
  vec3 curLit = curC * mix(0.25, 1.0, lit) * mix(vec3(1.0), lightC, lit * 0.6);
  roomC = mix(roomC, curLit, cur);
  roomLines *= 1.0 - cur;
  float curLine = curtain > 0.0 ? lineAt(abs(cx - curtain * W), fwg, Wp * 0.7) : 0.0;
  curLine = max(curLine, cur * ruleEvery(cx, 0.09, fwg, Wp * 0.5) * 0.35);
  // venetian blinds: slats every 5 cm, the lamp glowing between them
  float bl = blinds * (1.0 - cur);
  float slat = bl * ruleEvery(gq.y, 0.05, fwg, Wp * 0.9);
  roomC = mix(roomC, mix(vec3(0.7, 0.68, 0.6), lightC, lit * 0.7) * mix(0.3, 0.95, lit), bl * 0.7);
  // glass: a pale silk reflection, strong on dark rooms and at grazing angles
  float fres = 0.06 + 0.5 * pow(1.0 - clamp(-d.z, 0.0, 1.0), 3.0);
  vec3 refl = mix(uSky * 0.34, uSky * 0.56, g.y / max(H, 0.01));
  vec3 glassC = mix(roomC, refl, fres * mix(1.0, 0.25, lit) * (1.0 - cur * 0.6));
  emitC = (litC - rc * lightC * 0.2) * lit * (1.0 - fres * 0.4) * 0.78 * (1.0 - cur * 0.5) * (1.0 - bl * 0.35) + curLit * cur * lit * 0.45;
  col = mix(glassC, frameC, mullM);
  emitC *= 1.0 - mullM;
  float fl = lineAt(min(min(gq.x, W - gq.x), min(gq.y, H - gq.y)), fwg, Wp * 0.8);
  lines = max(fl, max(roomLines * 0.8 * (1.0 - mullM) * (1.0 - bl), max(curLine, slat * 0.8) * (1.0 - mullM)));
  // 5) a roller shutter drawn down from the lintel over part of the opening
  float sy = H * (1.0 - shutter);
  if (shutter > 0.0 && P.y > sy) {
    col = vec3(0.4, 0.43, 0.43) * (0.92 + 0.12 * h11(floor(P.y / 0.07) + seed));
    emitC = vec3(0.0);
    lines = max(ruleEvery(P.y, 0.07, fwidth(P.y), Wp * 0.6) * 0.7, lineAt(abs(P.y - sy), fwidth(P.y), Wp));
  }
}

void main() {
  float W = vSize.x, H = vSize.y;
  float seed = vWin.x, lit = vWin.y, curtain = vWin.z;
  float style = floor(vWin.w + 0.5);
  float isDoor = mod(floor(style / 16.0), 2.0);
  float lattice = mod(floor(style / 32.0), 2.0);
  float Wp = uLinePx * uDpr * 0.62;
  vec2 fwP = max(fwidth(vP.xy), vec2(1e-5));
  // ── the panes: 1–4 across (a pier of wall between), a transom over some tall ones ──
  float split = (1.0 - isDoor) * (1.0 - lattice);
  float n = split > 0.5 ? clamp(floor(W / 0.62), 1.0, 4.0) : 1.0;
  float pier = n > 1.0 ? 0.17 : 0.0;
  float pw = (W - pier * (n - 1.0)) / n;
  float xx = vP.x + W * 0.5;
  float kx = clamp(floor(xx / (pw + pier)), 0.0, n - 1.0);
  float xl = xx - kx * (pw + pier);
  float hasT = split * step(1.3, H) * step(h11(seed * 4.7 + 0.3), 0.4);
  float yT = H * 0.68, band = 0.12;
  float ky = hasT > 0.5 && vP.y > yT ? 1.0 : 0.0;
  float y0p = ky > 0.5 ? yT + band * 0.5 : 0.0;
  float y1p = hasT > 0.5 && ky < 0.5 ? yT - band * 0.5 : H;
  float pH = y1p - y0p;
  // ── each pane's own state (an unsplit window keeps its instance's: the light pools read it) ──
  bool one = n < 1.5 && hasT < 0.5;
  float ps = one ? seed : seed + kx * 17.3 + ky * 5.1 + 0.7;
  float hp = h11(ps * 1.37 + 0.5), h2 = h11(ps * 3.91 + 1.3), h3 = h11(ps * 6.13 + 2.1);
  float litP = one ? lit : lit > 0.0 ? (hp < 0.86 ? lit : 0.0) : (hp < 0.24 ? 0.95 : 0.0);
  float curP = one ? curtain : (h3 < 0.4 ? mix(0.2, 0.7, h11(ps * 5.3)) : 0.0);
  bool cool = split > 0.5 && h2 < 0.08;
  float shutter = split > 0.5 && h2 > 0.08 && h2 < 0.2 ? mix(0.25, 1.0, h11(ps * 7.7)) : 0.0;
  float blinds = split > 0.5 && h2 > 0.2 && h2 < 0.3 ? 1.0 : 0.0;
  vec3 lightC = cool ? vec3(0.78, 0.92, 1.0) : vTint * (0.9 + 0.2 * h11(ps * 9.7));
  float sill = mix(0.95, 0.0, isDoor) + y0p;
  // the pane's frame
  float pcx = -W * 0.5 + kx * (pw + pier) + pw * 0.5;
  vec3 P = vP - vec3(pcx, y0p, 0.0);
  vec3 camL = vCamL - vec3(pcx, y0p, 0.0);
  // coverage of the pane (the rest is pier / transom band: wall), antialiased; and the opening's ruled cut
  float cov = cover1(xl, 0.0, pw, fwP.x) * cover1(vP.y, y0p, y1p, fwP.y);
  float dEdge = min(min(abs(xl), abs(pw - xl)), min(abs(vP.y - y0p), abs(y1p - vP.y)));
  if (pier > 0.0) dEdge = min(dEdge, abs(pw + pier - xl));
  float det = smoothstep(4.0, 12.0, pw / fwP.x);
  vec3 col, emitC;
  float lines;
  pane(P, camL, pw, pH, ps, litP, curP, style, sill, lightC, shutter, blinds, Wp, col, emitC, lines);
  // (the ruled cut thins as the pane drops under ~5 px, so a far wall is not an ink grid)
  lines = max(lines, lineAt(dEdge, max(fwP.x, fwP.y), Wp * 1.1) * mix(0.35, 1.0, smoothstep(3.0, 8.0, pw / fwP.x)));
  // far: the pane flat (its lit amber, the dark ink wash, a shutter's grey)
  vec3 avgLit = lightC * vec3(0.84, 0.72, 0.58) * 0.88;
  vec3 avgDark = mix(vWallC * vec3(0.26, 0.29, 0.36), uSky * 0.4, 0.2);
  vec3 avg = mix(avgDark, avgLit, litP * (1.0 - curP * 0.3));
  avg = mix(avg, vec3(0.4, 0.43, 0.43), shutter);
  col = mix(avg, col, det);
  emitC = mix(avgLit * litP * 0.75 * (1.0 - shutter), emitC, det);
  // (lab P6) the blue-hour ambient dims the dark rooms, the reveal and the glass, never a lit room
  col *= mix(uLpAmb, 1.0, clamp(litP, 0.0, 1.0));
  // the pier / transom band: the wall itself
  vec3 wallC = wallAt(vWorld, normalize(vN));
  col = mix(wallC, col, cov);
  emitC *= cov;
  float dist = length(uCam - vWorld);
  vec3 inkC = mix(uInk, uInkFar, smoothstep(8.0, 70.0, dist));
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  col = mix(col, inkC, clamp(lines * mix(0.5, 1.0, det), 0.0, 1.0) * fade);
  vec4 fg = silkFog(vWorld, 1.0);
  gl_FragColor = vec4(col * fg.a + fg.rgb * silkPaper(gl_FragCoord.xy) + emitC * pow(max(fg.a, 1e-4), ${EMIT_FOG}), uNear / max(vViewZ, uNear));
}
`;

/** the facade programs' rows: the one architecture program (the caller adds `uShrink`) and the windows */
export const FACADE_PROGRAMS = {
  facade: { vertex: VS_JIEHUA, fragment: FS_JIEHUA, vertexColors: true },
  window: { vertex: VS_WIN, fragment: FS_WIN },
} as const satisfies Readonly<Record<string, ShaderProgramRow>>;
