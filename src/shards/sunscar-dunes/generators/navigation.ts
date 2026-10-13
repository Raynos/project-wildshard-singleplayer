import { Scene } from 'three';
import { bake, type BakedScene } from '@wildshard/sdk/bake';

/** Declare original navigation through the same author bake as the world, without changing bytes. */
export function navigationProduct(bytes: Uint8Array): BakedScene { return bake(new Scene(), { slug: 'sunscar-dunes' }, { navigation: bytes }); }
