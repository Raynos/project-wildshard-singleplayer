// Driftwood Isle's first-person arms (E334, DRIFTWOOD-TOP10 row 12; Jake's picks 2026-09-30: board 2 A "castaway",
// board 3 A "breaststroke" — art/driftwood-fp/round-1-remaster/): sun-browned hands with fingers round a hemp-cord grip,
// patched linen sleeves rolled to mid-forearm, the off hand in frame, both swords on the same arms, and the same arms
// swimming.
//
// The rig is public/assets/models/driftwood-fp/fp-arms.glb, built by scripts/blender/driftwood-isle/fp-arms/ (a Blender
// script models the arms and swords round Nine Dragon's round-13 skeleton; bake.mjs keeps that skeleton and its 16 clips —
// the engine's SwordMoves timing — adds 15 finger bones a hand and the swim clips, and skins it). It is played by the
// shared arm player (src/game/systems/viewmodel/rigArms.ts): three skeleton clones of one parse — the wooden sword, the iron sword and the
// swimming hands — sharing the geometry. Driftwood's toon look: flat facets, vertex colour, no textures, lit like the
// island (sky.setupMaterial: the CSM shadows and the fog). ~9.5 k triangles of arms + ~0.8 k of sword, two draws + the
// engine's trail.
//
// SHARD-PLATFORM M3: the arms are the SDK toon arms (@wildshard/sdk/viewmodel/toonArms); the look is data
// (data/fpArmsLook.ts), the GLSL too (data/fpArmsGlsl.ts).
import type { Object3D } from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ToonArms } from '@wildshard/sdk/viewmodel/toonArms';
import { FP_ARMS_GLSL } from './data/fpArmsGlsl';
import { FP_ARMS_LOOK } from './data/fpArmsLook';

const ARMS = new ToonArms(FP_ARMS_LOOK, FP_ARMS_GLSL);

/** the rigs, loaded as ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands */
export function castawayArms(): ReturnType<InstanceType<typeof ToonArms>['load']> { return ARMS.load(); }

/** the Model Explorer's card (driftwood-isle/models/gear.ts): the castaway arms at rest holding `kind`, on their own
 *  skeleton clone of the one parse (the held rigs' geometry), in camera space as held — the eye at the origin, −Z forward */
export function castawaySpecimen(sky: Sky, kind: 'wood' | 'iron'): Promise<Object3D> { return ARMS.specimen(sky, kind); }
