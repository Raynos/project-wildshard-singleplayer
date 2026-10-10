// Copied from the organic lab (the dev labs (deleted in E357 F7), round-9-lab-organic: the sky scroll only) into the clean room.
// Lab P7 "organic" (E169): the LED sky screens show a real 青绿山水 handscroll. The clean room paints procedural
// ridges; the targets show a detailed 千里江山图 (azurite crests, malachite bodies, ochre feet, scalloped cloud bands,
// dotted pines) behind a visible LED grid. The painting is three codex image_gen panels joined into one seamless
// 3348×1024 scroll (image-quilting min-error seams; scratch `panorama2.py`, 850 KB WebP). It pans slowly west → east,
// and every LED shows ONE colour: the scroll is sampled at the dot's centre at the mip of the dot's footprint.
// Seen from below a ceiling, "up" in the eye is toward the viewer: the painting's sky sits at the screen's near
// (south) edge. The targets' visible "pixels" are LED MODULES: fine 0.06 m dots (they fade to their average below a
// few px, so no moiré), a 1.2 m module seam grid, the 8 m steel frame; a faint row scan, a rolling refresh band, a few
// dead diodes, and the bright clouds pushed over the bloom threshold (the post's Karis prefilter at 1.0 picks them up).
// SHARD-PLATFORM M3: the program's GLSL and row and the default screen are data (data/scroll.ts).
import { type ShaderMaterial, type Texture, Vector2, Vector4 } from 'three';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { loadWrappedTexture } from '@wildshard/sdk/looks/wrappedTexture';
import { SCROLL_DEFAULTS, SCROLL_PROGRAMS, SCROLL_TEX } from '../data/scroll';
import { LOOK_FRAGMENTS, type Shared } from './style';

const SCROLL_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, SCROLL_PROGRAMS);

export interface ScrollOpt {
  /** LED pitch (m) */
  pitch: number;
  /** metres of screen per painting height (the painting's vertical span) */
  span: number;
  /** pan speed (m/s along the screen's u) and start offset (m) */
  speed: number;
  offset: number;
  /** the painting's height (0 = its bottom, the water; 1 = its top, the sky) shown at the screen's NEAR (south) edge;
   *  from there the painting runs down toward the north. From the square only the nearest ~25 m of the screen show
   *  between the decks, so sky / peaks / hills must fall there (the targets) */
  near: number;
  led: Vector4;
  grade: Vector4;
  /** the LED module tiles: size (m), seam darkness */
  module: [number, number];
}
const D = SCROLL_DEFAULTS;
/** the default screen (data/scroll.ts) */
export const SCROLL: ScrollOpt = { pitch: D.pitch, span: D.span, speed: D.speed, offset: D.offset, near: D.near, led: new Vector4(...D.led), grade: new Vector4(...D.grade), module: [...D.module] };

/** the sky scroll: wrapped along u, made GPU-only once drawn */
export function loadScroll(url: string): Promise<Texture> {
  return loadWrappedTexture(url, 'Nine Dragon sky scroll (GPU only)');
}

/** the knobs of one screen's program (typed handles, so a tuning write never goes through `any`) */
export interface ScrollKnobs { pitch: { value: number }; pan: Vector4; led: Vector4; grade: Vector4; module: Vector2; h: number; near: number }

/** the LED sky-screen program: `w` × `h` metres (the PlaneGeometry's size), the scroll texture, the options */
export function scrollMaterial(shared: Shared, tex: Texture, w: number, h: number, o: ScrollOpt = SCROLL): { mat: ShaderMaterial; knobs: ScrollKnobs } {
  const img = tex.image as { width?: number; height?: number } | null;
  const tw = img?.width ?? SCROLL_TEX[0], th = img?.height ?? SCROLL_TEX[1];
  const knobs: ScrollKnobs = {
    pitch: { value: o.pitch }, pan: new Vector4(o.span, o.speed, o.offset, o.near - h / o.span), led: o.led.clone(), grade: o.grade.clone(), module: new Vector2(...o.module), h, near: o.near,
  };
  const mat = SCROLL_FAMILY.material('scroll', shared.u, {
    uniforms: {
      uScroll: { value: tex },
      uSize: { value: new Vector2(w, h) },
      uTexSize: { value: new Vector2(tw, th) },
      uPitch: knobs.pitch,
      uPan: { value: knobs.pan },
      uLed: { value: knobs.led },
      uGrade: { value: knobs.grade },
      uModule: { value: knobs.module },
    },
  });
  return { mat, knobs };
}
