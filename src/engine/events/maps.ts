import type { AppState, Phase } from '../app/systems';
import type { Actor } from '../combat/pipeline';

export interface FaultEvent { source: string; message: string; phase?: Phase; limit?: number; error?: unknown }
export interface EventMap {
  'app.state': { prev: AppState; next: AppState };
  /** a quest moved a step (src/engine/quest/core.ts emits it; telemetry reads it) */
  'quest.step': { level: string; quest: string; step: string | null; previous: string | null };
  'level.loaded': { id: string };
  'level.unloaded': { id: string };
  'creature.signal': { name: string; x: number; z: number };
  'ai.windup': { actor: Actor; duration: number };
  'practice.active': boolean;
  'explore.studio': boolean;
  'explore.turntable': { on: boolean; key?: { x: number; y: number; z: number } };
  'fault': FaultEvent;
  'boss.attempt': { boss: string; outcome: 'started' | 'won' | 'died' | 'lost' | 'left'; level?: string };
  /** the player jumped (a ground, coyote or air jump) / dodged; any number of listeners (E357 AG19: no chained hooks) */
  'player.jump': true;
  'player.dodge': true;
  /** the hover board / swimming started (true) or ended (false) */
  'player.hover': boolean;
  'player.swim': boolean;
  /** a lock-on press found nothing to lock */
  'lock.noTarget': true;
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
