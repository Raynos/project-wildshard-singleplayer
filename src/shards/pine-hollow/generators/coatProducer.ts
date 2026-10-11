import { readRigRest } from '@wildshard/sdk/bake/rig';
import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';
import * as THREE from 'three';
import { PINE_HULLS } from '../data/creatureHulls';
import { coatVariant, COAT_PALETTES } from './coatRecipes';
import { coatDiffers, paintCoatPixels, type CoatBone, type CoatSpec } from './coatPixels';
import { pressFlap } from './coatFlap';

/** One lossless coat product; the key retains the KTX2 table's original identity. */
export interface CoatProduct { readonly key: string; readonly image: string; readonly png: Uint8Array; readonly pixels: Uint8ClampedArray; readonly width: number; readonly height: number }

/** Read one retained skin's rest geometry and embedded atlas without installing a renderer or a game service. */
export async function readCoatRig(glb: Uint8Array, name: string): Promise<{ geometry: THREE.BufferGeometry; map: THREE.Texture; bones: CoatBone[]; pixels: Uint8ClampedArray; width: number; height: number; flap: Uint8Array | null }> {
  const rest = await readRigRest(glb), geometry = rest.geometry;
  const pa = geometry.getAttribute('position').array, na = geometry.getAttribute('normal').array, ia = geometry.getIndex()?.array;
  if (!(pa instanceof Float32Array) || !(na instanceof Float32Array) || ia === undefined) throw new Error('Coat rig requires Float32 rest channels');
  const trim = PINE_HULLS.flaps?.[name], flap = trim === undefined ? null : pressFlap(pa, na, ia, trim);
  const decoded = await readImagePixels(rest.colourImage);
  const map = new THREE.Texture(); map.flipY = false;
  const bones: CoatBone[] = rest.bones.map(bone => ({ name: bone.name, pos: bone.pos }));
  return { geometry, map, bones, pixels: decoded.pixels, width: decoded.width, height: decoded.height, flap };
}

/** Author Pine's lossless coat pages in Node, reading only data recipes and committed asset bytes. */
export async function producePineCoats(readAsset: (url: string) => Promise<Uint8Array>, tier: 'phone' | 'desktop'): Promise<CoatProduct[]> {
  const products: CoatProduct[] = [];
  for (const name of PINE_HULLS.rigs) {
    const authored = PINE_HULLS.coats[name];
    if (authored === undefined) throw new Error(`Missing authored coat for ${name}`);
    // The King's own atlas needs no paint, and his runtime-only body has no coat recipe to borrow.
    if (authored.source[0] === 'antler-king') {
      if (PINE_HULLS.flaps?.[name] !== undefined || Object.entries(PINE_HULLS.hulls).some(([kind, hull]) => hull === name && kind !== authored.source.join(':'))) throw new Error('Runtime-only King cannot repaint an authored coat');
      continue;
    }
    const palette = COAT_PALETTES[authored.palette];
    if (palette === undefined) throw new Error(`Missing authored palette ${authored.palette}`);
    const spec: CoatSpec = { ...authored, palette };
    const source = coatVariant(authored.source[0], authored.source[1]);
    const rigUrl = `/assets/pine-hollow/creatures/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`;
    const rig = await readCoatRig(await readAsset(rigUrl), name);
    for (const [key, hull] of Object.entries(PINE_HULLS.hulls)) {
      if (hull !== name) continue;
      const [kind, id] = key.split(':');
      if (kind === undefined || id === undefined) throw new Error('Malformed authored coat key');
      const variant = coatVariant(kind, id);
      if (!coatDiffers(spec, variant, source.tint) && rig.flap === null) continue;
      const pixels = new Uint8ClampedArray(rig.pixels);
      paintCoatPixels(spec, rig, variant, rig.bones, pixels, rig.width, rig.height, source.tint);
      const image = rigUrl.replace(/\.rigged\.glb$/u, `.${kind}.${id}.coat.png`);
      const png = await writeImagePixels({ pixels, width: rig.width, height: rig.height });
      products.push({ key: `procedural:${image}`, image, png, pixels, width: rig.width, height: rig.height });
    }
    rig.geometry.dispose(); rig.map.dispose();
  }
  return products;
}

