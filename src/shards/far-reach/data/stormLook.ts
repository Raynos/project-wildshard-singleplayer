/**
 * The crown storm's vortex program (SHARD-PLATFORM M3: a row of an SDK shader family; world/storm.ts builds one dished
 * ring per layer with it): a slow spiral of slate cloud over the storm crown, its arms lit gold on the sun side and violet
 * underneath, flashing with the lightning, dished so the eye sits highest and the rim hangs low; with `FAR_STORM_PAINT`
 * defined it carries the painted cumulus spiral (the sea's maelstrom painting) greyed toward mockup D's smoky slate.
 */

/** The ring program (its uniforms are world/storm.ts's: the cloud texture, the paint, time, flash, the sun, the layer's
 *  twist, spin, seed, radius and dish, and the centre). */
export const STORM_PROGRAMS = {
  ring: { vertex: `
  uniform float radius, dish; varying vec3 wp; varying vec2 lp;
  void main(){
    vec3 p = position; lp = p.xz / radius;
    // dished: the eye sits highest, the rim hangs low
    p.y += dish * pow(1.0 - min(length(lp), 1.0), 2.0);
    vec4 w = modelMatrix * vec4(p, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
  }`, fragment: `
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
    vec3 c = mix(vec3(0.2086,0.1683,0.2384), vec3(0.0343,0.0296,0.0612), smoothstep(0.35, 0.95, dens));
    c = mix(c, vec3(0.8070,0.5647,0.3916), smoothstep(0.55, 1.0, r) * 0.4);
    float thin = 1.0 - smoothstep(0.25, 0.7, dens);
    float gold = smoothstep(0.55, 0.95, lit) * (0.35 + 0.65 * sunSide) * (0.25 + 0.75 * smoothstep(0.2, 0.9, r)) * 0.75
      + thin * (0.2 + 0.8 * sunSide) * smoothstep(0.35, 0.95, r) * 0.7 + pow(toward, 6.0) * thin * 0.5;
    c += vec3(1.0000,0.5841,0.2270) * gold;
    c = mix(c, vec3(1.0000,0.5841,0.2270) * 0.95, pow(sunSide, 3.0) * smoothstep(0.72, 0.98, r) * 0.5);
    // lightning: the eye and the bellies near it light violet-white
    c += vec3(0.7605,0.6724,1.0000) * flash * (exp(-r * 3.5) * 1.4 + 0.25) * (0.4 + dens);
#ifdef FAR_STORM_PAINT
    // E399 (mockup D): the painted storm vortex seen from below (tex/stormeye.webp: slate-violet arms, gold-lit rims, a
    // glowing eye, lightning), the whole spiral inside the inner 60 %, turning slowly; the disc past it fades out, so the
    // sky and the low sun stay clear below it; the upper layer only a faint second turn
    vec2 pq = rot(lp, time * spin * 0.35 + seed) * (seed > 1.0 ? 0.7 : 0.83) + 0.5;
    // a shade darker than the painting (round 2, seat B: 'lighter than the mockup's dark spiral')
    vec3 under = texture2D(paint, pq).rgb * vec3(0.78, 0.76, 0.84);
    // smoky slate masses, not a violet pinwheel, the eye a shade darker, not lit (Codex round 13 finding 4: mockup D's
    // storm 108/91/93, saturation 32; ours 100/79/83, 35)
    under = mix(under, vec3(dot(under, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.02, 0.97, 1.0), 0.35) * 1.30;
    under *= mix(0.75, 1.0, smoothstep(0.0, 0.22, r));
    // a strike lights the eye and the arms near it, not the whole sky (a flat flash washed the vortex out; the bolts carry it)
    c = under + vec3(0.7605,0.6724,1.0000) * flash * exp(-r * 4.0) * 0.6;
    alpha = rim * (1.0 - smoothstep(0.5, 0.75, r)) * (seed > 1.0 ? 0.0 : 0.97);
    // the low sun stays clear (mockup D: the vortex above, the sun and its gold horizon below its edge), the edge gilded
    float sunClear = smoothstep(0.993, 0.999, toward);
    c += vec3(1.0000,0.5841,0.2270) * smoothstep(0.93, 0.98, toward) * 0.35;
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
    c = mix(c, vec3(0.8469,0.5841,0.4342), haze * hazeK);
    // a camera up at the storm's height (the god views, a high hover) sees it thin out, never a wall of paint
    float near = smoothstep(3.0, 16.0, abs(wp.y - cameraPosition.y));
    // loop 4: it belongs to the crown. Seen from the far islands it is only a faint bruise over the crown, so the painted
    // sky stays open from the spawn; it gathers as you come near (the high step, the crown bridge, the arena)
    float approach = 1.0 - smoothstep(110.0, 170.0, length(cameraPosition.xz - centre.xz)) * 0.9;
    // seen from above (the E392 god-view targets) it is a sunlit cumulus spiral, the crown clear in its eye: the billows'
    // crowns cream-gold, the hollows lavender, the eye open
    float above = smoothstep(1.0, 9.0, cameraPosition.y - wp.y);
    vec3 billow = mix(vec3(0.3325,0.2542,0.3916), vec3(1.0000,0.8714,0.7157), smoothstep(0.25, 0.85, lit * 0.6 + (1.0 - dens) * 0.2 + arms * 0.3));
    billow = mix(billow, vec3(1.0000,0.5841,0.2270), pow(sunSide, 2.0) * 0.35);
    c = mix(c, billow, above);
    float eyeOpen = mix(1.0, smoothstep(0.18, 0.4, r), above);
    gl_FragColor = vec4(c, alpha * (1.0 - haze * 0.72) * near * approach * (1.0 - above));
  }`, shared: [], transparent: true, depthWrite: false, side: 'double' },
} as const;
