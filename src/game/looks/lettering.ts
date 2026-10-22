import * as THREE from 'three';
import { unzlibSync } from 'fflate';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';

const decode = (data: string): Uint8Array => unzlibSync(Uint8Array.from(atob(data), c => c.codePointAt(0) ?? 0));

/** Painted lettering: the RGBA8 atlas (zlib, base64) as the painterly material's mipmapped sRGB map. */
export function letteringMaterial(sky: SkyRig | null, row: { readonly width: number; readonly height: number; readonly data: string; readonly rim: number }): THREE.Material {
  const bytes = decode(row.data); if (bytes.length !== row.width * row.height * 4) throw new Error('Label atlas byte count differs');
  const atlas = new THREE.DataTexture(bytes, row.width, row.height);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4; atlas.flipY = true; atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.needsUpdate = true;
  const material = painterlyMaterial(sky, { rim: row.rim }); material.map = atlas; return material;
}
