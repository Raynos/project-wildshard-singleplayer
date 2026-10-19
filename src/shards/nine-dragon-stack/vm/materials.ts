// The viewmodel's look (lab P8 "viewmodel", E169): ONE toon program for every held / worn thing, shading by material
// class (data/decals.json classes) from baked maps, plus an inverted-hull ink outline.
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
import { BackSide, Color, DataTexture, type Material, type Matrix3, Texture, Vector2, Vector3, Vector4 } from 'three';
import { loadGraphCompiler, type GraphCompiler } from '@wildshard/engine/render/graphBackend';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { paintCanvasAtlas, type CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';
import decalRows from '../data/decals.json' with { type: 'json' };
import type { VmUniformRows } from './uniformTypes';
import type { Tier as NdTier } from '@wildshard/engine/core/tier';
import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { loadFirstPartyProduct, slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';

let compiler: GraphCompiler | null = null;
let vmRows: VmUniformRows | null = null;
/** Arms may load before the resident world lends its own graphs. */
export async function prepareVmGraphs(renderer: Renderer): Promise<void> {
  compiler = await loadGraphCompiler(renderer);
  vmRows = (await (await loadFirstPartyProduct('nine-dragon-stack')).json<{ readonly look: { readonly vm: VmUniformRows } }>('weapons/jian-row.json')).look.vm;
}

export interface Decals { tex: Texture; etch: Vector4; fu: Vector4 }
export function decalAtlas(tier: NdTier): Decals {
  const e = decalRows.JIAN_DECAL_UV.etch, f = decalRows.JIAN_DECAL_UV.fu;
  return { tex: paintCanvasAtlas(decalRows.JIAN_DECALS as CanvasAtlasRow, plumbingKnob(slugRuntimeProduct('nine-dragon-stack')?.source.plumbing, tier, 'nine.decalScale', 'number')), etch: new Vector4(e[0], e[1], e[2], e[3]), fu: new Vector4(f[0], f[1], f[2], f[3]) };
}
export type VmUniforms = UniformsOf<{ [K in keyof VmUniformRows]: VmUniformRows[K] }> & { uSilk: { value: Texture }; uDecal: { value: Texture }; uEtch: { value: Vector4 }; uFu: { value: Vector4 } };
export function vmUniforms(silk: Texture, decals: Decals): VmUniforms {
  if (vmRows === null) throw new Error('Held graph uniforms have not loaded');
  return { uSilk: { value: silk }, uDecal: { value: decals.tex }, uEtch: { value: decals.etch }, uFu: { value: decals.fu }, ...uniformsFrom({ ...vmRows }) };
}
const BLACK = new DataTexture(new Uint8Array([255, 128, 128, 255]), 1, 1);
BLACK.needsUpdate = true;
function isTexture(value: unknown): value is Texture { return value instanceof Texture; }

/** Existing part draws retain independent maps and the rig's live tuning handles. */
function graphMaterial(id: string, u: VmUniforms, maps: Texture | null, nrm: Texture | null, rotation: Matrix3 | null, width: number): Material {
  const entry = slugRuntimeProduct('nine-dragon-stack')?.source.look.materials[id];
  if (compiler === null || entry?.family !== 'graph' || !('graph' in entry)) throw new Error(`Missing held graph ${id}`);
  const graph = compiler.compileGraph(entry.graph, { trustedBudget: true });
  const material = graph.material, names = Object.keys(entry.graph.params ?? {}), scratch: number[] = [];
  const links: Record<string, { readonly value: unknown }> = { ...u, uMapsTex: { value: maps ?? BLACK }, uNrmTex: { value: nrm ?? BLACK }, uTexOn: { value: maps === null ? 0 : 1 }, uHullK: { value: width } };
  if (rotation !== null) for (const [i, axis] of ['X', 'Y', 'Z'].entries()) graph.setParam(`asset${axis}`, rotation.elements.slice(i * 3, i * 3 + 3));
  material.onBeforeRender = (_renderer, _scene, camera) => {
    for (const name of names) {
      const value: unknown = links[name]?.value;
      scratch.length = 0;
      if (value instanceof Color || value instanceof Vector2 || value instanceof Vector3 || value instanceof Vector4) graph.setParam(name, value.toArray(scratch));
      else if (isTexture(value)) graph.setTexture(name, value);
      else if (typeof value === 'number') graph.setParam(name, value);
    }
    if (names.includes('projection')) { const p = camera.projectionMatrix.elements; graph.setParam('projection', [p[0], p[5], p[10], p[14]]); }
  };
  return material;
}
export function vmMaterial(u: VmUniforms, maps: Texture | null = null, nrm: Texture | null = null, assetRot: Matrix3 | null = null): Material {
  return graphMaterial('nine-vm-body', u, maps, nrm, assetRot, 1);
}
export function inkHullMaterial(u: VmUniforms, k = 1): Material {
  const material = graphMaterial('nine-vm-hull', u, null, null, null, k); material.side = BackSide; return material;
}
