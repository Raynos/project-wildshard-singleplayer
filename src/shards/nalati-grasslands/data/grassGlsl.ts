// SHARD-PLATFORM M3 (look-family rows): look/grass.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/grass.ts passes (another module's GLSL, a number from the layout).
export const GRASS_GLSL = {
  COMMON: /* glsl */`
uniform sampler2D tHeight; uniform sampler2D tMask; uniform sampler2D tField; uniform sampler2D tGround; uniform sampler2D tTiles;
uniform vec4 uHXf;   // x, z origin (m), 1 / size (1/m), texel count
uniform vec4 uFXf;   // lattice origin x, z (m), 1 / cell (1/m), corner count
float gHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 gHash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(gHash12(i), gHash12(i + vec2(1, 0)), u.x), mix(gHash12(i + vec2(0, 1)), gHash12(i + vec2(1, 1)), u.x), u.y); }
float gFbm(vec2 p) { return gNoise(p) * .5 + gNoise(p * 2.03 + 17.1) * .25 + gNoise(p * 4.1 - 9.3) * .125; }
vec2 hUV(vec2 xz) { return (xz - uHXf.xy) * uHXf.z; }
vec2 fUV(vec2 xz) { return ((xz - uFXf.xy) * uFXf.z + 0.5) / uFXf.w; }
float groundH(vec2 xz) { return texture(tHeight, hUV(xz)).r; }
`,
  LIGHT: /* glsl */`
uniform vec3 uPSunDir; uniform vec3 uPSunRef; uniform vec3 uSunView;
uniform vec3 uHemiSky; uniform vec3 uHemiGround; uniform float uHemiI; uniform float uGrassGain; uniform float uGrassSat; uniform vec3 uGrassTint;
vec3 gMood(vec3 c) { return mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uGrassSat) * uGrassTint; }
vec3 gLight(vec3 n, float wrap, float sh) {
  float ndl = clamp((dot(n, uPSunDir) + wrap) / (1. + wrap), 0., 1.) * sh;
  vec3 amb = mix(uHemiGround, uHemiSky, n.y * .5 + .5) * uHemiI * 1.75;
  return (uPSunRef * (0.78 / 2.8) * ndl + amb) * uGrassGain;
}
`,
  BLADE_VS: /* glsl */`
@{COMMON}
@{LOOK_BAKE_GLSL}
@{WIND_GLSL}
@{TRAMPLE_GLSL}
attribute float aT; attribute float aSide;
uniform float uSpacing; uniform float uPerSide; uniform float uWidth; uniform float uFade0; uniform float uFade1;
uniform vec4 uHole;       // inner ring square: centre x, z, half size, on
uniform vec3 uNear;       // the card ring's hand-over: r0, r1, the share of blades kept under the cards (1 = no cards)
uniform float uTime;
varying float vT; varying vec3 vFogWorldPos; varying float vFogDepth; varying vec3 vN; varying vec3 vCol; varying float vSelf; varying float vSh;
void main() {
  vec3 camL = cameraPosition - modelMatrix[3].xyz; // the camera in the grass's own frame (a grid cell's offset; zero standalone)
  float per = uPerSide * uPerSide;
  float tile = floor(float(gl_InstanceID) / per);
  float id = float(gl_InstanceID) - tile * per;
  vec2 origin = texelFetch(tTiles, ivec2(int(tile), 0), 0).xy;
  vec2 cell = origin + vec2(mod(id, uPerSide), floor(id / uPerSide)) * uSpacing;
  vec2 xz = cell + gHash22(cell * 1.731) * uSpacing;
  vec4 fld = texture(tField, fUV(xz));
  vec4 msk = texture(tMask, hUV(xz));
  float r = gHash12(cell + 7.13);
  float patchN = gFbm(xz * .09);
  // the field's height (m), through the road verge (tMask.g) and the fine cut-outs (tMask.r)
  float H0 = fld.r * 1.5;
  H0 = mix(min(H0, 0.22), H0, msk.g) * msk.r;
  // tufty, not a hedge: most blades well under the field height, a few reach it (the field height is what hides you)
  float h = H0 * mix(.32, 1.08, r * r) * mix(.75, 1.15, patchN);
  vec2 dh = abs(xz - uHole.xy);
  if (uHole.w > .5 && max(dh.x, dh.y) < uHole.z) h = 0.;
  float dist = length(xz - camL.xz);
  h *= 1. - smoothstep(uFade0, uFade1, dist);
  // under the painted near cards most blades stand down (the few left are slim), so no big dark spikes at the feet
  float nearK = max(smoothstep(uNear.x, uNear.y, dist), 1. - smoothstep(.24, .4, H0)); // short turf keeps its blades (no cards there)
  h *= step(gHash12(cell + 2.21), mix(uNear.z, 1., nearK));
  if (h < .04) { gl_Position = vec4(0., 0., -2., 1.); return; }
  // facing: random, half turned toward the camera so no blade goes edge-on
  float ang = gHash12(cell + 3.3) * 6.2831;
  vec2 f = vec2(cos(ang), sin(ang));
  vec2 toCam = normalize(camL.xz - xz + 1e-4);
  f = normalize(mix(f, toCam, .55));
  vec2 side = vec2(-f.y, f.x);
  // one bend vector (radians × direction): a lean of its own + the Wind's gusts and flutter + the trample
  vec2 B = (gHash22(cell + 9.1) - .5) * .7 + f * .12;
  float g = windGust(xz);
  float push = (0.04 + uWindSpeed * 0.03) * (0.35 + 1.25 * g * uWindGustiness + (1.0 - uWindGustiness) * 0.3);
  float flut = sin(uWindTime * (3.5 + 3.0 * r) + xz.x * 2.1 + xz.y * 1.7 + r * 6.28) * (0.03 + uWindSpeed * 0.007);
  B += uWindDir * push + vec2(-uWindDir.y, uWindDir.x) * flut;
  B += trampleBend(xz);
  float bl = length(B), th = min(bl, 1.55);
  vec2 bd = B / max(bl, 1e-4);
  float t = aT;
  float a = th * t;
  float along = th < 1e-3 ? 0. : (1. - cos(a)) / th * h;
  float up = th < 1e-3 ? t * h : sin(a) / th * h;
  vec3 root = vec3(xz.x, groundH(xz) - .03, xz.y);
  float wdt = uWidth * mix(.7, 1.3, gHash12(cell + 1.7)) * (1. - t * .85) * mix(.55, 1., nearK);
  vec3 p = root + vec3(bd.x * along, up, bd.y * along) + vec3(side.x, 0., side.y) * aSide * wdt * .5;
  vec3 fn = normalize(vec3(f.x, 0., f.y) + vec3(side.x, 0., side.y) * aSide * .6);
  vN = normalize(mix(fn, vec3(0., 1., 0.), .35));
  // colour: the root sunk into the painted ground → the tip, olive / green / gold by patch and the field's tone
  vec3 gnd = texture(tGround, fUV(xz)).rgb;
  float tone = fld.g;
  // the valley (low tone) is lush: a deeper, cooler green and few gold patches; the plateau keeps its olive / gold
  float lush = 1. - smoothstep(.3, .55, tone);
  vec3 tipA = mix(vec3(.5, .56, .1), vec3(.3, .5, .11), lush), tipB = vec3(.74, .6, .15), tipC = mix(vec3(.22, .36, .08), vec3(.12, .29, .07), lush);
  float gold = clamp(smoothstep(.42, .78, gFbm(xz * .21 + 11.)) * .85 + tone * .45, 0., 1.) * (1. - .7 * lush);
  vec3 tip = mix(mix(tipC, tipA, smoothstep(.2, .6, patchN)), tipB, gold);
  tip = mix(tip, vec3(.72, .62, .32), step(.92 + .06 * lush, gHash12(cell + 4.4)) * .8);     // a dry straw blade here and there
  tip *= mix(.65, 1.2, r);
  vec3 rootC = mix(vec3(.02, .04, .012), gnd * .35, .35);
  vCol = mix(rootC, tip, smoothstep(0., .85, t));
  vSelf = mix(.3, 1., pow(t, .9)) * mix(.6, 1., r);
  vT = t;
  vFogWorldPos = p + modelMatrix[3].xyz;
  vSh = bakedShadow(p + vec3(0., .12, 0.));   // the static bake
  vSelf *= mix(bakedContact(root), 1., t * .5);   // the contact shade under the yurts / rocks / trunks, most at the roots
  vec4 mv = viewMatrix * vec4(p + modelMatrix[3].xyz, 1.);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
  BLADE_FS: /* glsl */`
@{LIGHT}
#include <fog_pars_fragment>
varying float vT; varying vec3 vN; varying vec3 vCol; varying float vSelf; varying float vSh;
void main() {
  vec3 v = normalize(vFogWorldPos - cameraPosition);
  float back = pow(clamp(dot(v, uSunView), 0., 1.), 4.) * vT * vT;      // translucent against the sun
  vec3 lit = vCol * gLight(normalize(vN), .25, vSh) * .8 + uPSunRef * (0.78 / 2.8) * back * vec3(.55, .5, .08) * .9 * uGrassGain * vSh;
  gl_FragColor = vec4(gMood(lit * vSelf), 1.);
  #include <fog_fragment>
}`,
  FLOWER_VS: /* glsl */`
@{COMMON}
@{LOOK_BAKE_GLSL}
uniform float uSpacing; uniform float uPerSide; uniform float uFade0; uniform float uFade1; uniform float uTime; uniform vec3 uNear;
varying vec2 vUv; varying float vType; varying vec3 vFogWorldPos; varying float vFogDepth; varying float vSeed; varying float vSh;
void main() {
  vec3 camL = cameraPosition - modelMatrix[3].xyz; // the camera in the grass's own frame (a grid cell's offset; zero standalone)
  float per = uPerSide * uPerSide;
  float tile = floor(float(gl_InstanceID) / per);
  float id = float(gl_InstanceID) - tile * per;
  vec2 origin = texelFetch(tTiles, ivec2(int(tile), 0), 0).xy;
  vec2 cell = origin + vec2(mod(id, uPerSide), floor(id / uPerSide)) * uSpacing;
  vec2 xz = cell + gHash22(cell * 2.917) * uSpacing;
  vec4 fld = texture(tField, fUV(xz));
  vec4 msk = texture(tMask, hUV(xz));
  float H0 = fld.r * 1.5 * msk.r * msk.g;
  float r = gHash12(cell + 5.1), r2 = gHash12(cell + 8.7);
  // which flower (if any): drifts from the field's bloom, the drift's own species, a third strays
  float keep = step(r, 0.16 + 0.84 * fld.b) * step(0.18, H0);
  bool plateau = fld.g > 0.5;
  float sp = fld.a;
  float own = plateau ? (sp < .3 ? 1. : sp < .75 ? 2. : 3.) : (sp < .5 ? 3. : sp < .85 ? 2. : 1.);
  float kind = r2 < .65 ? own : 1. + mod(floor((r2 - .65) / .35 * 3.), 3.);
  // 1 sage → the lupine spike · 2 white → daisy (edelweiss on the plateau) · 3 buttercup
  float type = kind < 1.5 ? 2. : kind < 2.5 ? (plateau ? 3. : 1.) : 0.;
  float dist = length(xz - camL.xz);
  float s = keep * (1. - smoothstep(uFade0, uFade1, dist)) * smoothstep(uNear.x, uNear.y, dist); // the near cards carry the flowers at the feet
  if (s < .05) { gl_Position = vec4(0., 0., -2., 1.); return; }
  // the heads ride just above the grass (a drift reads from afar), smaller in short turf
  float h = (type == 2. ? mix(.3, .5, r) : mix(.18, .34, r)) * clamp(H0 * 1.1, .5, 1.1);
  h *= 1.25;
  float w = type == 2. ? h * .34 : h * .55;
  w *= 1. + dist * .006 * step(type, 1.5); h *= 1. + dist * .003;
  vec2 toCam = normalize(camL.xz - xz); vec2 right = vec2(toCam.y, -toCam.x);
  float sway = sin(uTime * 2. + r * 30.) * .03 * position.y;
  vec3 p = vec3(xz.x, groundH(xz) - .02, xz.y) + vec3(right.x, 0., right.y) * (position.x * w + sway) + vec3(0., position.y * h * s, 0.);
  vUv = position.xy + vec2(.5, 0.); vType = type; vFogWorldPos = p + modelMatrix[3].xyz; vSeed = r;
  vSh = bakedShadow(p + vec3(0., .12, 0.)) * bakedContact(p) + 0.001;
  vec4 mv = viewMatrix * vec4(p + modelMatrix[3].xyz, 1.);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
  FLOWER_FS: /* glsl */`
@{LIGHT}
#include <fog_pars_fragment>
varying vec2 vUv; varying float vType; varying float vSeed; varying float vSh;
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
void main() {
  vec2 p = vUv;
  vec3 col; float a = 0.;
  float stem = 1. - smoothstep(.02, .045, sdSeg(p, vec2(.5, 0.), vec2(.5 + (vSeed - .5) * .1, .8)));
  vec3 stemC = vec3(.13, .3, .06);
  if (vType < .5) {            // buttercup
    vec2 q = p - vec2(.5 + (vSeed - .5) * .1, .82); float ang = atan(q.y, q.x); float rr = length(q);
    float petal = .15 + .04 * cos(ang * 5.);
    float head = 1. - smoothstep(petal - .02, petal + .02, rr);
    col = mix(vec3(1., .78, .06), vec3(1., .92, .35), 1. - smoothstep(0., .12, rr)); a = max(head, stem * .9);
    col = mix(stemC, col, head);
  } else if (vType < 1.5) {    // daisy
    vec2 q = p - vec2(.5 + (vSeed - .5) * .1, .8); float ang = atan(q.y, q.x); float rr = length(q);
    float petal = .2 + .06 * cos(ang * 11.);
    float head = 1. - smoothstep(petal - .02, petal + .02, rr);
    float eye = 1. - smoothstep(.05, .07, rr);
    col = mix(vec3(.97, .96, .9), vec3(1., .78, .1), eye); a = max(head, stem * .9);
    col = mix(stemC, col, head);
  } else if (vType < 2.5) {    // lupine spike: a staggered column of florets tapering to the tip
    float rows = 9.; float ry = (p.y - .45) / .5 * rows; float ri = floor(ry);
    float taper = mix(.2, .07, clamp(ri / rows, 0., 1.));
    float off = mod(ri, 2.) < .5 ? -.07 : .07;
    vec2 c1 = vec2(.5 + off * (1. - ri / rows), .45 + (ri + .5) / rows * .5);
    float fl = 1. - smoothstep(taper * .55, taper * .55 + .03, length((p - c1) * vec2(1., 1.6)));
    vec2 c2 = vec2(.5 - off * (1. - ri / rows), c1.y);
    fl = max(fl, 1. - smoothstep(taper * .55, taper * .55 + .03, length((p - c2) * vec2(1., 1.6))));
    fl *= step(.45, p.y) * step(p.y, .95);
    col = mix(vec3(.16, .10, .45), vec3(.45, .34, .80), smoothstep(.45, 1., p.y) * .7 + fract(ry) * .3);
    a = max(fl, stem);
    col = mix(stemC, col, fl);
  } else {                     // edelweiss
    vec2 q = p - vec2(.5, .78); float ang = atan(q.y, q.x); float rr = length(q);
    float star = 1. - smoothstep(.0, .03, rr - (.1 + .1 * pow(abs(cos(ang * 3.)), 3.)));
    col = mix(vec3(.95, .95, .88), vec3(.9, .85, .45), 1. - smoothstep(.03, .06, rr)); a = max(star, stem);
    col = mix(stemC, col, star);
  }
  if (a < .5) discard;
  gl_FragColor = vec4(gMood(col * gLight(vec3(0., 1., 0.), .5, vSh) * .6), 1.);
  #include <fog_fragment>
}`,
  CARD_VS: /* glsl */`
@{COMMON}
@{LOOK_BAKE_GLSL}
@{WIND_GLSL}
@{TRAMPLE_GLSL}
attribute float aQ;       // which of the 3 crossed quads (0, 1, 2 → 0°, 60°, 120° round the clump's own turn)
uniform float uSpacing; uniform float uPerSide; uniform vec3 uNear; uniform vec4 uCells[16]; uniform float uTime;
varying vec2 vUv; varying vec3 vFogWorldPos; varying float vFogDepth; varying vec3 vN; varying vec3 vTint; varying float vT; varying float vSh; varying float vSelf;
void main() {
  vec3 camL = cameraPosition - modelMatrix[3].xyz; // the camera in the grass's own frame (a grid cell's offset; zero standalone)
  float per = uPerSide * uPerSide;
  float tile = floor(float(gl_InstanceID) / per);
  float id = float(gl_InstanceID) - tile * per;
  vec2 origin = texelFetch(tTiles, ivec2(int(tile), 0), 0).xy;
  vec2 cell = origin + vec2(mod(id, uPerSide), floor(id / uPerSide)) * uSpacing;
  vec2 xz = cell + gHash22(cell * 1.377) * uSpacing;
  vec4 fld = texture(tField, fUV(xz));
  vec4 msk = texture(tMask, hUV(xz));
  float H0 = fld.r * 1.5;
  H0 = mix(min(H0, 0.22), H0, msk.g) * msk.r;
  float r = gHash12(cell + 7.77), r2 = gHash12(cell + 3.91), r3 = gHash12(cell + 1.19);
  float patchN = gFbm(xz * .09);
  float dist = length(xz - camL.xz);
  // a clump the field's height (a painted clump is a tuft: its tallest stems reach the field height)
  float h = clamp(H0 * mix(.62, 1.05, r) * mix(.8, 1.12, patchN), 0., 1.);   // capped: a taller painted clump is all giant leaves at the lens
  h *= smoothstep(.24, .4, H0);                              // short turf is the blades' (they are no spikes there)
  h *= 1. - smoothstep(uNear.x, uNear.y, dist);
  if (h < .06) { gl_Position = vec4(0., 0., -2., 1.); return; }
  // which card: a flower where the field blooms (its drift species, as the SDF heads choose), else one of the 8 grass clumps
  bool plateau = fld.g > 0.5;
  float sp = fld.a;
  float flower = step(r2, (0.02 + 0.2 * fld.b) * step(0.2, H0));
  float own = plateau ? (sp < .3 ? 0. : sp < .75 ? 1. : 2.) : (sp < .5 ? 2. : sp < .85 ? 1. : 0.);  // 0 sage/lupine · 1 white · 2 buttercup
  float c = flower > .5
    ? (own < .5 ? floor(r3 * 3.) : own < 1.5 ? 3. + floor(r3 * 2.) : 5. + floor(r3 * 3.)) + 8.
    : floor(r3 * 7.999);
  c = c == 2. && r > .3 ? 7. : c;                     // the feather plume: a rare accent, not a carpet
  c = plateau && flower < .5 && r3 > .7 ? 5. : c;  // the plateau's gold: more dry clumps
  vec4 uvr = uCells[int(c)];
  // the clump's own turn; the three quads cross at 60°
  float ang = gHash12(cell + 5.55) * 3.1416 + aQ * 1.0472;
  vec2 f = vec2(cos(ang), sin(ang));
  float t = position.y;
  // wind + trample, as the blades (the top bends, the root stays)
  vec2 B = (gHash22(cell + 9.1) - .5) * .35;
  float g = windGust(xz);
  float push = (0.04 + uWindSpeed * 0.03) * (0.35 + 1.25 * g * uWindGustiness + (1.0 - uWindGustiness) * 0.3);
  float flut = sin(uWindTime * (2.5 + 2.0 * r) + xz.x * 2.1 + xz.y * 1.7 + r * 6.28) * (0.02 + uWindSpeed * 0.005);
  B += uWindDir * push + vec2(-uWindDir.y, uWindDir.x) * flut;
  B += trampleBend(xz) * 1.2;
  float th = min(length(B), 1.3);
  vec2 bd = B / max(length(B), 1e-4);
  float a = th * t;
  float along = th < 1e-3 ? 0. : (1. - cos(a)) / th * h;
  float up = th < 1e-3 ? t * h : sin(a) / th * h;
  h *= flower > .5 ? .8 : 1.;
  float w = h * 0.62 * mix(.85, 1.2, r2);
  vec3 root = vec3(xz.x, groundH(xz) - .04, xz.y);
  vec3 p = root + vec3(f.x, 0., f.y) * position.x * w + vec3(bd.x * along, up, bd.y * along);
  vec2 nrm = vec2(-f.y, f.x);
  vN = normalize(vec3(nrm.x, 0.9, nrm.y));
  vUv = vec2(mix(uvr.x, uvr.z, position.x + .5), mix(uvr.y, uvr.w, t));
  // the tint: the card's painted colour, pulled toward the field's gold / green patch and the ground under it
  float lush = 1. - smoothstep(.3, .55, fld.g);   // the valley: greener, cooler clumps (the plateau keeps its gold)
  float gold = clamp(smoothstep(.42, .78, gFbm(xz * .21 + 11.)) * .85 + fld.g * .45, 0., 1.) * (1. - .7 * lush);
  vTint = mix(mix(vec3(.86, .98, .78), vec3(.68, .92, .7), lush), vec3(1.12, .98, .7), gold) * mix(.78, 1.08, r) * mix(.85, 1.05, patchN);
  vT = t;
  vSelf = mix(.42, 1., smoothstep(0., .8, t)) * mix(bakedContact(root), 1., t * .5);
  vFogWorldPos = p + modelMatrix[3].xyz;
  vSh = bakedShadow(p + vec3(0., .12, 0.));
  vec4 mv = viewMatrix * vec4(p + modelMatrix[3].xyz, 1.);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
  CARD_FS: /* glsl */`
@{LIGHT}
#include <fog_pars_fragment>
uniform sampler2D tCards; uniform float uA2C;
varying vec2 vUv; varying vec3 vN; varying vec3 vTint; varying float vT; varying float vSh; varying float vSelf;
void main() {
  vec4 tx = texture(tCards, vUv);
  float a = tx.a;
  if (uA2C > .5) { a = clamp((a - .5) / max(fwidth(a), 1e-4) + .5, 0., 1.); if (a < .02) discard; }
  else if (a < .5) discard;
  vec3 n = normalize(gl_FrontFacing ? vN : vec3(-vN.x, vN.y, -vN.z));
  vec3 v = normalize(vFogWorldPos - cameraPosition);
  float back = pow(clamp(dot(v, uSunView), 0., 1.), 4.) * vT;
  vec3 alb = tx.rgb * vTint;
  vec3 lit = alb * gLight(n, .35, vSh) * 1.05 + alb * uPSunRef * (0.78 / 2.8) * back * .9 * uGrassGain * vSh;
  gl_FragColor = vec4(gMood(lit * vSelf), uA2C > .5 ? a : 1.);
  #include <fog_fragment>
}`,
};
