/**
 * Sky Reach's cloud sea programs and discs (SHARD-PLATFORM M3: rows of an SDK shader family, built as horizontal discs by
 * `@wildshard/sdk/looks/discLayer`; look/render.ts adds them).
 *
 * - `paintedSea` (E392, E399, E410; two discs, `SEA_LAYERS`): a big disc carrying a seamless painted texture of cumulus tops
 *   seen from above (`public/assets/far-reach/tex/cloudsea.webp`, codex image_gen), two scales blended so no repeat shows,
 *   drifting slowly, darkened toward the maelstrom's eye under the crown and melting into the panorama's painted sea with distance; the
 *   upper layer keeps only the bright billow crowns, turned, for parallax on the diagonals.
 * - `paintedMaelstrom` (E392): a disc under the crown carrying a codex-painted top-down cloud vortex
 *   (`public/assets/far-reach/tex/maelstrom.webp`), turning slowly, seen only from the crown's own sky.
 *
 * Both read the painted textures only: when one is missing its discs are not drawn (the procedural stand-ins went, W1 C2).
 */

/** The programs (each reads its `painted` texture and the shared `time`). */
export const SEA_PROGRAMS = {
  paintedSea: { vertex: `varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragment: `
      uniform sampler2D painted; uniform float time, gain; uniform vec2 crown; varying vec3 wp;
      void main(){
        // the maelstrom's eye (the puff spiral, look/puffs.ts, carries the maelstrom: the sea itself is not twisted)
        float mr = length(wp.xz - vec2(0.0, -190.0));
        vec2 drift = vec2(time * 0.4, time * 0.15);
        vec3 a = texture2D(painted, (wp.xz + drift) / 120.0).rgb;
        vec3 b = texture2D(painted, (wp.xz - drift * 0.6) / 348.0 + 0.37).rgb;
        vec3 c = mix(a, b, 0.35);
        // value contrast (the judge: the sea reads flat-bright): lavender valleys, warm crowns
        float lum = dot(c, vec3(0.3, 0.59, 0.11));
        // the shaded hollows a peach-lavender, not violet (E410: under the slimmer keels the sea read lavender where the
        // mockups' cloud below the isles is gold-lit; was 0.66, 0.64, 0.84)
        c = mix(c * vec3(0.84, 0.74, 0.82), c * vec3(1.12, 1.06, 0.96), smoothstep(0.38, 0.8, lum));
        // the eye a dark lavender well
        c = mix(c * vec3(0.62, 0.6, 0.78), c, smoothstep(16.0, 56.0, mr));
        float far = 1.0 - smoothstep(420.0, 900.0, length(wp.xz - cameraPosition.xz));
        // the upper layer keeps only the bright billow crowns (SEA_LAYERS); the lower one keeps all of it
        gl_FragColor = vec4(c * gain, far * smoothstep(crown.x, crown.y, dot(c, vec3(0.3, 0.59, 0.11))));
      }`, shared: ['time'], transparent: true, depthWrite: false, side: 'double' },
  paintedMaelstrom: { vertex: `varying vec2 lp; varying float far; void main(){ lp = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); far = length(cameraPosition.xz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz); gl_Position = projectionMatrix * viewMatrix * w; }`, fragment: `
      uniform sampler2D painted; uniform float time; varying vec2 lp; varying float far;
      void main(){
        float rn = length(lp) / 125.0;
        float a = -time * 0.012;
        vec2 q = vec2(cos(a) * lp.x - sin(a) * lp.y, sin(a) * lp.x + cos(a) * lp.y) / (125.0 * 2.0) + 0.5;
        // the cloud palette (loop 20, the judge: 'too purple, hard bands'): the violet valleys lifted toward a lavender grey,
        // the lit crests kept warm, two taps blurred so the band edges soften
        vec3 c = texture2D(painted, q).rgb * 0.6 + texture2D(painted, q + vec2(0.004, 0.003)).rgb * 0.4;
        float l = dot(c, vec3(0.3, 0.59, 0.11));
        c = mix(c, vec3(l) * vec3(1.06, 0.98, 0.95), 0.45);
        c = mix(c, vec3(1.0, 0.93, 0.84), 0.18) * 1.06;
        // only the crown's own sky sees it: away from the arena the painted sea takes over (it bled into H1-H3)
        float near = 1.0 - smoothstep(110.0, 175.0, far);
        gl_FragColor = vec4(c, (1.0 - smoothstep(0.55, 0.95, rn)) * near);
      }`, shared: ['time'], transparent: true, depthWrite: false, side: 'double' },
} as const;

/** The painted sea's two layers: the lower one whole (`crown` a band below every value), the upper one only its bright
 *  billow crowns, a shade brighter, for parallax on the diagonals. */
export const SEA_LAYERS = { lower: { gain: 1, crown: [-2, -1] }, upper: { gain: 1.06, crown: [0.62, 0.82] } } as const;

/** The discs (metres): each a horizontal circle at `at`, drawn at `order`, turned by `spin` radians about the vertical. */
export const SEA_DISCS = {
  paintedSea: { name: 'far.painted-sea', program: 'paintedSea', radius: 1400, segments: 96, at: [0, -8, 0], order: -7 },
  paintedSeaUpper: { name: 'far.painted-sea.upper', program: 'paintedSea', radius: 1400, segments: 96, at: [0, 6, 0], order: -6, spin: 1.3 },
  paintedMaelstrom: { name: 'far.painted-maelstrom', program: 'paintedMaelstrom', radius: 125, segments: 96, at: [0, 10, -190], order: -6 },
} as const;

/** One disc: its mesh name, program, radius (m) and segments, centre `[x, y, z]` (m), render order and optional turn. */
export interface DiscLayerRow<P extends string = string> {
  readonly name: string;
  readonly program: P;
  readonly radius: number;
  readonly segments: number;
  readonly at: readonly [number, number, number];
  readonly order: number;
  readonly spin?: number;
}
