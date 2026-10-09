// The authored profiles belong to Pine; the hull rig is shared kit content.
import { rigLegs as build, legRigOf as cached, type LegBuilt } from '@wildshard/game/systems/npc/npcRig';
import type { BufferGeometry } from 'three';
import type { NpcKind } from '../models/people';
import { NPC_RIGS } from './npcProfiles';

export const rigLegs = (kind: NpcKind, source: BufferGeometry): LegBuilt => build(NPC_RIGS[kind], source);
export const legRigOf = (kind: NpcKind, source: BufferGeometry): LegBuilt => cached(NPC_RIGS[kind], source);
