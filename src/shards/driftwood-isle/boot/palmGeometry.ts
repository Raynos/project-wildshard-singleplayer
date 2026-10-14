import { Mesh, type MeshStandardMaterial, type MeshDepthMaterial } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { modelGeometry } from '../runtime/boot/modelGeometry';
import { decodeFoliageWorld, readFoliageWorld } from './foliageGeometry';
import { PALM_FILES } from '../data/palmFiles';
import type { PalmParams } from '../models/palm';

const files = PALM_FILES[TIER === 'phone' ? 'phone' : 'desktop'];
const layout = { magic: 0x314d4c50, channels: [['position', 3], ['color', 3], ['sway', 2]] } as const;
/** Only the three authored Explorer variants have rest geometry; custom shapes refuse. */
export function palmSpecimen(p: PalmParams, material: MeshStandardMaterial, depth: MeshDepthMaterial): ReturnType<typeof loadingSpecimen> {
  const key = p.h === 8 && p.lean === 0.2 && p.fronds === 11 ? 'tall' : p.h === 5.5 && p.lean === 0.1 && p.fronds === 9 ? 'young' : p.h === 9.5 && p.lean === 0.35 && p.fronds === 13 ? 'leaning' : null;
  if (key === null || p.leanDir !== 0 || p.rot !== 0) throw new Error('Palm specimen has no authored geometry');
  return loadingSpecimen('driftwood-isle/palm', [p.h, p.h, p.h], async () => {
    const intake = modelGeometry(files[key], { _sway: 'sway' }); await intake.load();
    const mesh = new Mesh(intake.take(), material); mesh.castShadow = true; mesh.receiveShadow = true; mesh.customDepthMaterial = depth; return mesh;
  });
}
/** Validate native channels and full picking boxes before the registry can borrow them. */
export function decodePalmWorld(input: Uint8Array, copies: number): ReturnType<typeof decodeFoliageWorld> { return decodeFoliageWorld(input, copies, layout); }
/** One compacted owned geometry, with independently releasable channel buffers. */
export function loadPalmWorld(copies: number): ReturnType<typeof readFoliageWorld> { return readFoliageWorld(files.world, copies, layout); }
