import { Scene } from 'three';
import { bake, type BakedScene } from '@wildshard/sdk/bake';

/** Admit the original WSNM bytes without resampling or changing their ordered query layers. */
export function navigationProduct(bytes: Uint8Array): BakedScene {
  return bake(new Scene(), { slug: 'nine-dragon-stack' }, { navigation: bytes });
}
