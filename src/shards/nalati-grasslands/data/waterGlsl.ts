// SHARD-PLATFORM M3 (look-family rows): water.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what water.ts passes (another module's GLSL, a number from the layout).
export const WATER_GLSL = {
  VERT: /* glsl */`
attribute float depth;
attribute float flow;       // 0..1 along the stream (the streaks scroll along it)
attribute float across;     // -1..1 across the stream
attribute float fall;       // 0 river · 1 brook · 2 waterfall sheet · 3 plunge pool
varying float vDepth; varying float vFlow; varying float vAcross; varying float vKind;
varying vec3 vW;
#include <common>
#include <fog_pars_vertex>
void main() {
  vDepth = depth; vFlow = flow; vAcross = across; vKind = fall;
  vec3 transformed = position;
  vec4 w = modelMatrix * vec4(transformed, 1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
  FRAG: /* glsl */`
uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uBright; uniform float uRain; uniform float uFarPale;
varying float vDepth; varying float vFlow; varying float vAcross; varying float vKind;
varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float isBrook = step(0.5, vKind) * step(vKind, 1.5);
  float isFall = step(1.5, vKind) * step(vKind, 2.5);
  float isPool = step(2.5, vKind);
  vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
  float d = max(vDepth, 0.0);
  // a glacial river: pale, milky, silvery — a little teal in the deep channels, never neon
  vec3 col = mix(uShallow * vec3(0.8, 0.9, 0.92), uDeep, smoothstep(0.1, 1.1, d));
  // (E302, NALATI-FINISH B9: the Kunes read as flat grey / white strips) painted body: slow pools and runs (a darker,
  // bluer channel, a lighter jade run), a wet dark rim along the gravel, the sky broken into strokes across the flow
  float pool = vnoise(vW.xz * vec2(0.035, 0.07) + vec2(-uTime * 0.02, 0.0));
  col = mix(col, uDeep * vec3(0.8, 0.92, 1.05), smoothstep(0.5, 0.85, pool) * 0.7 * (1.0 - isFall));
  col = mix(col, uShallow * vec3(0.92, 1.08, 0.96), smoothstep(0.35, 0.1, pool) * 0.35 * (1.0 - isFall));
  col *= mix(0.84, 1.06, vnoise(vW.xz * vec2(0.12, 0.3) + 3.0));
  // the sky it reflects at grazing angles (the pale horizon) and a warm glint toward the sun
  // (up close only: far off, a grazing sheen turns every braid into a bright line at eye level — there the water
  // settles to its own deep colour and the aerial haze takes it)
  float near = 1.0 - smoothstep(50.0, 180.0, dist);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  float strokes = smoothstep(0.35, 0.75, vnoise(vec2(vW.x * 0.45 - uTime * 0.5, vW.z * 2.2)) * 0.7 + vnoise(vec2(vW.x * 1.3, vW.z * 5.0 + uTime * 0.3)) * 0.3);
  col = mix(col, uSky * 0.92, fres * (0.1 + 0.3 * strokes) * near);
  col *= mix(0.8, 1.08, strokes);   // the painted ripple strokes run across the whole body, not just the sheen
  col = mix(col, mix(mix(uDeep, uShallow, 0.35), uSky * 0.62, uFarPale * 0.55), (1.0 - near) * 0.6);
  vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
  col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 60.0) * 0.6 * near;
  // white water: world-space dashes stretched along the flow (+x on the river), racing downstream; thick over the shoals
  vec2 wq = vec2(vW.x * 0.3 - uTime * 1.4, vW.z * 1.6);
  float white = smoothstep(0.46, 0.72, vnoise(wq) * 0.65 + vnoise(wq * vec2(2.3, 2.1) + 5.0) * 0.35);
  vec2 q = vec2(vFlow * 260.0 - uTime * 0.35, vAcross * 9.0);
  float streak = smoothstep(0.62, 0.9, vnoise(q * vec2(0.18, 1.0)) * 0.7 + vnoise(q * vec2(0.5, 2.3) + 7.0) * 0.3);
  float riffle = 1.0 - smoothstep(0.08, 0.55, d);
  float foam = clamp(streak * (0.25 + 0.35 * riffle) + riffle * white * 0.35 + white * 0.2, 0.0, 1.0);
  foam *= 1.0 - 0.75 * smoothstep(60.0, 200.0, dist);  // far off the foam melts into the sheen, no white line at eye level
  foam = max(foam, isPool * (0.55 + 0.45 * white));
  col = mix(col, uFoam, foam * 0.7);
  // the wet rim where the water thins over the gravel: darker, a touch green (not a white line)
  float rim = (1.0 - smoothstep(0.02, 0.32, d)) * (1.0 - isFall) * (1.0 - isPool) * (1.0 - isBrook * 0.5);
  col = mix(col, mix(uDeep, vec3(0.2, 0.26, 0.22), 0.45), rim * 0.65);
  // rain: a fine field of rings flickering on the surface
  float drop = step(0.93, h21(floor(vW.xz * 2.5) + floor(uTime * 6.0))) * uRain;
  col = mix(col, uFoam * 0.9, drop * 0.5);
  // the fall: white ropes racing down over a pale green sheet, torn edges
  float rope = smoothstep(0.35, 0.85, vnoise(vec2(vAcross * 11.0, vFlow * 55.0 - uTime * 3.2)) * 0.75 + vnoise(vec2(vAcross * 29.0 + 3.0, vFlow * 120.0 - uTime * 4.1)) * 0.35);
  col = mix(col, mix(uShallow * 0.95, uFoam * 0.92, 0.3 + 0.6 * rope), isFall);
  col *= uBright;
  // alpha: fade over the banks; the brook fades out with distance (a 3 m ribbon is a hairline from the valley); the
  // sheet's edges are ragged and it thins between the ropes
  float alpha = smoothstep(0.0, 0.12, vDepth) * 0.92;
  alpha *= 1.0 - isBrook * smoothstep(70.0, 160.0, dist);
  float torn = smoothstep(1.0, 0.55, abs(vAcross) + (vnoise(vec2(vAcross * 3.0, vFlow * 30.0 - uTime * 2.0)) - 0.5) * 0.6);
  // the sheet: fades in below the lip, frays into spray at the foot, thin between the ropes
  float fallT = vFlow / 0.4;
  alpha = mix(alpha, (0.3 + 0.55 * rope) * torn * smoothstep(0.0, 0.08, fallT) * (1.0 - 0.6 * smoothstep(0.75, 1.0, fallT)), isFall);
  alpha = mix(alpha, 0.85 * smoothstep(1.0, 0.7, abs(vAcross)), isPool);
  // opaque, with a screen-door dither for the soft edges and the thin sheet: in this post chain a transparent mesh is
  // not depth-tested against the scene (the river's braids drew over the fences and the road in front of them)
  if (alpha < 0.04 + 0.9 * h21(floor(gl_FragCoord.xy) * 0.37 + 0.5)) discard;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`,
};
