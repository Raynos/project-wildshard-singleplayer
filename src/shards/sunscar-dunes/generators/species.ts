import { BoxGeometry, ConeGeometry, IcosahedronGeometry, MeshStandardMaterial, type BufferGeometry } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { placed, skinParts } from '@wildshard/sdk/species/rigidSkin';

/**
 * Build-time only (SHARD-PLATFORM SF72, SF67 fix 3 "bake the code-built worlds"): the sand skitterer's code-built body,
 * baked offline (`scripts/bake-signal-rigs.mjs` → `rigs/skitterer.glb`). The client reads it as one skinned geometry
 * (`world/meshes.ts` duneRig): positions, the parts' flat colours and the bone each part rides, as `_JOINTS` / `_WEIGHTS`;
 * no normals, because the client recomputes them from the same positions. The two generated bodies (the strider, the
 * Matriarch) keep their skinning in the client: baked, their float positions cost more than the files they replace.
 */

const SHELL: [number, number, number] = [0.2, 0.09, 0.05], BELLY: [number, number, number] = [0.32, 0.17, 0.09], LEG: [number, number, number] = [0.12, 0.06, 0.04];

/** A low sand beetle: a domed shell, a wedge head with mandibles, three legs a side, a short barbed tail. */
export function skittererGeometry(): BufferGeometry {
  const parts = [
    { geometry: placed(new IcosahedronGeometry(0.34, 1), 0, 0.26, 0, [1, 0.5, 1.35]), color: SHELL, bone: 0 },
    { geometry: placed(new BoxGeometry(0.4, 0.1, 0.6), 0, 0.14, 0), color: BELLY, bone: 0 },
    { geometry: placed(new IcosahedronGeometry(0.17, 0), 0, 0.22, 0.5, [1.1, 0.7, 1]), color: SHELL, bone: 1 },
    { geometry: placed(new ConeGeometry(0.04, 0.24, 4), 0.09, 0.18, 0.66, [1, 1, 1], [Math.PI / 2, 0, 0.3]), color: BELLY, bone: 1 },
    { geometry: placed(new ConeGeometry(0.04, 0.24, 4), -0.09, 0.18, 0.66, [1, 1, 1], [Math.PI / 2, 0, -0.3]), color: BELLY, bone: 1 },
    { geometry: placed(new ConeGeometry(0.06, 0.5, 4), 0, 0.3, -0.62, [1, 1, 1], [-Math.PI / 2 - 0.5, 0, 0]), color: SHELL, bone: 4 },
  ];
  for (const side of [-1, 1]) for (const z of [-0.22, 0, 0.22]) {
    parts.push({ geometry: placed(new BoxGeometry(0.42, 0.04, 0.04), side * 0.36, 0.12, z, [1, 1, 1], [0, 0, side * -0.5]), color: LEG, bone: side < 0 ? 2 : 3 });
  }
  return skinParts(parts);
}

/** The skitterer's rig file: its skinned body without normals, the bone indices and weights as custom attributes. */
export function bakeSignalSkitterer(): { glb: Uint8Array } {
  const geometry = skittererGeometry(); geometry.deleteAttribute('normal');
  const material = new MeshStandardMaterial({ name: 'sunscar.skitterer', vertexColors: true });
  return { glb: staticGlb([{ geometry, material, castShadow: false, customAttributes: { _JOINTS: 'skinIndex', _WEIGHTS: 'skinWeight' } }], 'sunscar.skitterer') };
}
