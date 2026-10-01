// The authored profiles belong to Pine; the hull rig is shared kit content.
import { rigLegs as build, legRigOf as cached, type LegBuilt } from '#kit';
import type { BufferGeometry } from 'three';
import type { NpcKind } from '../models/people';
import { NPC_RIGS } from './npcProfiles';

export { LEG_BONE_NAMES, WALK, footPlan, legBones, legPose, type LegBuilt } from '#kit';
export const rigLegs = (kind: NpcKind, source: BufferGeometry): LegBuilt => build(NPC_RIGS[kind], source);
export const legRigOf = (kind: NpcKind, source: BufferGeometry): LegBuilt => cached(NPC_RIGS[kind], source);
