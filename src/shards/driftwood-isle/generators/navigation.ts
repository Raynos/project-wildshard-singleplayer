import { Scene } from 'three';
import { bake, type BakedScene } from '@wildshard/sdk/bake';

/** The original navigation payload admitted by the platform's WSNM row, without resampling or reordering. */
export function navigationProduct(bytes: Uint8Array): BakedScene {
  return bake(new Scene(), { slug: 'driftwood-isle' }, { navigation: bytes });
}
