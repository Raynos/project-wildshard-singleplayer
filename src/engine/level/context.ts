import type { Action } from '../input/InputService';
import type { Group, Vector3 } from 'three';
import type { App } from '../app/app';
import type { Scope } from '../app/scope';
import type { SystemSpec } from '../app/systems';
import type { StepProgress } from '../boot/plan';
import type { AskInput, AskMap, AskOutput, EventMap } from '../events/maps';
import type { ListenerOptions } from '../events/events';
import type { DiscOpts, DiscSpot, TouchRelabel } from '../ui/hudSlots';
import type { Piece } from '../world/registry';
import type { TierKnobs } from './spec';
import type { EncounterDefinition } from '../ai/encounters';

export interface ContentRow { id: string }
/** Subsystems refine their registration contracts here as their row implementations land. */
export interface ContentRowMap {
  weapon: ContentRow; tool: ContentRow; ammo: ContentRow; species: ContentRow; speciesLook: ContentRow;
  effect: ContentRow; damageRule: ContentRow; encounter: EncounterDefinition; spawnTable: ContentRow;
}
export type RowVerb<T> = (row: T | readonly T[]) => void;
export type EngineRows = { [K in keyof ContentRowMap]: RowVerb<ContentRowMap[K]> } & {
  creatureLook: (kitLook: string, factory: CreatureMaterialFactory) => void;
};
export type CreatureMaterialFactory = (look: string) => object;
export interface InputContextDef {
  id: string; priority?: number; enabled?: () => boolean;
  actions: readonly Action[] | Readonly<Record<string, (pressed: boolean) => void>>;
  blocks?: 'below' | readonly Action[];
  touch?: { relabel: Partial<Record<DiscSpot, TouchRelabel>> };
}
export type HudBand = 'status' | 'pill' | 'verbs';
export interface VerbSlotOpts { label: string; icon: string; press: () => void; release?: () => void }
export interface HudVerbs {
  widget: (band: HudBand, el: HTMLElement, order: number) => void;
  disc: (opts: DiscOpts) => HTMLButtonElement;
  relabel: (spot: DiscSpot, label: string, icon: string, appearance?: TouchRelabel) => () => void;
  verb: (slot: 'verb.1' | 'verb.2', opts: VerbSlotOpts) => void;
  pin: (at: Vector3 | (() => Vector3 | null), el: HTMLElement) => void;
}
export interface DebugRowSpec {
  id: string; group: 'look' | 'cover' | 'sky' | 'audio' | 'combat' | 'creatures' | 'perf' | 'loading' | 'tools';
  label: string; choices: readonly { value: string; text: string }[]; initial: string;
  change: (value: string) => void; reload?: boolean; note: string;
}
export interface PlaygroundSpec { id: string; title: string; blurb: string; icon: string; art?: string; load: () => Promise<object> }
export type StringTable = Readonly<Record<string, string>>;
export interface TierKnobSchema { id: string; defaults: TierKnobs }

export interface LevelContext {
  readonly app: App; readonly scope: Scope; readonly root: Group; readonly progress: StepProgress;
  system: (spec: SystemSpec) => void;
  on: <K extends keyof EventMap>(name: K, fn: (payload: EventMap[K]) => void, opts?: ListenerOptions) => void;
  answer: <K extends keyof AskMap>(name: K, fn: (value: AskInput<K>) => AskOutput<K>, opts?: ListenerOptions) => void;
  readonly rows: EngineRows;
  inputContext: (def: InputContextDef) => void;
  readonly hud: HudVerbs;
  piece: (piece: Piece) => void;
  debugRow: (row: DebugRowSpec) => void;
  playground: (spec: PlaygroundSpec) => void;
  strings: (table: StringTable) => void;
  readonly tiers: { knobs: (schema: TierKnobSchema) => void };
  readonly debug: { expose: (name: string, value: unknown) => void };
}
export interface LevelHooks {
  world?: (ctx: LevelContext) => Promise<void> | void;
  kit?: (ctx: LevelContext) => Promise<void> | void;
  play?: (ctx: LevelContext) => Promise<void> | void;
}

/** A UI/input service returns the inverse of each mutation, owned by the caller's scope. */
export interface LevelAdapters {
  inputContext?: (def: InputContextDef) => () => void;
  hud?: {
    widget: (band: HudBand, el: HTMLElement, order: number) => () => void;
    disc: (opts: DiscOpts) => { button: HTMLButtonElement; dispose: () => void };
    relabel: (spot: DiscSpot, label: string, icon: string, appearance?: TouchRelabel) => () => void;
    verb: (slot: 'verb.1' | 'verb.2', opts: VerbSlotOpts) => () => void;
    pin: (at: Vector3 | (() => Vector3 | null), el: HTMLElement) => () => void;
  };
  debugRow?: (row: DebugRowSpec) => () => void;
  playground?: (spec: PlaygroundSpec) => () => void;
}
