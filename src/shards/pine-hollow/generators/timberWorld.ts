/** Pine's three placed timber landmarks and the two Explorer-only shape copies, baked once into a charged product. */
import * as THREE from 'three';
import { pineUndergrowthScene } from './undergrowth';
import { pineCabinScene } from './logCabin';
import { bake, BakedPiece, type BakedScene } from '@wildshard/sdk/bake';
import { pineLookoutScene, pineSiteTimberScene, timberDraws } from './timberScene';
import { bakeSiteTimbers } from './siteTimbers';
import { TimberRecorder } from './timberBake';
import { landingSite, bridgeSite, timberFrame, ZIP_YAW } from './timberPlacement';
import { LOOKOUT } from '../data/layout';
import { pineCragWorldScene } from './cragScene';
import type { SkinBake } from './crags';
import type { CragTier } from './cragRows';
import { pineStreamScene, type PineStreamGround } from './streams';

/** Real placement doubles and native yaw rows; runtime queries never recompute these author-owned frames. */
export function pineTimberPlacements(heightAt: (x: number, z: number) => number): { lookout: { matrix: number[]; yaw: number }; landing: { matrix: number[]; yaw: number }; bridge: { matrix: number[]; yaw: number; turn: [number, number] } } {
  const bridge = bridgeSite(heightAt);
  return {
    lookout: { matrix: [...timberFrame(LOOKOUT.x, heightAt(LOOKOUT.x, LOOKOUT.z), LOOKOUT.z, ZIP_YAW).elements], yaw: ZIP_YAW },
    landing: { matrix: [...landingSite(heightAt).at.elements], yaw: ZIP_YAW },
    bridge: { matrix: [...bridge.at.elements], yaw: bridge.yaw, turn: bridge.turn },
  };
}

/** Compile one world Scene. Library shapes never become extra world draws or colliders. */
export function pineTimberWorldBake(heightAt: (x: number, z: number) => number, project?: string, crags?: Record<CragTier, SkinBake>, streams?: PineStreamGround): BakedScene {
  const scene = new THREE.Scene(); scene.name = 'pine-hollow.timber-world';
  scene.add(pineLookoutScene(heightAt), pineSiteTimberScene(heightAt));
  const library = new BakedPiece('pine-timber-explorer', [], [], { nativeAttributes: true, compactIndex: true,
    nodeExtras: (kind, mesh) => {
      const count = mesh.geometry.getAttribute('position').count;
      return { wholePartition: { id: kind, vertexCount: count, indexCount: 0, index: 'none',
        vertices: Array.from({ length: count }, (_, i) => i), triangles: Array.from({ length: count / 3 }, (_, i) => i) } };
    } });
  bakeSiteTimbers(heightAt, new TimberRecorder((timber, _row, ordinal) => {
    if (ordinal !== 1 && ordinal !== 3) return;
    const name = ordinal === 1 ? 'zipline-landing-turntable' : 'creek-footbridge-turntable';
    for (const [key, geometry] of timberDraws(timber)) {
      const material = new THREE.MeshStandardMaterial({ roughness: 1 }); material.name = key;
      const mesh = new THREE.InstancedMesh(geometry, material, 1); mesh.setMatrixAt(0, new THREE.Matrix4());
      mesh.name = `${name}-${key}`; library.add(mesh);
    }
  }));
  scene.add(library, pineUndergrowthScene());
  if (crags !== undefined) scene.add(pineCragWorldScene(crags));
  if (streams !== undefined) { scene.add(pineStreamScene(streams)); scene.add(pineCabinScene(heightAt, true)); }
  try { return bake(scene, { slug: 'pine-hollow', name: 'Pine Hollow' }, project === undefined ? {} : { project }); }
  finally {
    scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const geometry: unknown = node.geometry, material: unknown = node.material;
      if (geometry instanceof THREE.BufferGeometry) geometry.dispose();
      if (material instanceof THREE.Material) material.dispose();
    });
  }
}
