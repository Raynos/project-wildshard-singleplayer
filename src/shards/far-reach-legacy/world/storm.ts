import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, RingGeometry, ShaderMaterial, Vector3, type Texture } from 'three';
import { onPaintedDispose } from '../look/image';

import { STORM } from '../data/storm';

function hex(value: number): string { const c = new Color(value); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; }
/** The storm's palette (sRGB): belly, mid, the gold of the lit edges, the violet-white of the lightning, the haze it melts into. */
/** The painted vortex toward mockup D's smoky slate: how far it greys, how much it lifts, how dark its eye. */
export const STORM_SLATE = { grey: 0.35, lift: 1.3, eye: 0.75 } as const;
export const STORM_COLORS = { belly: 0x343046, mid: 0x7e7286, top: 0xe8c6a8, gold: 0xffc983, bolt: 0xe2d6ff, haze: 0xedc9b0 } as const;

const FRAGMENT = /* glsl */`
  uniform sampler2D tex, paint; uniform float time, flash, twist, spin, seed; uniform vec3 sunDir, centre; varying vec3 wp; varying vec2 lp;
  vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  void main(){
    float r = length(lp), th = atan(lp.y, lp.x);
    // the twist winds the field toward the eye; the whole field turns slowly, the fine octave at another rate
    float a = twist * pow(1.0 - min(r, 1.0), 1.6) + time * spin;
    vec2 q = rot(lp, a) * 1.35 + seed, q2 = rot(lp, a * 1.3 + time * spin * 0.7) * 3.1 - seed;
    float w = texture2D(tex, q * 0.5 + 0.31).r;
    vec2 qa = q + (w - 0.5) * 0.55;
    float base = texture2D(tex, qa).r, fine = texture2D(tex, q2).r;
    // billows lit from the sun's side: the density just sunward of here is thinner -> a bright edge
    vec2 sunL = rot(normalize(sunDir.xz), a) * 0.035;
    float lit = clamp((base - texture2D(tex, qa + sunL).r) * 9.0 + 0.5, 0.0, 1.0);
    // three spiral arms (an integer multiple of the angle, so no seam), broken up by the field
    float arms = 0.5 + 0.5 * sin(3.0 * th + 5.0 * log(r + 0.03) - time * spin * 9.0 + base * 6.0);
    float d = base * 0.95 + fine * 0.35 + arms * 0.16 - 0.32;
    // the eye: a clear, darker well; the rim: ragged and soft
    float eye = smoothstep(0.05, 0.22, r + (d - 0.4) * 0.1);
    float rim = 1.0 - smoothstep(0.6, 1.0, r + (d - 0.4) * 0.4);
    float dens = clamp(d * 1.6, 0.0, 1.0);
    float alpha = smoothstep(0.12, 0.5, dens) * rim * mix(0.3, 1.0, eye);
    // colour: dark bellies, mauve body, gold on the sunlit billow edges, the sunward rim and the thin arm edges
    vec3 V = normalize(wp - cameraPosition); float toward = max(dot(V, sunDir), 0.0);
    vec2 out2 = r > 0.001 ? lp / r : vec2(0.0); float sunSide = max(dot(out2, normalize(sunDir.xz)), 0.0);
    vec3 c = mix(${hex(STORM_COLORS.mid)}, ${hex(STORM_COLORS.belly)}, smoothstep(0.35, 0.95, dens));
    c = mix(c, ${hex(STORM_COLORS.top)}, smoothstep(0.55, 1.0, r) * 0.4);
    float thin = 1.0 - smoothstep(0.25, 0.7, dens);
    float gold = smoothstep(0.55, 0.95, lit) * (0.35 + 0.65 * sunSide) * (0.25 + 0.75 * smoothstep(0.2, 0.9, r)) * 0.75
      + thin * (0.2 + 0.8 * sunSide) * smoothstep(0.35, 0.95, r) * 0.7 + pow(toward, 6.0) * thin * 0.5;
    c += ${hex(STORM_COLORS.gold)} * gold;
    c = mix(c, ${hex(STORM_COLORS.gold)} * 0.95, pow(sunSide, 3.0) * smoothstep(0.72, 0.98, r) * 0.5);
    // lightning: the eye and the bellies near it light violet-white
    c += ${hex(STORM_COLORS.bolt)} * flash * (exp(-r * 3.5) * 1.4 + 0.25) * (0.4 + dens);
#ifdef FAR_STORM_PAINT
    // E399 (mockup D): the painted storm vortex seen from below (tex/stormeye.webp: slate-violet arms, gold-lit rims, a
    // glowing eye, lightning), the whole spiral inside the inner 60 %, turning slowly; the disc past it fades out, so the
    // sky and the low sun stay clear below it; the upper layer only a faint second turn
    vec2 pq = rot(lp, time * spin * 0.35 + seed) * (seed > 1.0 ? 0.7 : 0.83) + 0.5;
    // a shade darker than the painting (round 2, seat B: 'lighter than the mockup's dark spiral')
    vec3 under = texture2D(paint, pq).rgb * vec3(0.78, 0.76, 0.84);
    // smoky slate masses, not a violet pinwheel, the eye a shade darker, not lit (Codex round 13 finding 4: mockup D's
    // storm 108/91/93, saturation 32; ours 100/79/83, 35)
    under = mix(under, vec3(dot(under, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.02, 0.97, 1.0), ${STORM_SLATE.grey.toFixed(2)}) * ${STORM_SLATE.lift.toFixed(2)};
    under *= mix(${STORM_SLATE.eye.toFixed(2)}, 1.0, smoothstep(0.0, 0.22, r));
    // a strike lights the eye and the arms near it, not the whole sky (a flat flash washed the vortex out; the bolts carry it)
    c = under + ${hex(STORM_COLORS.bolt)} * flash * exp(-r * 4.0) * 0.6;
    alpha = rim * (1.0 - smoothstep(0.5, 0.75, r)) * (seed > 1.0 ? 0.0 : 0.97);
    // the low sun stays clear (mockup D: the vortex above, the sun and its gold horizon below its edge), the edge gilded
    float sunClear = smoothstep(0.993, 0.999, toward);
    c += ${hex(STORM_COLORS.gold)} * smoothstep(0.93, 0.98, toward) * 0.35;
    alpha *= 1.0 - sunClear * 0.95;
#endif
#ifdef FAR_STORM_PAINT
    const float hazeK = 0.35;
#else
    const float hazeK = 0.7;
#endif
    // haze with distance (the scene fog's warm rose): from the spawn the storm is a soft bruise, not a lid
    float dist = length(wp - cameraPosition);
    // (E399: the eye now hangs 45 m beyond the crown, 60-150 m from the arena; the haze starts past it)
    float haze = smoothstep(220.0, 380.0, dist);
    c = mix(c, ${hex(STORM_COLORS.haze)}, haze * hazeK);
    // a camera up at the storm's height (the god views, a high hover) sees it thin out, never a wall of paint
    float near = smoothstep(3.0, 16.0, abs(wp.y - cameraPosition.y));
    // loop 4: it belongs to the crown. Seen from the far islands it is only a faint bruise over the crown, so the painted
    // sky stays open from the spawn; it gathers as you come near (the high step, the crown bridge, the arena)
    float approach = 1.0 - smoothstep(${STORM.gather[0].toFixed(1)}, ${STORM.gather[1].toFixed(1)}, length(cameraPosition.xz - centre.xz)) * 0.9;
    // seen from above (the E392 god-view targets) it is a sunlit cumulus spiral, the crown clear in its eye: the billows'
    // crowns cream-gold, the hollows lavender, the eye open
    float above = smoothstep(1.0, 9.0, cameraPosition.y - wp.y);
    vec3 billow = mix(${hex(0x9c8aa8)}, ${hex(0xfff0dc)}, smoothstep(0.25, 0.85, lit * 0.6 + (1.0 - dens) * 0.2 + arms * 0.3));
    billow = mix(billow, ${hex(STORM_COLORS.gold)}, pow(sunSide, 2.0) * 0.35);
    c = mix(c, billow, above);
    float eyeOpen = mix(1.0, smoothstep(0.18, 0.4, r), above);
    gl_FragColor = vec4(c, alpha * (1.0 - haze * 0.72) * near * approach * (1.0 - above));
  }`;

const VERTEX = /* glsl */`
  uniform float radius, dish; varying vec3 wp; varying vec2 lp;
  void main(){
    vec3 p = position; lp = p.xz / radius;
    // dished: the eye sits highest, the rim hangs low
    p.y += dish * pow(1.0 - min(length(lp), 1.0), 2.0);
    vec4 w = modelMatrix * vec4(p, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
  }`;

/** A jagged bolt: a crossed pair of thin ribbons along a zig-zag from the storm's base down `length` metres. */
function boltGeometry(random: () => number, length: number): BufferGeometry {
  const pts: [number, number, number][] = [[0, 0, 0]];
  let x = 0, z = 0;
  for (let i = 1; i <= 9; i++) { x += (random() - 0.5) * 4; z += (random() - 0.5) * 4; pts.push([x, -(i / 9) * length, z]); }
  const pos: number[] = [], w = 0.35;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; if (a === undefined || b === undefined) continue;
    const ww = w * (1 - i / pts.length);
    for (const [ox, oz] of [[ww, 0], [0, ww]] as const) {
      pos.push(a[0] - ox, a[1], a[2] - oz, a[0] + ox, a[1], a[2] + oz, b[0] + ox, b[1], b[2] + oz);
      pos.push(a[0] - ox, a[1], a[2] - oz, b[0] + ox, b[1], b[2] + oz, b[0] - ox, b[1], b[2] - oz);
    }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); return g;
}

export interface CrownStorm {
  readonly group: Group;
  /** Turn the vortex and fire the lightning; `t` is the shard's play clock (seconds). */
  readonly update: (dt: number, t: number) => void;
  /** Strike `delay` seconds from the next update (captures and tests use it through `__wildshard.shard.farReach`). */
  readonly strike: (delay?: number) => void;
}

let PAINT: Texture | null = null;
/** The painted cumulus spiral for the storm's underside (the sea's maelstrom painting; the plugin owns it). */
export function setStormPaint(t: Texture | null): void {
  PAINT = t;
  onPaintedDispose(t, () => { if (PAINT === t) PAINT = null; });
}

/** Build the storm, centred at the group's origin (place it over the crown at `STORM.lift`). */
export function crownStorm(sun: Vector3, tex: Texture, random: () => number): CrownStorm {
  const group = new Group(); group.name = 'far.storm';
  const time = { value: 0 }, flash = { value: 0 }, centre = new Vector3();
  STORM.layers.forEach((layer, i) => {
    const radius = STORM.radius * layer.r, geometry = new RingGeometry(0.5, radius, 72, 10); geometry.rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({ side: DoubleSide, transparent: true, depthWrite: false, fog: false, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      defines: PAINT !== null ? { FAR_STORM_PAINT: '' } : {},
      uniforms: { tex: { value: tex }, paint: { value: PAINT }, time, flash, sunDir: { value: sun }, twist: { value: layer.twist }, spin: { value: layer.spin },
        seed: { value: i * 17.3 }, radius: { value: radius }, dish: { value: 6 + i * 4 }, centre: { value: centre } } });
    const mesh = new Mesh(geometry, material); mesh.position.y = layer.dy; mesh.renderOrder = 3 - i; mesh.frustumCulled = false; group.add(mesh);
  });
  const boltMaterial = new MeshBasicMaterial({ color: STORM_COLORS.bolt, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, fog: false, side: DoubleSide });
  const bolts = [0, 1, 2].map((i) => {
    const bolt = new Mesh(boltGeometry(random, 18 + i * 6), boltMaterial); const a = random() * Math.PI * 2, rr = 8 + random() * 18;
    bolt.position.set(Math.cos(a) * rr, 2, Math.sin(a) * rr); bolt.visible = false; bolt.frustumCulled = false; group.add(bolt); return bolt;
  });
  // the lightning schedule: a strike every 3.5–8 s, a double flicker, one bolt shown
  let next = 2, strike = -10, which = 0;
  let pending: number | null = null;
  return { group, strike: (delay = 0) => { pending = delay; }, update: (dt, t) => {
    time.value += dt; group.getWorldPosition(centre);
    if (pending !== null) { next = t + pending; pending = null; }
    if (t >= next) { strike = t; which = Math.floor(random() * bolts.length); next = t + 3.5 + random() * 4.5; }
    const s = t - strike, k = s < 0.08 ? 1 : s < 0.14 ? 0.15 : s < 0.24 ? 0.8 : Math.max(0, 1 - (s - 0.24) / 0.5) * 0.3;
    flash.value = k;
    bolts.forEach((bolt, i) => { bolt.visible = i === which && s < 0.26 && k > 0.5; });
  } };
}
