// Copied from the facade lab (src/dev/nd-lab/facade/material.ts, round-7-lab-facade) into the clean room.
// The facade lab's programs (a simple Jiehua Neon: P1 "ink" owns the real surface look).
//  - jiehua: flat wash × two hard bands of top light, ruled ink edges from aFace + fwidth (constant px, fading into
//    the wash when sub-pixel), the kit's patterns (slab bands, glazed tiles, bars, stripes, leaves, AC fans, slats,
//    pipe brackets, lit sign boxes), silk fog. Opaque only: no discard anywhere (the iPhone's hidden-surface removal).
//  - window: interior mapping (Spider-Man / Matrix Awakens) on ONE instanced quad per window — the reveal, the glass
//    with its mullions, a curtain, a room box with a partition and a fluorescent tube, all ruled; lit or dark.
//  The ink-wash shadow under each projection, the drip stains and the neon spill are baked into the shell's vertex
//  colours by the grammar (no transparent decals: overdraw is the phone's enemy).
import { Color, ShaderMaterial, type IUniform, Vector2 } from 'three';
import { PAINT_GLSL } from './paint';
// the baked light volume on the tower shells (lab P6)
import { LIGHTVOL_GLSL } from './light/lightvol';
import { EMIT_FOG, FOG_GLSL, NOISE_GLSL, PAPER_GLSL, type Shared } from './style';

const c = (hex: number): Color => new Color(hex);

export type Uniforms = Record<string, IUniform>;

/** the facade programs' uniforms, built on the clean room's shared ones (one object each) */
export function facadeUniforms(shared: Shared): Uniforms {
  return { ...shared.u, uInk: shared.u.uInk0, uInkFar: shared.u.uInk1, uSky: { value: c(0xbcc4d2) }, uFacadeWash: { value: c(0xe0e3ef) } };
}

// the clean room's noise + banded silk fog (style.ts), plus the facade lab's periodic ruling helper
export const COMMON_GLSL = /* glsl */ `
${NOISE_GLSL}
${FOG_GLSL}
${PAPER_GLSL}
uniform vec3 uPaintStone;
${PAINT_GLSL}
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

const VS_JIEHUA = /* glsl */ `
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
  float su = length(m3 * aTan);
  float sv = length(m3 * cross(normal, aTan));
  vFace = aFace * vec4(su, sv, su, sv);
  vec4 wp = m * vec4(pos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(transpose(inverse(m3)) * normal);
  vColor = color;
#ifdef USE_INSTANCING_COLOR
  vColor *= instanceColor;
#endif
  vPat = aPat;
  vMisc = aMisc;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

const FS_JIEHUA = /* glsl */ `
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
${LIGHTVOL_GLSL}
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
  } else if (kind == 11.0) {
    // painted facade (far LOD): the same floors and windows, as pattern only
    vec2 g = q / vec2(p2, p1);
    vec2 cell = floor(g), f = fract(g);
    vec2 fg = max(fwidth(g), vec2(1e-6));
    float det = smoothstep(2.0, 6.0, 1.0 / max(fg.x, fg.y));
    float isLit = step(h12(cell + vPat.w), 0.45);
    float win = cover1(f.x, 0.18, 0.82, fg.x) * cover1(f.y, 0.3, 0.8, fg.y);
    vec3 dark = col * vec3(0.42, 0.47, 0.58);
    vec3 cellC = mix(col, dark, win * (1.0 - isLit));
    col = mix(mix(col, dark, 0.3), cellC, det);
    emitC = vec3(1.0, 0.7, 0.38) * mix(0.45 * 0.3, win * isLit, det) * 1.15;
    lines = max(lines, ruleEvery(q.y, p1, fq.y, Wp) * 0.8);
  }

  // every concrete-ish surface of the dressing (the shell cells, far painted faces, parapet panels, plain modules and
  // slabs, AC boxes, slats, pipes) takes the painted concrete, world-anchored (walls: along x + z and up; slabs: xz),
  // so neither the cells' nor the pieces' seams show; glass, cloth, leaves, bars and signs keep their own
  if (kind != 2.0 && kind != 3.0 && kind != 4.0 && kind != 5.0 && kind != 9.0) {
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

/** the one architecture program; `shrink` = [start, end] metres for small clutter (0 = never) */
export function jiehuaMaterial(shared: Uniforms, opt: { shrink?: readonly [number, number] } = {}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...shared, uShrink: { value: new Vector2(opt.shrink?.[0] ?? 0, opt.shrink?.[1] ?? 0) } },
    vertexShader: VS_JIEHUA, fragmentShader: FS_JIEHUA, vertexColors: true,
  });
}

// ── windows: interior mapping on a unit quad (x ∈ [-0.5, 0.5], y ∈ [0, 1], facing +z), scaled to the window ──
const VS_WIN = /* glsl */ `
attribute vec4 aWin;
attribute vec3 aWall;
varying vec3 vP;
varying vec3 vWorld;
flat varying vec3 vCamL;
flat varying vec2 vSize;
flat varying vec4 vWin;
flat varying vec3 vWallC;
flat varying vec3 vTint;
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

const FS_WIN = /* glsl */ `
uniform sampler2D uSilk;
uniform float uLinePx;
uniform vec2 uLineFade;
uniform vec3 uInk;
uniform vec3 uInkFar;
uniform vec3 uSky;
uniform vec3 uShade;
uniform float uLpAmb;
varying vec3 vP;
varying vec3 vWorld;
flat varying vec3 vCamL;
flat varying vec2 vSize;
flat varying vec4 vWin;
flat varying vec3 vWallC;
flat varying vec3 vTint;
${COMMON_GLSL}
void main() {
  float W = vSize.x, H = vSize.y;
  float seed = vWin.x, lit = vWin.y, curtain = vWin.z;
  float style = floor(vWin.w + 0.5);
  float mull = mod(style, 4.0);
  float frameK = mod(floor(style / 4.0), 4.0);
  float isDoor = mod(floor(style / 16.0), 2.0);
  float Wp = uLinePx * uDpr * 0.62;
  vec3 d = normalize(vP - vCamL);
  d.z = min(d.z, -1e-3);
  vec2 fwP = max(fwidth(vP.xy), vec2(1e-5));
  float fwm = max(fwP.x, fwP.y);
  float det = smoothstep(4.0, 12.0, W / fwP.x);
  float lines = 0.0;
  // the opening's ruled cut
  float dEdge = min(min(vP.x + W * 0.5, W * 0.5 - vP.x), min(vP.y, H - vP.y));
  lines = max(lines, lineAt(dEdge, fwm, Wp * 1.1));
  // 1) the reveal: the glass sits r behind the wall face
  float r = 0.16;
  float tg = r / -d.z;
  vec3 g = vP + d * tg;
  vec3 col;
  vec3 emitC = vec3(0.0);
  float sill = mix(0.95, 0.0, isDoor);
  // lit rooms: warm amber mostly (the tint), a few cool fluorescent ones come in through vTint
  vec3 lightC = vTint;
  float hs = h11(seed * 7.1);
  bool inGlass = abs(g.x) <= W * 0.5 && g.y >= 0.0 && g.y <= H;
  if (!inGlass) {
    float tx = abs(d.x) > 1e-5 ? ((d.x > 0.0 ? W * 0.5 : -W * 0.5) - vP.x) / d.x : 1e9;
    float ty = abs(d.y) > 1e-5 ? ((d.y > 0.0 ? H : 0.0) - vP.y) / d.y : 1e9;
    float t = min(tx, ty);
    vec3 h = vP + d * t;
    float depth = -h.z;
    float shade = tx < ty ? 0.86 : (d.y > 0.0 ? 0.6 : 1.04);
    col = vWallC * shade;
    lines = max(lines, lineAt(r - depth, max(fwidth(depth), 1e-5), Wp));
  } else {
    // 2) the glass: frame + mullions by style
    vec2 gq = vec2(g.x + W * 0.5, g.y);
    float fwg = max(fwidth(gq.x), fwidth(gq.y));
    float fr = 0.045;
    float frameM = 1.0 - cover1(gq.x, fr, W - fr, fwg) * cover1(gq.y, fr, H - fr, fwg);
    float mv = 0.0, mh = 0.0;
    if (mull == 0.0) { mv = 1.0 - cover1(abs(gq.x - W * 0.5), 0.022, 99.0, fwg); mh = (1.0 - cover1(abs(gq.y - H * 0.7), 0.02, 99.0, fwg)); }
    else if (mull == 1.0) { float px = fract(gq.x / (W / 3.0) + 0.5) - 0.5; mv = 1.0 - cover1(abs(px) * W / 3.0, 0.02, 99.0, fwg); }
    else if (mull == 2.0) { mv = 1.0 - cover1(abs(gq.x - W * 0.5), 0.022, 99.0, fwg); mh = 1.0 - cover1(abs(gq.y - H * 0.5), 0.022, 99.0, fwg); }
    else { mv = 1.0 - cover1(abs(gq.x - W * 0.52), 0.03, 99.0, fwg); }
    float mullM = max(frameM, max(mv, mh));
    vec3 frameC = frameK == 0.0 ? vec3(0.1, 0.11, 0.13) : frameK == 1.0 ? vec3(0.72, 0.74, 0.74) : frameK == 2.0 ? vec3(0.2, 0.36, 0.3) : vec3(0.42, 0.18, 0.12);
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
    // the room's washes: a pale back wall (cream / mint / pale blue per seed), darker sides, a timber or tile floor
    vec3 wallR = h11(seed * 3.3) < 0.5 ? vec3(0.86, 0.8, 0.66) : (h11(seed * 5.9) < 0.5 ? vec3(0.7, 0.8, 0.72) : vec3(0.7, 0.76, 0.84));
    // a lit room reads warm whatever its paint (the blue-hour targets: every lit window is amber)
    wallR = mix(wallR, vec3(0.9, 0.8, 0.64), 0.45 * lit);
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
    // light: lit rooms glow warm, deeper toward the back; dark rooms are an ink-blue wash
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
    // glass: a pale silk reflection, strong on dark rooms and at grazing angles
    float fres = 0.06 + 0.5 * pow(1.0 - clamp(-d.z, 0.0, 1.0), 3.0);
    vec3 refl = mix(uSky * 0.34, uSky * 0.56, g.y / max(H, 0.01));
    vec3 glassC = mix(roomC, refl, fres * mix(1.0, 0.25, lit) * (1.0 - cur * 0.6));
    emitC = (litC - rc * lightC * 0.2) * lit * (1.0 - fres * 0.4) * 0.78 * (1.0 - cur * 0.5) + curLit * cur * lit * 0.45;
    col = mix(glassC, frameC, mullM);
    emitC *= 1.0 - mullM;
    float fl = lineAt(min(min(gq.x, W - gq.x), min(gq.y, H - gq.y)), fwg, Wp * 0.8);
    lines = max(lines, max(fl, max(roomLines * 0.8 * (1.0 - mullM), curLine * (1.0 - mullM))));
  }
  // far windows: collapse to their average (lit amber or the dark ink wash) instead of aliasing the room
  vec3 avgLit = lightC * vec3(0.84, 0.72, 0.58) * 0.88;
  vec3 avgDark = mix(vWallC * vec3(0.26, 0.29, 0.36), uSky * 0.4, 0.2);
  vec3 avg = mix(avgDark, avgLit, lit * (1.0 - curtain * 0.3));
  col = mix(avg, col, det);
  // (lab P6) the blue-hour ambient dims the dark rooms, the reveal and the glass, never a lit room
  col *= mix(uLpAmb, 1.0, clamp(lit, 0.0, 1.0));
  emitC = mix(avgLit * lit * 0.75, emitC, det);
  float dist = length(uCam - vWorld);
  vec3 inkC = mix(uInk, uInkFar, smoothstep(8.0, 70.0, dist));
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  col = mix(col, inkC, clamp(lines * mix(0.5, 1.0, det), 0.0, 1.0) * fade);
  vec4 fg = silkFog(vWorld, 1.0);
  gl_FragColor = vec4(col * fg.a + fg.rgb * silkPaper(gl_FragCoord.xy) + emitC * pow(max(fg.a, 1e-4), ${EMIT_FOG}), uNear / max(vViewZ, uNear));
}
`;

export function windowMaterial(shared: Uniforms): ShaderMaterial {
  return new ShaderMaterial({ uniforms: shared, vertexShader: VS_WIN, fragmentShader: FS_WIN });
}
