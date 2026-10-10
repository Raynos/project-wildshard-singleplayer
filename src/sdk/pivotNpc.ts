import type { BufferGeometry, Group } from 'three';
import type { NpcDef } from '@wildshard/engine/quest/core';
import type { LevelContext } from '@wildshard/engine/level/context';
import { npcDef as platformDef, type NpcRow } from '@wildshard/game/quest/npcRow';
import { installPivotNpc as platformInstall, pivotNpcParts as platformParts, type PivotNpc as PlatformNpc, type PivotNpcPorts as PlatformPorts } from '@wildshard/game/quest/pivotNpc';

/** A quest-giver's pivot figure in the world: its group, its head (the talk anchor), its speaker and its motion. */
export type PivotNpc = PlatformNpc;
/** What a pivot NPC is lent: the model, the ground, the player, its met flag, the piece's file and the shard's dressing. */
export type PivotNpcPorts = PlatformPorts;
/** The engine's NpcDef for an NPC row's talk. */
export function npcDef(row: NpcRow): NpcDef { return platformDef(row); }
/** An NPC row's figure on its pivots (body, head at the neck, arm at the shoulder) at its own origin. */
export function pivotNpcParts(row: NpcRow, source: BufferGeometry): { root: Group; head: Group; arm: Group } { return platformParts(row, source); }
/** Installs an NPC row's quest-giver: the figure, its solid column piece and its motion (SF27). */
export function installPivotNpc(ctx: Pick<LevelContext, 'root' | 'piece' | 'system'>, row: NpcRow, ports: PlatformPorts): PlatformNpc { return platformInstall(ctx, row, ports); }
