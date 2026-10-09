import type { ClipName } from '@wildshard/engine/anim/rig';
/** Metadata-only renames shared by the two authored arm rigs. Source track names stay byte-identical. */
export const ARM_CLIPS: Readonly<Partial<Record<ClipName, string>>> = {
  idle: 'idle', walk: 'walk', 'attack.light': 'light', 'attack.light2': 'light2', 'attack.light3': 'light3',
  'attack.charge': 'charge', 'attack.heavy': 'heavy', 'attack.parry': 'parry',
  'idle.sheathe': 'sheathe', 'attack.draw': 'draw', 'idle.sheathed': 'sheathed',
  'idle.left': 'idleL', 'walk.left': 'walkL',
  'attack.grapple-aim': 'grapple_aim', 'attack.grapple-fire': 'grapple_fire', 'idle.grapple-hold': 'grapple_hold',
};
export const SWIM_CLIPS: Readonly<Partial<Record<ClipName, string>>> = { 'swim.stroke': 'swimStroke', 'swim.tread': 'swimTread' };
export const armClipNames = (aliases: Readonly<Partial<Record<ClipName, string>>>): ClipName[] => Object.keys(aliases) as ClipName[];
