// cardCanopy — a tree crown of painted leaf cards over a darker core (SHARD-PLATFORM M3, ex Nine Dragon's world/canopy.ts).
// Nothing here knows a shard: the foliage programs are the caller's shader family rows, its uniforms a row table.
//
// The crown is two baked geometries over a plan's lumps: the CARDS (leaf-cluster quads lit with their lump's normal, so a
// card is part of a volume, never a flat cut-out) and the CORE (the lumps shrunk, darker, so no view sees through the
// tree). The cards draw twice: a coverage pass under the MSAA target — alpha to coverage, the colour replaced and the
// target's alpha kept, no discard — then, right after it, a plateau pass that re-draws them depth-EQUAL writing only the
// alpha (a post silhouette's inverse depth), so the post inks the leafy edge where alpha to coverage alone would have
// written the coverage. The vertex light spill is baked into both geometries like a kit's.
import {
  AddEquation, type BufferGeometry, CustomBlending, EqualDepth, LinearFilter, LinearMipmapLinearFilter, Mesh, OneFactor,
  type ShaderMaterial, type Texture, TextureLoader, ZeroFactor,
} from 'three';
import { type ShaderFamily, type UniformMap, type UniformRows, uniformsFrom } from './shaderFamily';
import { type Emitter, bakeSpill } from './vertexSpill';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';

/** a crown's baked geometry over a plan's lumps: the painted cards and the darker core under them */
export interface CanopyGeometry { readonly cards: BufferGeometry; readonly core: BufferGeometry }

/** The coverage pass: alpha to coverage; the blend writes the colour and keeps the target's alpha. */
export function coveragePass(m: ShaderMaterial): ShaderMaterial {
  m.alphaToCoverage = true;
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = OneFactor;
  m.blendDst = ZeroFactor;
  m.blendEquationAlpha = AddEquation;
  m.blendSrcAlpha = ZeroFactor;
  m.blendDstAlpha = OneFactor;
  return m;
}

/** The plateau pass: depth-equal over the coverage pass, writing only the alpha. */
export function plateauPass(m: ShaderMaterial): ShaderMaterial {
  m.depthFunc = EqualDepth;
  m.depthWrite = false;
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = ZeroFactor;
  m.blendDst = OneFactor;
  m.blendEquationAlpha = AddEquation;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = ZeroFactor;
  return m;
}

/** a painted leaf atlas, mipmapped, anisotropic (a KTX2 copy when one is served) */
export async function loadLeafAtlas(url: string): Promise<Texture> {
  const compressed = await ktx2Texture(phoneUrl(url));
  const t = compressed ?? await new TextureLoader().loadAsync(url);
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 4;
  if (compressed === null) { t.generateMipmaps = true; t.needsUpdate = true; }
  return t;
}

/** A card canopy as data: the family's programs for the three draws, the foliage uniforms, the atlas. */
export interface CardCanopyRow<P extends string> {
  readonly cards: P;
  readonly plateau: P;
  readonly core: P;
  readonly uniforms: UniformRows;
  readonly atlas: string;
  /** what the warning names when the atlas fails */
  readonly label: string;
}

/**
 * Dress a crown's geometry: [core, cards, plateau] meshes (render orders 0, 1, 2), the foliage uniforms one object each
 * shared by the three materials, the atlas as `uAtlas` (the core reads none). None when the crown is null or the atlas
 * fails (the tree then stands bare, which shows at once).
 */
export async function buildCardCanopy<P extends string>(
  family: ShaderFamily<P>, shared: UniformMap, row: CardCanopyRow<P>, crown: CanopyGeometry | null, emitters: readonly Emitter[],
): Promise<Mesh[]> {
  if (crown === null) return [];
  try {
    const atlas = await loadLeafAtlas(row.atlas);
    const fu = uniformsFrom(row.uniforms);
    const material = (program: P, tex: Texture | null): ShaderMaterial => family.material(program, shared, { uniforms: { ...fu, uAtlas: { value: tex } } });
    const { cards: gCards, core: gCore } = crown;
    await bakeSpill([gCards, gCore], emitters);
    const cards = new Mesh(gCards, coveragePass(material(row.cards, atlas)));
    const cardsDepth = new Mesh(gCards, plateauPass(material(row.plateau, atlas)));
    cards.renderOrder = 1;
    cardsDepth.renderOrder = 2;
    const core = new Mesh(gCore, material(row.core, null));
    return [core, cards, cardsDepth];
  } catch (e: unknown) {
    console.warn(`${row.label}: the leaf atlas failed to load, the tree has no canopy`, e);
    return [];
  }
}
