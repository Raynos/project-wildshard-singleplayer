import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../src/engine/app/app';
import type { DebugRowSpec } from '../../src/engine/level/context';
import { installAiDebug } from '../../src/engine/ai/view/DebugOverlay';
import { brainInspection, inspectBrain, pinBrain } from '../../src/engine/ai/inspect';
import { FakeGame } from '../fake/FakeGame';
import type { Scope } from '../../src/engine/app/scope';

describe('AI inspection', () => {
  it('reads current state and preserves pinning when a strike replaces inspection', () => {
    const actor = {}, scores = [{ id: 'lane', score: 4 }];
    expect(brainInspection(actor, 'idle')).toEqual({ state: 'idle', picks: [], brainHz: 10, pinned: false });
    pinBrain(actor);
    let state = 'windup';
    inspectBrain(actor, () => ({ state, picks: scores, brainHz: 10, pinned: false }));
    expect(brainInspection(actor, 'idle')).toEqual({ state, picks: scores, brainHz: 10, pinned: true });
    state = 'active'; expect(brainInspection(actor, 'idle').state).toBe('active');
  });
  it('creates no off-state view or system and releases toggled and unloaded views', () => {
    const app = new App(), scope = app.engineScope.child('fixture');
    app.levelScope = scope; app.setState('play');
    const update = vi.fn(), dispose = vi.fn(), view = vi.fn(() => ({ update, dispose }));
    const rows: DebugRowSpec[] = [];
    installAiDebug({ app, scope, debugRow: (row) => { rows.push(row); } },
      { game: new FakeGame().asGame(), actors: () => [], player: { position: new Vector3() } }, view);
    const row = rows[0]; if (row === undefined) throw new Error('Debug row missing');
    expect(row.group).toBe('tools'); expect(row.initial).toBe('off');
    expect(view).not.toHaveBeenCalled(); expect(app.systemIds(scope)).toEqual([]);
    row.change('on'); expect(view).toHaveBeenCalledOnce();
    const system = app.systemsByPhase().late[0]; if (system === undefined) throw new Error('Overlay system missing');
    expect(system.when?.(app)).toBe(true); system.run(1 / 60, 0); expect(update).toHaveBeenCalledOnce();
    app.setState('paused'); expect(system.when?.(app)).toBe(false);
    app.levelScope = app.engineScope.child('resident'); app.setState('play'); expect(system.when?.(app)).toBe(false);
    row.change('off'); expect(dispose).toHaveBeenCalledOnce(); expect(app.systemIds(scope)).toEqual([]);
    row.change('on'); scope.dispose(); expect(dispose).toHaveBeenCalledTimes(2); expect(app.systemIds(scope)).toEqual([]);
    row.change('on'); expect(view).toHaveBeenCalledTimes(2); app.engineScope.dispose();
  });
  it('reinstalls the selected overlay per entry and leaves no road system or view', () => {
    const app = new App(), scope = app.engineScope.child('retained');
    app.levelScope = scope; app.setState('play');
    const rows: DebugRowSpec[] = [], update = vi.fn(), dispose = vi.fn();
    const view = vi.fn(() => ({ update, dispose }));
    let install: ((scope: Scope) => void) | undefined;
    installAiDebug({ app, scope, debugRow: (row) => { rows.push(row); } },
      { game: new FakeGame().asGame(), actors: () => [], player: { position: new Vector3() } }, view,
      (value) => { install = value; });
    const row = rows[0]; if (row === undefined || install === undefined) throw new Error('Overlay installer missing');
    row.change('on'); expect(view).not.toHaveBeenCalled();
    const tick = (time: number) => { for (const system of app.systemsByPhase().late) if (system.when?.(app) !== false) system.run(1 / 60, time); };
    try {
      for (let entry = 0; entry < 2; entry++) {
        const entered = scope.child('entered'); install(entered);
        expect(view).toHaveBeenCalledTimes(entry + 1);
        expect(app.systemIds(scope)).toHaveLength(1);
        tick(entry); expect(update).toHaveBeenCalledTimes(entry + 1);
        entered.dispose(); expect(dispose).toHaveBeenCalledTimes(entry + 1);
        expect(app.systemIds(scope)).toEqual([]);
        row.change('on');
        for (let frame = 0; frame < 600; frame++) tick(frame);
        expect(update).toHaveBeenCalledTimes(entry + 1); expect(view).toHaveBeenCalledTimes(entry + 1);
      }
      expect(rows).toHaveLength(1);
    } finally { scope.dispose(); app.engineScope.dispose(); }
    expect(scope.census).toMatchObject({ listeners: 0, timers: 0, disposers: 0 });
  });
});
