// 界画霓虹 Jiehua Neon: one program for all architecture plus the neon, sky, sky-screen, fog-sheet, steam and filament
// programs. The architecture program is the ink lab's (the dev labs (deleted in E357 F7), round-7-lab-ink), merged:
//  - ruled ink on every built border, box-filtered at a fixed px width from the gradient length (`inkCov`, `mpp`), a
//    heavier ground line on walkable lips; every repeated ruling fades to its AVERAGE tone when crowded (`ruled`);
//  - one fade per job: 焦墨 until ~110 m, clear air for the first 16 m, lines gone 120–330 m, fog dissolves lines first
//    (T^0.7);
//  - a painted wash: two hard bands of top light, soffits a deeper ink, pooling, rain stains, mottle, a world-anchored
//    fractal silk weave and granulation; the fog carries a screen-space silk;
//  - alpha = near / viewZ, so the MSAA resolve gives the post silhouette an antialiased inverse depth.
// Kept from the clean room: the wet flagstones shared with the streak cards (kind 3), nets, leaves, cloth, baked neon
// spill, the colour script down the Well, gold lines on the deep strata, and the 泥金磁青 flip (`uSutra`).
// Presets (`setLook`): blue hour (the default, Jake's round-6 pick), warm raw silk, and the gold-on-indigo sutra.
// SHARD-PLATFORM M3: the programs, the shared uniforms and the presets are rows in data/look.ts on the SDK shader family
// (@wildshard/sdk/looks/shaderFamily); this module makes the family (the splices the data cannot hold), the live shared
// uniforms and each material.
import { Color, type ShaderMaterial, type Texture, type IUniform, Vector2, Vector3, Vector4 } from 'three';
import { BLEND_ADD_KEEP_ALPHA, BLEND_KEEP_ALPHA, ShaderFamily, setUniforms, uniformsFrom, type UniformRows, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { Y0 } from '../layout';
import { paintUniforms } from './paint';
import { FLAG, PAINT_GLSL } from '../data/paint';
// the baked light volume (lab P6): warm pools from every lantern, shop, lamp, sign and lit window
import { lightVolUniforms } from './light/lightvol';
import { LIGHTVOL_GLSL } from '../data/light';
import { METAL, SUTRA } from '../util';
import { silkWeaveTexture } from '@wildshard/sdk/looks/weave';
import { fogBandWindow } from '@wildshard/sdk/looks/fogBands';
import {
  EMIT_FOG as LOOK_EMIT_FOG, FOG_GLSL as LOOK_FOG, NOISE_GLSL as LOOK_NOISE, PAPER_GLSL as LOOK_PAPER, PROGRAMS, SHARED_UNIFORMS,
  STONES_GLSL as LOOK_STONES, BANDS, LOOKS, type LookName,
} from '../data/look';

/** the splices only the shard knows (the datum, the flagstones, paint, light) */
export const LOOK_FRAGMENTS: Readonly<Record<string, string>> = { y0: String(Y0), flagRh: FLAG.rh.toFixed(3), paint: PAINT_GLSL, lightvol: LIGHTVOL_GLSL };
/** the family: the data's programs, with the splices only the shard knows (the datum, the flagstones, paint, light) */
export const LOOK_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, PROGRAMS);

/** the shared GLSL other programs splice in, resolved */
export const NOISE_GLSL = LOOK_FAMILY.glsl(LOOK_NOISE);
export const FOG_GLSL = LOOK_FAMILY.glsl(LOOK_FOG);
export const PAPER_GLSL = LOOK_FAMILY.glsl(LOOK_PAPER);
export const STONES_GLSL = LOOK_FAMILY.glsl(LOOK_STONES);
/** how far a light punches through the silk (data/look.ts) */
export const EMIT_FOG: string = LOOK_EMIT_FOG;

const c = (hex: number): Color => new Color(hex);

/** a look's preset as uniform rows (`setUniforms`), from data/look.ts' bands and looks */
export function lookPreset(name: LookName): UniformRows {
  const p = LOOKS[name];
  return {
    uSutra: name === 'sutra' ? 1 : 0, uBandCols: { rgbs: BANDS.map((b) => b[name]) }, uFogBaseCol: { rgb: p.fog },
    uSkyTop: { rgb: p.sky[0] }, uSkyHorizon: { rgb: p.sky[1] }, uWashTint: { v3: p.tint }, uShade: { rgb: p.shade },
  };
}

export type Uniforms = Record<string, IUniform>;

/** keeps the target's alpha (the silhouette's inverse depth) under a transparent pass */
export const KEEP_ALPHA: typeof BLEND_KEEP_ALPHA = BLEND_KEEP_ALPHA;
export const ADD_KEEP_ALPHA: typeof BLEND_ADD_KEEP_ALPHA = BLEND_ADD_KEEP_ALPHA;

function sharedUniforms(): UniformsOf<typeof SHARED_UNIFORMS> & {
  uSilver: { value: Color }; uGold: { value: Color }; uPaper: { value: Color }; uPaperDeep: { value: Color }; uSilk: { value: Texture };
} & ReturnType<typeof paintUniforms> & ReturnType<typeof lightVolUniforms> {
  return {
    ...uniformsFrom(SHARED_UNIFORMS),
    uSilver: { value: c(METAL.silver) },
    uGold: { value: c(METAL.gold) },
    uPaper: { value: c(SUTRA.indigo) },
    uPaperDeep: { value: c(SUTRA.deep) },
    uSilk: { value: silkWeaveTexture() },
    // the painted surfaces (paint.ts, merged from lab P5): the texture array and its strengths
    ...paintUniforms(),
    ...lightVolUniforms(),
  };
}

/** uniforms every world program shares (one object each, so a write reaches every material) */
export class Shared {
  readonly u = sharedUniforms();
  look: LookName = 'jiehua';

  /** the look: blue hour (Jake's pick), warm raw silk (what codex paints), or the gold-on-indigo sutra */
  setLook(name: LookName): void {
    this.look = name;
    setUniforms(this.u, lookPreset(name));
  }

  /** kept for the old API: 0 = blue hour, 1 = sutra */
  setSutra(s: number): void { this.setLook(s > 0.5 ? 'sutra' : 'jiehua'); }

  /**
   * (E283) the silk fog's band window for the eye at uCam (call it after every uCam write): the bands run top to bottom,
   * each reaching 3 widths either side of its height, so a ray going down from the eye can reach no band before the
   * first whose bottom is at or under the eye, and a ray going up none after the last whose top is at or over it — and
   * past the first band the ray's far end cannot reach, no later one either. silkFog then walks only those bands, in the
   * same order, with the same test on each: the same fog, bit for bit. Off (z 0) if the bands ever stop running top to
   * bottom (@wildshard/sdk/looks/fogBands).
   */
  bandWindow(): void { fogBandWindow(this.u.uBands.value, this.u.uCam.value.y, this.u.uBandWin.value); }
}

export function jiehuaMaterial(shared: Shared, opt: { alphaCut?: boolean; viewmodel?: boolean; doubleSide?: boolean } = {}): ShaderMaterial {
  const u: Uniforms = {};
  if (opt.viewmodel === true) {
    u['uCam'] = { value: new Vector3() };
    u['uFogScale'] = { value: 0 };
    u['uLightDir'] = { value: new Vector3(0.3, 0.8, 0.5).normalize() };
    u['uLineFade'] = { value: new Vector2(100, 200) };
    u['uPaintK'] = { value: new Vector4(0, 1, 1, 1) }; // the weapon is not painted stone
  }
  const cut = opt.alphaCut === true;
  return LOOK_FAMILY.material('jiehua', shared.u, { uniforms: u, defines: cut ? { ALPHA_CUT: '' } : {}, side: opt.doubleSide === true || cut ? 'double' : 'front' });
}

// ── neon signs: an SDF-free canvas atlas of hand-bent calligraphy; the board shows through where the tubes are not ──
export function neonMaterial(shared: Shared, tex: { mono: Texture; colour: Texture }, opt: { viewmodel?: boolean } = {}): ShaderMaterial {
  const u: Uniforms = { uMono: { value: tex.mono }, uColour: { value: tex.colour } };
  if (opt.viewmodel === true) { u['uCam'] = { value: new Vector3() }; u['uFogScale'] = { value: 0 }; }
  return LOOK_FAMILY.material('neon', shared.u, { uniforms: u });
}

// ── the silk sky (only the Crown's strip of it shows) ──
export function skyMaterial(shared: Shared): ShaderMaterial { return LOOK_FAMILY.material('sky', shared.u); }

// ── LED sky screens: a pixelated 青绿 landscape (千里江山图) at a visible dot pitch, scan roll and dead pixels ──
export function screenMaterial(shared: Shared, w: number, h: number, seed: number): ShaderMaterial {
  return LOOK_FAMILY.material('screen', shared.u, { uniforms: { uSize: { value: new Vector2(w, h) }, uSeed: { value: seed } } });
}

// ── silk fog sheets: soft cloud layers across the Well at each stratum gap (留白) ──
export function sheetMaterial(shared: Shared): ShaderMaterial { return LOOK_FAMILY.material('sheet', shared.u); }

// ── steam from the noodle pots: soft rising puffs ──
export function steamMaterial(shared: Shared): ShaderMaterial { return LOOK_FAMILY.material('steam', shared.u); }

// ── the Fei Zhua's mono-filament: a glowing ribbon of constant pixel width, sagging a little ──
export function lineMaterial(shared: Shared): { mat: ShaderMaterial; u: { uA: { value: Vector3 }; uB: { value: Vector3 }; uSag: { value: number } } } {
  const u = { uA: { value: new Vector3() }, uB: { value: new Vector3() }, uSag: { value: 0 } };
  return { mat: LOOK_FAMILY.material('line', shared.u, { uniforms: u }), u };
}
