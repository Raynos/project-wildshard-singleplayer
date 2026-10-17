import { bindRig, loadRigFile } from '@wildshard/engine/anim/rig';
import { TIER } from '@wildshard/engine/core/tier';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
/** Camp skins are fitted, weighted and merged offline by generators/bake-people.mjs.
 * The page retains the original tier's canvas atlas and the same root/head/arm pose interface.
 * Procedural people remain the loading/failure fallback; camp and Explorer share these skins. */
import * as THREE from 'three';
import frameRows from './boot/peopleFrames.generated.json' with { type: 'json' };

const DIR = '/assets/nalati/models/people/';

/** the model file of each figure (the ids are campPeople.ts's) */
export type PersonKey = keyof typeof frameRows;

export function peopleModelUrl(key: PersonKey): string {
  return `${DIR}${frameRows[key].file}.gen${TIER === 'phone' ? '.phone' : ''}.glb`;
}

/** The prepared rig retains the procedural frame and detached world-matrix pose ABI. */
export interface NpcFigureFrame { height: number; neck: THREE.Vector3; shoulder: THREE.Vector3 }
export interface NpcFigureBones { root: THREE.Bone; head: THREE.Bone; arm: THREE.Bone; neck: THREE.Vector3; shoulder: THREE.Vector3 }
export interface NpcFigureRig<K extends string> { mesh: THREE.SkinnedMesh; bones: Record<K, NpcFigureBones> }

function isPreparedSkin(value: THREE.Object3D | undefined): value is THREE.SkinnedMesh {
  return value instanceof THREE.SkinnedMesh && value.geometry instanceof THREE.BufferGeometry;
}

/** Offline-conditioned geometry uses the original browser canvas atlas, without image re-encoding. */
export async function loadPeopleRig<K extends PersonKey>(sky: Sky, frames: Record<K, NpcFigureFrame>, models?: Record<K, string>): Promise<NpcFigureRig<K>> {
  const keys = Object.keys(frames) as K[];
  const selection = keys.length === 1 ? keys[0] : 'camp';
  if (selection === undefined || keys.length !== 1 && keys.join(',') !== Object.keys(frameRows).join(',')) throw new Error('Unbaked camp figure selection');
  const [file, sources] = await Promise.all([
    loadRigFile(`/assets/nalati/baked/people/${selection}${TIER === 'phone' ? '.phone' : ''}.glb`),
    Promise.all(keys.map(key => loadRigFile(models?.[key] ?? peopleModelUrl(key)))),
  ]);
  const mesh = file.scene.getObjectByProperty('isSkinnedMesh', true);
  if (!isPreparedSkin(mesh)) throw new Error('Missing prepared camp skin');
  const cell = TIER === 'phone' ? 256 : 512;
  const canvas = document.createElement('canvas'); canvas.width = cell * 3; canvas.height = cell * 2;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Camp atlas canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  sources.forEach((source, i) => {
    const figure = source.scene.getObjectByProperty('isMesh', true);
    if (!(figure instanceof THREE.Mesh)) throw new Error('Missing camp atlas source');
    const sourceMaterial: unknown = figure.material;
    const material: unknown = Array.isArray(sourceMaterial) ? sourceMaterial[0] : sourceMaterial;
    if (material instanceof THREE.MeshStandardMaterial && material.map !== null) ctx.drawImage(material.map.image as CanvasImageSource, i % 3 * cell, Math.floor(i / 3) * cell, cell, cell);
  });
  const map = new THREE.CanvasTexture(canvas); map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const material = painterlyMaterial(sky, { map, rim: 0.35, bands: 0.8 }); material.side = THREE.DoubleSide;
  for (const old of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) old.dispose();
  mesh.material = material; mesh.name = 'nalati-camp-people-gen';
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  const bones = {} as Record<K, NpcFigureBones>;
  for (const key of keys) {
    const bone = (part: string): THREE.Bone => {
      const value = mesh.skeleton.bones.find(entry => entry.name === `${key}-${part}`);
      if (value === undefined) throw new Error('Missing prepared camp joint');
      value.removeFromParent(); value.matrixAutoUpdate = false; value.matrixWorldAutoUpdate = false; return value;
    };
    const root = bone('root'), head = bone('head'), arm = bone('arm');
    bones[key] = { root, head, arm, neck: head.position.clone(), shoulder: arm.position.clone() };
  }
  const names = mesh.skeleton.bones.map(bone => bone.name);
  bindRig(mesh, [], { skeleton: 'npc.figures.v1', clips: [], sockets: [] }, { skeleton: 'npc.figures.v1', joints: [names] });
  return { mesh, bones };
}
