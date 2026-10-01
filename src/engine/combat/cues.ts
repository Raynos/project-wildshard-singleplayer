import type { Vector3 } from 'three';
import type { CueOpts, CueMap } from '../audio/Cues';
import type { EquipmentRow, EquipmentId } from './Equipment';
import type { ImpactSurface } from './Weapon';
import type { CueId } from './effects/types';

export interface CombatCueOpts extends CueOpts {
  point?: Vector3; dir?: Vector3 | -1 | 1; speed?: number; heavy?: boolean; killed?: boolean; clang?: 'wood' | 'stone';
  headshot?: boolean; kind?: string; phase?: string;
}
export type CombatCueMap = (id: CueId, opts: CombatCueOpts) => boolean;
export type WeaponChargePhase = 'heavy' | 'draw' | 'letdown' | 'loose' | 'throw' | 'brace-on' | 'brace-off' | 'recover';
declare module '../events/maps' {
  interface EventMap {
    'weapon.fired': { id: EquipmentId; move?: string };
    'weapon.hit': { id: EquipmentId; kind: string; headshot: boolean; killed: boolean };
    'weapon.impact': { id: EquipmentId; surface: ImpactSurface; point: Vector3 };
    'weapon.reload': { id: EquipmentId; phase: 'start' | 'end' | 'round' };
    'weapon.dry': { id: EquipmentId };
    'weapon.swap': { to: EquipmentId };
    'weapon.unlocked': { id: EquipmentId };
    'weapon.charge': { id: EquipmentId; phase: WeaponChargePhase; value?: number };
    'tool.used': { id: EquipmentId; phase: string };
  }
}
/** Content maps own literal sound taps; routing never creates a second sound-log source. */
export class CombatCues {
  private readonly maps: readonly CombatCueMap[];
  constructor(...maps: readonly CombatCueMap[]) { this.maps = maps; }
  cue(id: CueId, opts: CombatCueOpts = {}): boolean { return this.maps.some((map) => map(id, opts)); }
  fire(row: EquipmentRow, opts: CombatCueOpts = {}): boolean { return row.cues !== undefined && this.cue(row.cues.fire, opts); }
  impact(row: EquipmentRow, opts: CombatCueOpts = {}): boolean { return row.cues !== undefined && this.cue(row.cues.impact, opts); }
  reload(row: EquipmentRow, opts: CombatCueOpts = {}): boolean { return row.cues !== undefined && this.cue(row.cues.reload, opts); }
  charge(row: EquipmentRow, phase: string, opts: CombatCueOpts = {}): boolean {
    const id = phase === 'heavy' ? row.cues?.heavy : row.cues?.charge?.[phase];
    return id !== undefined && this.cue(id, { ...opts, phase });
  }
}
/** Adapter for the S1.5 generic Audio cue map without renaming its existing samples/taps. */
export function audioCueMap(map: CueMap, aliases: Readonly<Partial<Record<CueId, string>>>): CombatCueMap {
  return (id, opts) => { const key = aliases[id]; return key !== undefined && map(key, opts); };
}
export interface HitStopProfile { body: number; head: number; kill: number }
export const resolveHitStop = (profile: HitStopProfile, headshot: boolean, killed: boolean): number => killed ? profile.kill : headshot ? profile.head : profile.body;
