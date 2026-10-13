import { Scene } from 'three';
import { bake, type BakedScene } from '@wildshard/sdk/bake';

/** Nalati's original navigation payload, admitted by the platform's WSNM row without resampling or reordering. */
export function navigationProduct(bytes: Uint8Array): BakedScene {
  return bake(new Scene(), { slug: 'nalati-grasslands' }, { navigation: bytes });
}
