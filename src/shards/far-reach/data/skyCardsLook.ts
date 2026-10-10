/**
 * Sky Reach's camera-facing card programs (SHARD-PLATFORM M3: rows of an SDK shader family, built by
 * `@wildshard/sdk/looks/cardField`; the cards' numbers are the bake in data/skyCards.json, generators/skyCards.ts).
 *
 * The sun's glow and light shafts (E392; the judge every loop: "no visible sun, no god rays"): the panorama paints the sun
 * disc (look/sky.ts); these add, at the same direction, a wide soft bloom and a fan of long light-shaft cards radiating from
 * it, additive, drawn after the cumulus puffs (they write no depth) and before the world, so the low sun burns through a
 * cloud bank as mockups A and D paint it while the isles and the world (depth) still hide it. Camera-facing in the shader;
 * a shard-side stand-in until the engine's god-ray pass can take a shard's light source.
 *
 * The cumulus over the cloud sea (E392; the targets: the islands rise out of a sea of sunlit billowing cloud): each card
 * shows one of eight painted golden-hour cumulus puffs from the atlas (`public/assets/far-reach/tex/clouds.webp`, codex
 * image_gen, `art/far-reach/round-17-mockup-loop/textures/`: puffs on black, so the brightness is the alpha), a 3:4 cell of
 * the 4 x 2 sheet, thinning out with distance (520 -> 820 m, a bank's distance stretched by its `aFar`) into the painted
 * panorama's sea; the dark matte fringe cut by alpha, lavender in the shaded bellies, the lit crowns warm, a touch of rim
 * gold when the sun is behind the cloud. Without the atlas (offline, a test page) the field is not built.
 */

/** The GLSL the programs splice: the sun cards' shared vertex program (a card centred on the sun, or a shaft card rotated
 *  about it in the view plane). */
export const SKY_CARD_FRAGMENTS = {
  sunCard: `
  uniform vec3 uSun; uniform float uDist; uniform vec2 uSize; uniform float uAngle;
  varying vec2 vUv;
  void main(){
    vec3 centre = cameraPosition + uSun * uDist;
    vec3 toCam = normalize(cameraPosition - centre);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)), up = cross(toCam, right);
    // a shaft card rotates in the view plane about the sun; the bloom card is centred on it
    float c = cos(uAngle), s = sin(uAngle);
    vec2 p = vec2(position.x * uSize.x, (position.y + (uSize.y > uSize.x ? 0.5 : 0.0)) * uSize.y);
    vec2 r = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    vUv = position.xy + 0.5;
    gl_Position = projectionMatrix * viewMatrix * vec4(centre + right * r.x + up * r.y, 1.0);
  }`,
} as const;

/** The programs: the sun's disc and bloom, its wide gold air, a light shaft, and the cumulus puff. */
export const SKY_CARD_PROGRAMS = {
  sunBloom: { vertex: '@{sunCard}', fragment: `
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        // loop 20 (mockup A: a hot white disc with a wide bloom beside the windmill; the painted disc alone read faint
        // through the haze): the disc itself (about the painted one's 1.5 deg), a tight hot glow and a wide warm halo
        float disc = 1.0 - smoothstep(0.085, 0.115, d);
        float halo = exp(-d * 3.2) * (1.0 - smoothstep(0.7, 1.0, d));
        // gold, not white (E399 seats: 'the sun white'): a warm disc in an amber-orange bloom
        // round 6 (the seats: 'a hollow pink ring in a soft wash', 66-76 % of the frame's over-230 pixels in the sun's blur
        // against the mockups' 46-62 %, D's halo 15 % of its middle band over 230 vs 5 %): one solid hot disc, a fainter halo
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.82) * disc * 6.0 + vec3(1.0, 0.62, 0.26) * (exp(-d * d * 140.0) * 1.2 + halo * 0.1), 1.0);
      }`, shared: ['uSun'], transparent: true, depthWrite: false, depthTest: true, blend: 'add', side: 'double' },
  sunWide: { vertex: '@{sunCard}', fragment: `
      varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * exp(-d * 2.4) * (1.0 - smoothstep(0.75, 1.0, d)) * 0.06, 1.0); }`, shared: ['uSun'], transparent: true, depthWrite: false, depthTest: true, blend: 'add', side: 'double' },
  sunShaft: { vertex: '@{sunCard}', fragment: `
        uniform float uPulse; varying vec2 vUv;
        void main(){
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0, along = vUv.y;
          float a = smoothstep(0.0, 1.0, across) * (1.0 - along) * smoothstep(0.0, 0.08, along) * 0.13 * uPulse;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a, 1.0);
        }`, shared: ['uSun'], transparent: true, depthWrite: false, depthTest: true, blend: 'add', side: 'double' },
  cumulus: { vertex: `
      attribute vec4 aAt; attribute vec2 aCell; attribute float aFar; varying vec2 vUv; varying float vFade; varying float vToSun;
      uniform vec3 uSun;
      void main(){
        vec3 toCam = normalize(cameraPosition - aAt.xyz);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
        // an atlas cell is 3:4 (384 x 512 of the 4 x 2 sheet); row 0 is the sheet's top row
        vec3 world = aAt.xyz + (right * position.x * 0.75 + up * position.y) * aAt.w;
        vec2 inCell = position.xy * 0.5 + 0.5;
        vUv = vec2((aCell.x + inCell.x) / 4.0, 1.0 - (aCell.y + 1.0 - inCell.y) / 2.0);
        float d = length(aAt.xz - cameraPosition.xz);
        vFade = 1.0 - smoothstep(520.0, 820.0, d * aFar);
        vToSun = max(dot(-toCam, uSun), 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`, fragment: `
      uniform sampler2D uAtlas; varying vec2 vUv; varying float vFade; varying float vToSun;
      void main(){
        vec3 t = texture2D(uAtlas, vUv).rgb;
        // the dark matte fringe is cut by alpha (no ink outline); the painted shading inside is kept
        float lum = dot(t, vec3(0.3, 0.59, 0.11)), body = smoothstep(0.24, 0.5, lum);
        float alpha = body * vFade;
        if (alpha < 0.01) discard;
        // contrast: lavender in the shaded bellies, the lit crowns warm (the targets' billows read one by one)
        float lit = smoothstep(0.35, 0.85, lum);
        vec3 c = mix(t * vec3(0.78, 0.76, 1.02), t * vec3(1.18, 1.12, 1.02), lit);
        // a touch of rim gold when the sun is behind the cloud
        c += vec3(1.0, 0.78, 0.45) * pow(vToSun, 6.0) * (1.0 - smoothstep(0.3, 0.7, lum)) * 0.5;
        gl_FragColor = vec4(c, alpha);
      }`, shared: ['uSun'], transparent: true, depthWrite: false },
} as const;
