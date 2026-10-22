import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import type { BufferGeometry, Texture } from 'three';
import type { SignAtlas } from '../runtime/productSections.generated';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { layoutReviver } from './layoutBake';

export interface BakedSigns {
  readonly keys: Readonly<Record<string, string>>;
  readonly copies: SignAtlas['copies'];
  readonly glyphLayout: SignAtlas['glyphLayout'];
  readonly textures: { readonly mono: Texture; readonly colour: Texture; readonly sdf: Texture };
  readonly geometry: (name: string) => BufferGeometry;
}

/** Sign metadata references textures and mutable geometries owned by the shared scene host. */
export async function loadSignAtlas(tier: 'phone' | 'desktop', scenes: SceneHandles): Promise<BakedSigns> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const rows = JSON.parse(new TextDecoder().decode(await product.file(`signs/atlas-${tier}.json`)), layoutReviver) as SignAtlas;
  const textures = { mono: scenes.texture('signs.mono'), colour: scenes.texture('signs.colour'), sdf: scenes.texture('signs.sdf') };
  return { keys: rows.keys, glyphLayout: rows.glyphLayout, textures,
    copies: rows.copies,
    geometry: name => { const geometry = scenes.geometry(`signs.${name}`); return name === 'world' ? geometry : geometry.clone(); },
  };
}
