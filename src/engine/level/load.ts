import { Group, type Object3D } from 'three';
import type { App } from '../app/app';
import type { Scope } from '../app/scope';
import { sceneResources } from '../app/sceneOwnership';
import type { StepProgress } from '../boot/plan';
import type { ContentRowMap, LevelAdapters, LevelContext, LevelHooks } from './context';
import type { LevelSpec } from './spec';

export type LevelStage = 'level.data' | 'level.world' | 'level.kit' | 'level.play' | 'finish';
export interface LevelDriver {
  /** The production driver adopts the renderer's level scope; node drivers create a fresh one. */
  scope?: () => Scope;
  progress: (stage: LevelStage) => StepProgress;
  data: (spec: LevelSpec, ctx: LevelContext) => Promise<void> | void;
  world: (spec: LevelSpec, ctx: LevelContext) => Promise<void> | void;
  kit: (spec: LevelSpec, ctx: LevelContext) => Promise<void> | void;
  loadout: (spec: LevelSpec, ctx: LevelContext) => Promise<void> | void;
  play: (spec: LevelSpec, ctx: LevelContext) => Promise<void> | void;
  finish: (spec: LevelSpec, ctx: LevelContext) => Promise<void> | void;
  dispose?: (ctx: LevelContext) => void;
}

export class LevelLoadError extends Error {
  readonly stage: LevelStage;
  constructor(stage: LevelStage, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.stage = stage;
    this.name = 'LevelLoadError';
    if (cause instanceof Error && cause.stack !== undefined) this.stack = cause.stack;
  }
}

interface LoadedLevel { spec: LevelSpec; scope: Scope; ctx: LevelContext; driver: LevelDriver }

/** Await hooks at their boundaries, close kit registration, and dispose every failure before it escapes. */
export class LevelLoader {
  private level: LoadedLevel | null = null;
  private loading = false;
  private managed = false;
  private readonly app: App;
  constructor(app: App) { this.app = app; }

  async load(spec: LevelSpec, hooks: LevelHooks, driver: LevelDriver, adapters: LevelAdapters): Promise<void> {
    if (this.loading || this.level !== null) throw new Error('Unload the current level before loading another');
    const scope = driver.scope?.() ?? this.app.engineScope.child(`level:${spec.id}`);
    if (scope.disposed) throw new Error('Level boot driver returned a disposed scope');
    this.loading = true;
    this.managed = true;
    let stage: LevelStage = 'level.data';
    let kitOpen = false;
    const live = (): void => { if (scope.disposed) throw new Error('Level was unloaded during load'); };
    const register = <K extends keyof ContentRowMap>(kind: K, values: ContentRowMap[K] | readonly ContentRowMap[K][]): void => {
      live();
      if (!kitOpen) throw new Error(`${kind} rows may only register during level.kit`);
      this.app.levelRegistrations.add(kind, values, scope);
      if (kind === 'encounter') {
        const rows: readonly ContentRowMap[K][] = Array.isArray(values) ? values : [values as ContentRowMap[K]];
        for (const row of rows) this.app.encounters.register(row, scope);
      }
    };
    const own = (dispose: () => void): void => { scope.onDispose(dispose); };
    const hud = (): NonNullable<LevelAdapters['hud']> => {
      live();
      if (adapters.hud === undefined) throw new Error('HUD service is not installed');
      return adapters.hud;
    };
    const root = new Group();
    const freeTree = (tree: Object3D): void => {
      for (const resource of sceneResources(tree)) if (!this.app.assets.isAcquired(resource)) scope.own(resource);
      tree.removeFromParent();
    };
    scope.onDispose(() => { freeTree(root); });
    const ctx: LevelContext = {
      app: this.app, scope, root, get progress() { return driver.progress(stage); },
      system: (system) => { live(); this.app.addSystem(system, scope); },
      on: (name, fn, options) => { live(); this.app.events.on(name, fn, scope, options); },
      answer: (name, fn, options) => { live(); this.app.events.answer(name, fn, scope, options); },
      rows: {
        weapon: (values) => register('weapon', values), tool: (values) => register('tool', values),
        ammo: (values) => register('ammo', values),
        species: (values) => {
          register('species', values);
          const rows: readonly ContentRowMap['species'][] = Array.isArray(values) ? values : [values as ContentRowMap['species']];
          for (const row of rows) this.app.species.registerRow(row, scope);
        },
        speciesLook: (values) => {
          register('speciesLook', values);
          const rows: readonly ContentRowMap['speciesLook'][] = Array.isArray(values) ? values : [values as ContentRowMap['speciesLook']];
          for (const row of rows) this.app.species.registerLook(row, scope);
        },
        effect: (values) => register('effect', values),
        damageRule: (values) => register('damageRule', values), encounter: (values) => register('encounter', values),
        spawnTable: (values) => {
          register('spawnTable', values);
          const rows: readonly ContentRowMap['spawnTable'][] = Array.isArray(values) ? values : [values as ContentRowMap['spawnTable']];
          for (const row of rows) this.app.encounters.registerSpawn(row, scope);
        },
        creatureLook: (name, factory) => {
          live(); if (!kitOpen) throw new Error('Creature looks may only register during level.kit');
          this.app.levelRegistrations.creatureLook(name, factory, scope);
        },
      },
      inputContext: (def) => {
        live(); if (adapters.inputContext === undefined) throw new Error('Input context service is not installed');
        own(adapters.inputContext(def));
      },
      hud: {
        widget: (band, el, order) => own(hud().widget(band, el, order)),
        disc: (opts) => { const result = hud().disc(opts); own(result.dispose); return result.button; },
        relabel: (spot, label, icon, appearance) => {
          const dispose = hud().relabel(spot, label, icon, appearance);
          let active = true;
          let forget = (): void => { /* Assigned before this live scope can dispose. */ };
          const release = (): void => { if (!active) return; active = false; forget(); dispose(); };
          forget = scope.capture('disposers', release);
          return release;
        },
        verb: (slot, opts) => own(hud().verb(slot, opts)),
        pin: (at, el) => own(hud().pin(at, el)),
      },
      piece: (piece) => {
        live(); this.app.registry.add(piece);
        own(() => {
          const index = this.app.registry.pieces.indexOf(piece); if (index !== -1) this.app.registry.pieces.splice(index, 1);
          if (piece.object !== undefined) freeTree(piece.object);
        });
      },
      debugRow: (value) => {
        live(); if (adapters.debugRow === undefined) throw new Error('Debug row service is not installed');
        own(adapters.debugRow(value));
      },
      playground: (value) => {
        live(); if (adapters.playground === undefined) throw new Error('Playground service is not installed');
        own(adapters.playground(value));
      },
      strings: (table) => { live(); this.app.levelRegistrations.strings(table, scope); },
      tiers: { knobs: (schema) => { live(); this.app.levelRegistrations.knobs(schema, scope); } },
      debug: { expose: (name, value) => { live(); own(this.app.debug.scopedExpose(name, value)); } },
    };
    this.level = { spec, scope, ctx, driver }; this.app.levelScope = scope;
    const run = async (next: LevelStage, work: () => Promise<void>): Promise<void> => {
      stage = next;
      try { live(); await work(); live(); } catch (error) { throw new LevelLoadError(next, error); }
    };
    try {
      this.app.setState('loading');
      await run('level.data', async () => { await driver.data(spec, ctx); });
      await run('level.world', async () => { await driver.world(spec, ctx); await hooks.world?.(ctx); });
      await run('level.kit', async () => {
        await driver.kit(spec, ctx);
        kitOpen = true;
        this.app.levelRegistrations.openKit(scope);
        try { await hooks.kit?.(ctx); } finally { kitOpen = false; this.app.levelRegistrations.closeKit(scope); }
        await driver.loadout(spec, ctx);
      });
      await run('level.play', async () => { await driver.play(spec, ctx); await hooks.play?.(ctx); });
      await run('finish', async () => { await driver.finish(spec, ctx); });
      this.app.events.emit('level.loaded', { id: spec.id });
    } catch (error) {
      const failures: unknown[] = [error];
      try { this.app.setState('error'); } catch (stateError) { failures.push(stateError); }
      try { this.unload(); } catch (disposeError) { failures.push(disposeError); }
      if (failures.length > 1) throw new AggregateError(failures, 'Level load and cleanup failed', { cause: error });
      throw error;
    } finally { this.loading = false; }
  }

  unload(): boolean {
    const level = this.level;
    if (level === null) return this.managed;
    this.level = null;
    try { level.driver.dispose?.(level.ctx); }
    finally {
      try { level.scope.dispose(); }
      finally {
        if (this.app.levelScope === level.scope) this.app.levelScope = null;
        this.app.events.emit('level.unloaded', { id: level.spec.id });
      }
    }
    return true;
  }
}
