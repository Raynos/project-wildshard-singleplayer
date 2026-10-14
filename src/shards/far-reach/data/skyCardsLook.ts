import type { CardFieldRow, CardGroupRow } from '@wildshard/sdk/looks/cardField';
import type { SunGlowProgram } from './sunGlowLook';

/**
 * Sky Reach's camera-facing card programs (SHARD-PLATFORM M3: rows of an SDK shader family, built by
 * @wildshard/sdk/looks/cardField; the cards' numbers are the bake in data/skyCards.ts, generators/skyCards.ts).
 *
 * The sun's glow and light shafts (E392) are baked here too (`sunGlow`), drawn by their material graph (data/sunGlowLook.ts,
 * look/sunGlow.ts).
 *
 * The cumulus over the cloud sea (E392; the targets: the islands rise out of a sea of sunlit billowing cloud): each card
 * shows one of eight painted golden-hour cumulus puffs from the atlas (`public/assets/far-reach/tex/clouds.webp`, codex
 * image_gen, `art/far-reach/round-17-mockup-loop/textures/`: puffs on black, so the brightness is the alpha), a 3:4 cell of
 * the 4 x 2 sheet, thinning out with distance (520 -> 820 m, a bank's distance stretched by its `aFar`) into the painted
 * panorama's sea; the dark matte fringe cut by alpha, lavender in the shaded bellies, the lit crowns warm, a touch of rim
 * gold when the sun is behind the cloud. Without the atlas (offline, a test page) the field is not built.
 */

/** The GLSL the programs splice (none: the sun's glow is a material graph, data/sunGlowLook.ts). */
export const SKY_CARD_FRAGMENTS = {} as const;

/** The programs: the cumulus puff. */
export const SKY_CARD_PROGRAMS = {
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

/** The baked cards (generators/skyCards.ts → data/skyCards.ts): the cumulus field and the sun's glow. */
export interface SkyCardRows {
  readonly cumulus: CardFieldRow<'cumulus'>;
  readonly sunGlow: CardGroupRow<SunGlowProgram>;
}
