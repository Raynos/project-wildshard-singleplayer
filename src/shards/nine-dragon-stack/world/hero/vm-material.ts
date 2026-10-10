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
// The classes, the GLSL and the tuning are data (data/heroVm.ts); this module draws the decal atlas and makes the material.
import { CanvasTexture, type Color, type DataTexture, LinearMipmapLinearFilter, SRGBColorSpace, ShaderMaterial, type Texture, type Vector3 } from 'three';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { plainWeaveTexture } from '@wildshard/sdk/looks/weave';
import { HERO_VM, HERO_VM_FS, HERO_VM_UNIFORMS, HERO_VM_VS } from '../../data/heroVm';

/** material classes (the Kit's `kind` slot, aPat.x); values clear of the architecture kinds 0–8 */
export const VM: typeof HERO_VM = HERO_VM;

/** a 256² silk weave (the same idea as the world's), for the overlay */
export function weaveTexture(): DataTexture {
  return plainWeaveTexture();
}

/** the decal atlas: the blade's etched cloud scrolls (top half) and the fu talisman (bottom-left cell) */
export interface Decals { tex: Texture; etch: readonly [number, number, number, number]; fu: readonly [number, number, number, number] }

const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';

function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // a 祥云 scroll: three curls on a flat tail, drawn as one stroke
  g.beginPath();
  g.moveTo(x - s * 2.2, y + s * 0.6);
  g.lineTo(x - s * 0.6, y + s * 0.6);
  g.arc(x - s * 0.6, y, s * 0.6, Math.PI / 2, -Math.PI / 2, true);
  g.arc(x - s * 0.6, y - s * 0.3, s * 0.3, -Math.PI / 2, Math.PI / 2, true);
  g.moveTo(x - s * 0.2, y + s * 0.6);
  g.arc(x + s * 0.4, y - s * 0.1, s * 0.8, Math.PI * 0.8, -Math.PI * 0.2, false);
  g.arc(x + s * 0.55, y - s * 0.25, s * 0.35, -Math.PI * 0.2, Math.PI * 0.8, false);
  g.moveTo(x + s, y + s * 0.6);
  g.arc(x + s * 1.35, y + s * 0.15, s * 0.45, Math.PI * 0.75, -Math.PI * 0.4, false);
  g.lineTo(x + s * 2.6, y + s * 0.6);
  g.stroke();
}

export function decalAtlas(): Decals {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  // etch strip (y 0..128): pale engraved lines on transparent black; the shader lightens the steel by its red channel
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 2.2;
  for (let i = 0; i < 6; i++) cloud(g, 90 + i * 150 + (i % 2) * 30, 64 + (i % 2 === 0 ? -14 : 16), 15 + (i % 3) * 4);
  // circuit ruling: the "neon" jian's engraved traces along the fuller
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(10, 60); g.lineTo(300, 60); g.lineTo(320, 44); g.lineTo(520, 44);
  g.moveTo(560, 80); g.lineTo(760, 80); g.lineTo(780, 64); g.lineTo(1010, 64);
  g.stroke();
  // the 卍-knot medallion near the guard end (x ≈ 980)
  g.lineWidth = 3;
  g.beginPath(); g.arc(975, 64, 34, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(975, 64, 24, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5;
  g.strokeRect(962, 51, 26, 26);
  // the talisman (x 0..256, y 128..512 as one tall cell): gamboge paper, a red border, red kai characters, a seal
  const fx = 0, fy = 128, fw = 192, fh = 384;
  g.fillStyle = '#ecc766';
  g.fillRect(fx, fy, fw, fh);
  g.fillStyle = 'rgba(255,240,190,0.35)';
  for (let i = 0; i < 90; i++) g.fillRect(fx + ((i * 53) % fw), fy + ((i * 97) % fh), 2 + (i % 4), 1 + (i % 3));
  g.strokeStyle = '#a3241a';
  g.lineWidth = 3;
  g.strokeRect(fx + 12, fy + 12, fw - 24, fh - 24);
  g.lineWidth = 2;
  g.strokeRect(fx + 22, fy + 22, fw - 44, fh - 44);
  g.fillStyle = '#b3261a';
  g.font = `700 92px ${KAI}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('鎮', fx + fw / 2, fy + 108);
  g.fillText('邪', fx + fw / 2, fy + 214);
  g.fillRect(fx + fw / 2 - 26, fy + 280, 52, 52);
  g.fillStyle = '#ecc766';
  g.font = `700 34px ${KAI}`;
  g.fillText('敕', fx + fw / 2, fy + 306);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return { tex, etch: [0, 1 - 128 / H, 1, 1], fu: [fx / W, 1 - (fy + fh) / H, (fx + fw) / W, 1 - fy / H] };
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
