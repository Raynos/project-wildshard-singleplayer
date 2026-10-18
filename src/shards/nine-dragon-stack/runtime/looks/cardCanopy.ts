// cardCanopy — a tree crown of painted leaf cards over a darker core (SHARD-PLATFORM M3, ex Nine Dragon's world/canopy.ts).
// The caller supplies compiled graph ids and its atlas; these passes keep the coverage/depth render states.
//
// The crown is two baked geometries over a plan's lumps: the CARDS (leaf-cluster quads lit with their lump's normal, so a
// card is part of a volume, never a flat cut-out) and the CORE (the lumps shrunk, darker, so no view sees through the
// tree). The cards draw twice: a coverage pass under the MSAA target — alpha to coverage, the colour replaced and the
// target's alpha kept, no discard — then, right after it, a plateau pass that re-draws them depth-EQUAL writing only the
// alpha (a post silhouette's inverse depth), so the post inks the leafy edge where alpha to coverage alone would have
// written the coverage. The vertex light spill is baked into both geometries like a kit's.
import {
  AddEquation, type BufferGeometry, CustomBlending, EqualDepth, LinearFilter, LinearMipmapLinearFilter, Mesh, OneFactor,
  type Material, type Texture, TextureLoader, ZeroFactor,
} from 'three';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';

/** a crown's baked geometry over a plan's lumps: the painted cards and the darker core under them */
export interface CanopyGeometry { readonly cards: BufferGeometry; readonly core: BufferGeometry }

/** Coverage preserves target alpha; the following depth-equal pass writes only plateau alpha. */
function canopyPass(m: Material, plateau: boolean): Material {
  m.alphaToCoverage = !plateau;
  m.depthWrite = !plateau;
  if (plateau) m.depthFunc = EqualDepth;
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendEquationAlpha = AddEquation;
  m.blendSrc = plateau ? ZeroFactor : OneFactor;
  m.blendDst = plateau ? OneFactor : ZeroFactor;
  m.blendSrcAlpha = plateau ? OneFactor : ZeroFactor;
  m.blendDstAlpha = plateau ? ZeroFactor : OneFactor;
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

/** Dress the baked crown with its three compiled graph looks. The atlas is required. */
export async function buildCardCanopy(
  row: { readonly cards: string; readonly plateau: string; readonly core: string; readonly atlas: string }, crown: CanopyGeometry | null,
): Promise<Mesh[]> {
  if (crown === null) return [];
  const atlas = await loadLeafAtlas(row.atlas), image: unknown = atlas.image;
  if (typeof image !== 'object' || image === null || !('width' in image) || !('height' in image)
    || typeof image.width !== 'number' || typeof image.height !== 'number' || image.width <= 0 || image.height <= 0) throw new Error('Canopy atlas needs its pixel dimensions');
  setLentTexture(row.cards, 'atlas', atlas);
  setLentParam(row.cards, 'atlasSize', [image.width, image.height]);
  const cards = new Mesh(crown.cards, canopyPass(lentLook(row.cards), false));
  const depth = new Mesh(crown.cards, canopyPass(lentLook(row.plateau), true));
  cards.renderOrder = 1;
  depth.renderOrder = 2;
  return [new Mesh(crown.core, lentLook(row.core)), cards, depth];
}
