import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../../src/engine/app/app';
import type { DebugRowSpec } from '../../src/engine/level/context';
import { installAiDebug } from '../../src/engine/ai/view/DebugOverlay';
import { brainInspection, inspectBrain, pinBrain } from '../../src/engine/ai/inspect';
import { FakeGame } from '../fake/FakeGame';

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
});
