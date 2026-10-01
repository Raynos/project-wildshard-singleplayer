import type { AppState, Phase } from '../app/systems';

export interface FaultEvent { source: string; message: string; phase?: Phase; limit?: number; error?: unknown }
export interface EventMap {
  'app.state': { prev: AppState; next: AppState };
  'level.loaded': { id: string };
  'level.unloaded': { id: string };
  'practice.active': boolean;
  'explore.studio': boolean;
  'explore.turntable': { on: boolean; key?: { x: number; y: number; z: number } };
  'fault': FaultEvent;
}
export interface CrouchRequest { want: boolean; via: 'toggle' | 'hold' }
export interface CrouchAnswer { allowed: boolean; latched: boolean }
export interface AskMap {
  'player.traversal': readonly [number | boolean, boolean];
  'player.crouch': readonly [CrouchRequest, CrouchAnswer];
}
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- Consumers extend this registry by declaration merging.
export interface TagMap {}
export type AskInput<K extends keyof AskMap> = AskMap[K] extends readonly [infer Input, unknown] ? Input : never;
export type AskOutput<K extends keyof AskMap> = AskMap[K] extends readonly [unknown, infer Output] ? Output : never;
export type Tag = Extract<keyof TagMap, string>;
