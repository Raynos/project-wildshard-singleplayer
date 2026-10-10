// The viewmodel's look (lab P8 "viewmodel", E169): ONE toon program for every held / worn thing, shading by material
// class (geo.ts CLS) from baked maps, plus an inverted-hull ink outline.
//
// - Maps come as data, per vertex (`color`: a procedural piece or a vertex-baked GLB such as the TRELLIS guard) or from
//   a texture pair (a Blender GLB: `<name>-maps.webp` r AO · g curvature · b detail, `<name>-nrm.webp` object-space
//   normals in Blender axes). AO darkens crevices toward umber, curvature < 0.3 draws a crease in ink (the gongbi
//   line inside a form), > 0.65 lights a worn edge, detail modulates the wash (stitches, engraving, weave, grime).
// - Metal (brass / dark brass / gold thread): 3 antialiased bands of a fixed view-space key light (the sky screens,
//   upper left), ONE narrow studio highlight band, a worn-edge light, and a faint two-tone street reflection (cool sky
//   above, warm neon wet street below) — lab P4's lesson: a full environment blows brass out to plastic.
// - Steel (the blade): near black; a long cool reflection band slides along the flat as the blade turns; the etch
//   decal (cloud scrolls, circuit rulings, the 卍 medallion) is pale engraved steel.
// - Lacquer: black with one sharp white highlight. Matte (leather, glove, cloth, sleeve, trim, silk, carbon, skin): 3
//   hard bands, never black, a painter's rim on the lit side; leather gets a cool narrow sheen, silk a grazing sheen.
// - The neon spill: the blade's cyan edge lights what is near it (the guard, the glove, the tassel) with an inverse-
//   square falloff from the blade's line (uBladeA → uBladeB, view space) — cheap, and it makes the blade a light.
// - Built parts keep ruled lines (aFace/aMat.w edge bits); living parts get their outline from the hull's brush.
// - The hull (inkHullMaterial): back faces pushed out a constant pixel width along an averaged normal; living classes
//   swell and thin along the stroke (a dry brush), built classes stay ruled. The glow gets none.
import {
  BackSide, type Color, DataTexture, Matrix3, ShaderMaterial, type Texture,
  type Vector2, type Vector3, Vector4,
} from 'three';
import { VM_FS, VM_HULL_FS, VM_HULL_VS, VM_UNIFORMS, VM_VS } from '../data/vmLook';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { paintCanvasAtlas } from '@wildshard/sdk/looks/canvasAtlas';
import { JIAN_DECALS, JIAN_DECAL_UV } from '../data/decals';
import { decalScale, type NdTier } from '../tier';


/** the decal atlas: the blade etch strip (top 256 px of 2048) and the fu talisman cell */
export interface Decals { tex: Texture; etch: Vector4; fu: Vector4 }

/** the jian's decal atlas (data/decals.ts JIAN_DECALS), painted at the tier's decal scale */
export function decalAtlas(tier: NdTier): Decals {
  const e = JIAN_DECAL_UV.etch, f = JIAN_DECAL_UV.fu;
  return { tex: paintCanvasAtlas(JIAN_DECALS, decalScale(tier)), etch: new Vector4(e[0], e[1], e[2], e[3]), fu: new Vector4(f[0], f[1], f[2], f[3]) };
}



export interface VmUniforms {
  uPal: { value: Color[] };
  uSilk: { value: Texture };
  uDecal: { value: Texture };
  uEtch: { value: Vector4 };
  uFu: { value: Vector4 };
  uKey: { value: Vector3 };
  uInk: { value: Color };
  uLinePx: { value: number };
  uSutra: { value: number };
  uGold: { value: Color };
  uEnvHi: { value: Color };
  uEnvLo: { value: Color };
  uBladeA: { value: Vector3 };
  uBladeB: { value: Vector3 };
  uSpill: { value: Vector4 };
  uTune: { value: Vector4 };
  uExposure: { value: number };
  uDetail: { value: number };
  uRes: { value: Vector2 };
  uHullPx: { value: number };
  uTime: { value: number };
}

export function vmUniforms(silk: Texture, decals: Decals): VmUniforms {
  return { uSilk: { value: silk }, uDecal: { value: decals.tex }, uEtch: { value: decals.etch }, uFu: { value: decals.fu }, ...uniformsFrom(VM_UNIFORMS) };
}

const BLACK = new DataTexture(new Uint8Array([255, 128, 128, 255]), 1, 1);
BLACK.needsUpdate = true;

/**
 * the program; `maps` / `nrm` given = a textured asset (its own material instance sharing every other uniform).
 * (E283, Jake's pick: the lighter viewmodel) one pass: the sleeves and the gauntlet are double-sided and transparent, so
 * three drew their back faces and then their front faces — two passes over a fifth of the phone frame (forceSinglePass
 * only acts on a double-sided material: the parts made double-sided after this keep it)
 */
export function vmMaterial(u: VmUniforms, maps: Texture | null = null, nrm: Texture | null = null, assetRot: Matrix3 | null = null): ShaderMaterial {
  return new ShaderMaterial({
    forceSinglePass: true,
    uniforms: {
      uPal: u.uPal, uSilk: u.uSilk, uDecal: u.uDecal, uEtch: u.uEtch, uFu: u.uFu, uKey: u.uKey, uInk: u.uInk, uLinePx: u.uLinePx,
      uSutra: u.uSutra, uGold: u.uGold, uEnvHi: u.uEnvHi, uEnvLo: u.uEnvLo, uBladeA: u.uBladeA, uBladeB: u.uBladeB, uSpill: u.uSpill,
      uTune: u.uTune, uExposure: u.uExposure, uDetail: u.uDetail,
      uMapsTex: { value: maps ?? BLACK }, uNrmTex: { value: nrm ?? BLACK }, uTexOn: { value: maps === null ? 0 : 1 },
      uAssetRot: { value: assetRot ?? new Matrix3() },
    },
    vertexShader: VM_VS,
    fragmentShader: VM_FS,
    vertexColors: true,
  });
}


/** the ink hull; `k` scales the width for one group (a fine part such as the tassel wants a thinner line) */
export function inkHullMaterial(u: VmUniforms, k = 1): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRes: u.uRes, uHullPx: u.uHullPx, uInk: u.uInk, uSutra: u.uSutra, uGold: u.uGold, uHullK: { value: k } },
    vertexShader: VM_HULL_VS,
    fragmentShader: VM_HULL_FS,
    side: BackSide,
  });
}
