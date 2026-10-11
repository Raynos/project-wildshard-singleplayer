import { BoxGeometry, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';

/** Export separately addressable tower/flame nodes without merging their geometry or changing material identity. */
export function namedNodesExample() {
  const tower = new BoxGeometry(1, 4, 1), flame = new BoxGeometry(0.3, 0.5, 0.3);
  const stone = new MeshStandardMaterial({ color: 0x888888 }), fire = new MeshStandardMaterial({ color: 0xff7700 });
  try {
    return staticGlb([
      { name: 'beacon-tower', geometry: tower, material: stone },
      { name: 'beacon-flame', geometry: flame, material: fire },
    ], 'beacon');
  } finally { tower.dispose(); flame.dispose(); stone.dispose(); fire.dispose(); }
}
