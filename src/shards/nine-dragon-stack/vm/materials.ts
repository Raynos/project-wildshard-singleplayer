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
  BackSide, CanvasTexture, type Color, DataTexture, LinearMipmapLinearFilter, Matrix3, SRGBColorSpace, ShaderMaterial, type Texture,
  type Vector2, type Vector3, Vector4,
} from 'three';
import { VM_FS, VM_HULL_FS, VM_HULL_VS, VM_UNIFORMS, VM_VS } from '../data/vmLook';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { decalScale, type NdTier } from '../tier';


const KAI = '"LXGW WenKai TC", "Kaiti TC", "STKaiti", "BiauKai", "Songti TC", serif';
const SEAL = '"Noto Serif TC", "Songti TC", serif';

/** a 祥云 scroll: three curls on a flat tail, one stroke */
function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number, flip: boolean): void {
  g.save();
  g.translate(x, y);
  if (flip) g.scale(-1, 1);
  g.beginPath();
  g.moveTo(-s * 2.6, s * 0.6);
  g.lineTo(-s * 0.6, s * 0.6);
  g.arc(-s * 0.6, 0, s * 0.6, Math.PI / 2, -Math.PI / 2, true);
  g.arc(-s * 0.6, -s * 0.3, s * 0.3, -Math.PI / 2, Math.PI / 2, true);
  g.moveTo(-s * 0.2, s * 0.6);
  g.arc(s * 0.4, -s * 0.1, s * 0.8, Math.PI * 0.8, -Math.PI * 0.2, false);
  g.arc(s * 0.55, -s * 0.25, s * 0.35, -Math.PI * 0.2, Math.PI * 0.8, false);
  g.moveTo(s, s * 0.6);
  g.arc(s * 1.35, s * 0.15, s * 0.45, Math.PI * 0.75, -Math.PI * 0.4, false);
  g.lineTo(s * 3.0, s * 0.6);
  g.stroke();
  // the inner echo line (engravers double the scroll)
  g.globalAlpha = 0.55;
  g.beginPath();
  g.arc(s * 0.4, -s * 0.1, s * 0.55, Math.PI * 0.85, -Math.PI * 0.1, false);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

/** the decal atlas: the blade etch strip (top 256 px of 2048) and the fu talisman cell */
export interface Decals { tex: Texture; etch: Vector4; fu: Vector4 }

export function decalAtlas(tier: NdTier): Decals {
  const W = 2048, H = 1024;
  const scale = decalScale(tier);
  const cv = document.createElement('canvas');
  cv.width = W * scale;
  cv.height = H * scale;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  g.scale(scale, scale); // preserve all authored UVs and drawing coordinates at phone resolution
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // ── the etch strip (x 0..2048 = blade root → tip, y 0..256 = across one flat, the ridge at y 128) ──
  const EH = 256;
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // the fuller rulings: two engraved lines either side of the ridge, fading out toward the tip
  g.lineWidth = 2.2;
  for (const y of [104, 152]) {
    g.beginPath();
    g.moveTo(40, y);
    g.lineTo(1500, y + (y < 128 ? 10 : -10));
    g.stroke();
  }
  // clouds along the fuller, alternating sides, shrinking toward the tip
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const x = 330 + i * 150 + (i % 2) * 30;
    const s = 17 - i * 1.1;
    cloud(g, x, i % 2 === 0 ? 70 : 190, s, i % 2 === 1);
  }
  // circuit rulings (the neon jian's traces): stepped lines toward the tip
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(1450, 118); g.lineTo(1640, 118); g.lineTo(1662, 100); g.lineTo(1860, 100);
  g.moveTo(1500, 140); g.lineTo(1700, 140); g.lineTo(1720, 156); g.lineTo(1900, 156);
  g.stroke();
  for (const [x, y] of [[1860, 100], [1900, 156], [1640, 118]] as const) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.stroke();
  }
  // the 卍-knot medallion near the guard (x ≈ 150) and two seal characters under it
  g.lineWidth = 4;
  g.beginPath(); g.arc(150, 128, 58, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(150, 128, 44, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3.5;
  g.strokeRect(128, 106, 44, 44);
  g.beginPath();
  g.moveTo(150, 90); g.lineTo(150, 166); g.moveTo(112, 128); g.lineTo(188, 128);
  g.stroke();
  g.fillStyle = '#fff';
  g.font = `900 38px ${SEAL}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(268, 128);
  g.rotate(Math.PI / 2);
  g.fillText('九龍', 0, 0);
  g.restore();
  // ── the talisman cell (x 0..384, y 256..1024): gamboge paper, red borders, red kai 鎮邪, a seal ──
  const fx = 0, fy = EH, fw = 384, fh = 768;
  g.fillStyle = '#e8c261';
  g.fillRect(fx, fy, fw, fh);
  let s = 11;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,190,0.35)' : 'rgba(150,100,30,0.12)';
    g.fillRect(fx + rnd() * fw, fy + rnd() * fh, 1 + rnd() * 5, 1 + rnd() * 2);
  }
  // age: a darker rim, a water stain
  const grd = g.createRadialGradient(fx + fw / 2, fy + fh / 2, fw * 0.2, fx + fw / 2, fy + fh / 2, fh * 0.62);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(120,70,20,0.35)');
  g.fillStyle = grd;
  g.fillRect(fx, fy, fw, fh);
  g.strokeStyle = '#9f2217';
  g.lineWidth = 6;
  g.strokeRect(fx + 22, fy + 22, fw - 44, fh - 44);
  g.lineWidth = 3;
  g.strokeRect(fx + 38, fy + 38, fw - 76, fh - 76);
  g.fillStyle = '#ad2418';
  g.font = `700 150px ${KAI}`;
  g.fillText('鎮', fx + fw / 2, fy + 190);
  g.fillText('邪', fx + fw / 2, fy + 360);
  g.font = `700 64px ${KAI}`;
  g.fillText('敕令', fx + fw / 2, fy + 490);
  g.fillRect(fx + fw / 2 - 48, fy + 560, 96, 96);
  g.fillStyle = '#e8c261';
  g.font = `700 56px ${SEAL}`;
  g.fillText('印', fx + fw / 2, fy + 610);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return { tex, etch: new Vector4(0, 1 - EH / H, 1, 1), fu: new Vector4(fx / W, 1 - (fy + fh) / H, (fx + fw) / W, 1 - fy / H) };
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
