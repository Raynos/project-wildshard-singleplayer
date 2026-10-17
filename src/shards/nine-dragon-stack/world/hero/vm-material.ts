// Copied from the hero lab (the dev labs (deleted in E357 F7), round-7-lab-hero) into the clean room.
// The hero viewmodel's look (lab P4 "hero", E169): a toon program that reads the Kit's attributes (aFace / aPat / aMisc)
// but shades by MATERIAL CLASS instead of by architecture pattern, plus an inverted-hull ink outline.
//
// - Class lives in aPat.x (the Kit's `kind`): VM.brass, VM.steel, VM.lacquer, VM.matte (cloth, leather, glove, skin),
//   VM.silk (the tassel / cord), VM.paper (the talisman, a decal cell), VM.glow (the neon edge; emit in aMisc.x).
// - Metal is toon: 3 antialiased bands of a fixed view-space key light (the sky screens above) + ONE narrow specular
//   band (a studio window) + a lit rim on the upper side. Loop 1 used a whole painted studio in the reflection and it
//   blew brass and lacquer out to white; the targets' brass is mostly mid gold with thin pale streaks, the blade black.
// - Matte is 3 hard bands of a key light from the upper left + a thin rim on the lit side (a painter's reflected light).
// - Built parts keep the Kit's ruled face edges (aMisc.y weight, aMisc.w edge bits) in 焦墨; living parts (matte, silk)
//   get none — their outline is the hull's brush line.
// The classes, GLSL and tuning stay in heroVm; the decal atlas is authored JSON.
import { type Color, type DataTexture, ShaderMaterial, type Texture, type Vector3 } from 'three';
import * as v from 'valibot';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { plainWeaveTexture } from '../../runtime/looks/weave';
import { paintCanvasAtlas, type CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';
import decalRows from '../../data/decals.json' with { type: 'json' };
import { HERO_VM, HERO_VM_FS, HERO_VM_UNIFORMS, HERO_VM_VS } from '../../runtime/looks/heroVm';

/** material classes (the Kit's `kind` slot, aPat.x); values clear of the architecture kinds 0–8 */
export const VM: typeof HERO_VM = HERO_VM;

/** a 256² silk weave (the same idea as the world's), for the overlay */
export function weaveTexture(): DataTexture {
  return plainWeaveTexture();
}

/** the decal atlas: the blade's etched cloud scrolls (top half) and the fu talisman (bottom-left cell) */
export interface Decals { tex: Texture; etch: readonly [number, number, number, number]; fu: readonly [number, number, number, number] }

/** The authored hero atlas, on the same canvas painter as the Jian. */
export function decalAtlas(): Decals {
  const rect = v.tuple([v.number(), v.number(), v.number(), v.number()]);
  return { tex: paintCanvasAtlas(decalRows.HERO_DECALS as CanvasAtlasRow), etch: v.parse(rect, decalRows.HERO_DECAL_UV.etch), fu: v.parse(rect, decalRows.HERO_DECAL_UV.fu) };
}

export interface VmUniforms {
  uSilk: { value: Texture };
  uDecal: { value: Texture };
  uEtch: { value: [number, number, number, number] };
  uFu: { value: [number, number, number, number] };
  uKey: { value: Vector3 };
  uInk: { value: Color };
  uLinePx: { value: number };
  uSutra: { value: number };
  uGold: { value: Color };
}

export function vmUniforms(silk: Texture, decals: Decals): VmUniforms {
  return { uSilk: { value: silk }, uDecal: { value: decals.tex }, uEtch: { value: [...decals.etch] }, uFu: { value: [...decals.fu] }, ...uniformsFrom(HERO_VM_UNIFORMS) };
}

export function vmMaterial(u: VmUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uSilk: u.uSilk, uDecal: u.uDecal, uEtch: u.uEtch, uFu: u.uFu, uKey: u.uKey, uInk: u.uInk, uLinePx: u.uLinePx, uSutra: u.uSutra, uGold: u.uGold },
    vertexShader: HERO_VM_VS,
    fragmentShader: HERO_VM_FS,
    vertexColors: true,
  });
}
