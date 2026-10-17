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
// island (the graph toon look, data/fpArmsLook.ts FP_ARMS_GRAPHS). ~9.5 k triangles of arms + ~0.8 k of sword, two draws +
// the engine's trail.
//
// SHARD-PLATFORM M3: the arms are the toon arms (runtime/viewmodel/toonArms.ts); the look is data (data/fpArmsLook.ts).
import type { Object3D, Group, Material } from 'three';
import { createClientScene } from '@wildshard/game/plugin/ui';
import { fixedDraw } from './boot/blobAssets';
import { driftwoodRows } from './boot/rows';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ToonArms, type ToonArmsLooks } from './viewmodel/toonArms';

let rig: ToonArms | null = null;
const arms = (): ToonArms => { rig ??= new ToonArms(driftwoodRows('custom/fixedLayouts').nativeView.FP_ARMS_LOOK); return rig; };

/** lend the compiled arm graphs (FP_ARMS_MATERIALS) and their toon look's follow, before any arms are dressed; returns
 *  the release */
export function lendCastawayArms(looks: ToonArmsLooks, follow: () => void): () => void { return arms().lend(looks, follow); }

/** the rigs, loaded as ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands */
export function castawayArms(): ReturnType<InstanceType<typeof ToonArms>['load']> { return arms().load(); }

/** the Model Explorer's card (driftwood-isle/runtime/models/gear.ts): the castaway arms at rest holding `kind`, on their own
 *  skeleton clone of the one parse (the held rigs' geometry), in camera space as held — the eye at the origin, −Z forward */
export function castawaySpecimen(sky: Sky, kind: 'wood' | 'iron'): Promise<Object3D> { return arms().specimen(sky, kind); }

/** Authored world pickup scene: original owned copies and borrowed world graph materials. */
export function buildIronSwordDisplay(materials: ReadonlyMap<string, Material>): Group {
  const blade = materials.get(driftwoodRows('custom/fixedLayouts').nativeView.FP_ARMS_MATERIALS.pickupBlade), fittings = materials.get(driftwoodRows('custom/fixedLayouts').nativeView.FP_ARMS_MATERIALS.pickupFittings);
  if (blade === undefined || fittings === undefined) throw new Error('Iron sword display requires its graph materials');
  const made=createClientScene(driftwoodRows('custom/fixedLayouts').ironSword,{
    geometry: new Map([['blade', fixedDraw('ironSwordBlade').copy()], ['fittings', fixedDraw('ironSwordFittings').copy()]]),
    materials: new Map([['blade', blade], ['fittings', fittings]]),
  });
  const root=made.group('pickup');if(root===null)throw new Error('Iron sword display requires its declared group');return root;
}
