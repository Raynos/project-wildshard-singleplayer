import { loadRigFile } from '@wildshard/engine/anim/rig';
import { TIER } from '@wildshard/engine/core/tier';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
/**
 * The camp's people as generated + rigged models (NALATI-MERGE D2) — the user's pick (N20: "Models 3D local ai model is
 * best"): Nalati's pipeline, the image-to-3D mesh with its base-colour atlas (TRELLIS.2 / Hunyuan3D-2 → Blender normalise
 * → gltf-transform), the five atlases packed into one texture here. (D2's other take, main's faceted Blender pipeline,
 * lost and left the tree; Q2's procedural figures stay in campPeople.ts as the rig's frame and the fallback.)
 *
 * Files: `public/assets/nalati/models/people/<person>.gen[.phone].glb` (metres, +Y up, feet on y = 0, facing +z;
 * references art/nalati-grasslands/round-10-models-merge/). Their faces are NALATI-FINISH B5's remaster, Jake's pick
 * D (E343, 2026-09-30): scripts/img2mesh/build_faces.sh paint — the head replaced by a Hunyuan3D-2 bust (generated from a
 * codex front portrait, art/nalati-grasslands/round-12-faces/) with its own all-round paint, no portrait projected, cut
 * at its own neck and blended onto the body's (face_remaster.py --graft-v2), re-UV'd face first (the face ~25–35 % of the
 * atlas, was ~2 %); each file carries its neck cut (glTF extras.neckCut, read below).
 *
 * The rig is the procedural figures' own (src/shards/nalati-grasslands/campPeople.ts): per figure a ROOT (the feet: its yaw + breath), a
 * HEAD bone at the neck and a right-ARM bone at the shoulder — so the one runtime (turn to you, glance, nod, gesture, the
 * cook's stir, the child's skip) drives both. All five figures are ONE SkinnedMesh on a 15-bone skeleton: 1 draw +
 * 1 shadow draw, as the procedural BatchedMesh. The weights are made at load, per figure, from its own mesh:
 *   1. fit     scaled to the procedural figure's height, feet on y = 0, centred;
 *   2. pivots  the neck at the narrowest cross-section near the procedural neck, the shoulder at the torso's edge below it;
 *   3. seed    head = above the neck; arm = the figure's right (−x) past the shoulder and near the shoulder → hand line
 *              (the hand: the lowest far-right point), anything it holds (the ladle, the whip) with it;
 *   4. smooth  Laplacian passes over the welded surface blur the head and arm borders into a soft neck and shoulder;
 *   5. unpose  the A-pose arm swung down to the procedural arm's rest (blended by its weight), so the same swings read.
 */
import * as THREE from 'three';
import { rawFromGltf } from './world/glbPaint';


import { fitNpcFigure, mergeNpcFigures, type NpcFigureFrame as PersonFrame, type NpcFigureRig as PeopleRig } from './models/npc/figureRig';


const DIR = '/assets/nalati/models/people/';

/** the model file of each figure (the ids are campPeople.ts's) */
export const PERSON_FILE = { elder: 'elder', herderGate: 'herder-dauren', herderRail: 'herder-erlan', child: 'child', cook: 'cook' } as const;
export type PersonKey = keyof typeof PERSON_FILE;

export function peopleModelUrl(key: PersonKey): string {
  return `${DIR}${PERSON_FILE[key]}.gen${TIER === 'phone' ? '.phone' : ''}.glb`;
}

/**
 * Load the five figures and rig them as one SkinnedMesh. `frames` = the procedural figures (their heights and
 * pivots; campPeople.ts). The bones' world matrices are the runtime's to write (`matrixWorld`, no parents): root = the
 * body matrix, head = root × (neck, the head turn), arm = root × (shoulder, the arm swing) — as the BatchedMesh pieces.
 */
export async function loadPeopleRig<K extends PersonKey>(sky: Sky, frames: Record<K, PersonFrame>, models?: Record<K, string>): Promise<PeopleRig<K>> {
  const keys = Object.keys(frames) as K[];
  const figs = await Promise.all(keys.map(async (key) => {
    const gltf = await loadRigFile(models?.[key] ?? peopleModelUrl(key));
    const r = rawFromGltf(gltf.scene, `person ${key}`);
    const cuts: number[] = [];
    gltf.scene.traverse((o) => { const v: unknown = o.userData['neckCut']; if (typeof v === 'number') cuts.push(v * frames[key].height); });
    return fitNpcFigure(key, r.geometry, r.map, frames[key], cuts[0] ?? null);
  }));
  return mergeNpcFigures(figs, (map) => {
    const mat = painterlyMaterial(sky, { map, rim: 0.35, bands: 0.8 });
    mat.side = THREE.DoubleSide;
    return mat;
  }, 'nalati-camp-people-gen', TIER === 'phone' ? 256 : 512);
}
