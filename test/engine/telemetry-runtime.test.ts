// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/engine/app/app';
import { bindTelemetry, startTelemetry } from '../../src/engine/telemetry/runtime';
import type { Actor } from '../../src/engine/combat/pipeline';

describe('page analytics wiring', () => {
  it('sends engine event batches every thirty seconds and flushes on pagehide', () => {
    vi.useFakeTimers(); vi.stubGlobal('__BUILD_ID__', 'fixture-build');
    const requests: { url: string; body: string }[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => { requests.push({ url, body: typeof init.body === 'string' ? init.body : '' }); return Promise.resolve(Response.json({ id: 'fixture' })); });
    const app = new App(); bindTelemetry(app); startTelemetry();
    app.events.emit('level.loaded', { id: 'fixture-world' }); app.events.flush('update');
    const actor: Actor = { id: 'player', tags: [], state: [], attributes: { health: 0, maxHealth: 100 }, alive: false, applyDamage: () => false };
    app.events.emit('player.died', { actor, checkpoint: false, cause: { kind: 'fall', label: 'Fall' } });
    app.events.emit('weapon.fired', { id: 'weapon.fixture' });
    app.events.emit('quest.step', { level: 'fixture-world', quest: 'quest', step: 'step', previous: null });
    app.events.emit('boss.attempt', { boss: 'boss', outcome: 'started' }); app.events.flush('update');
    expect(requests).toHaveLength(0);
    vi.advanceTimersByTime(30_000); expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('/api/telemetry');
    const batch = JSON.parse(requests[0]?.body ?? '{}') as { events: { name: string }[] };
    expect(batch.events.map((event) => event.name)).toEqual(['death.cause', 'weapon.used', 'quest.step', 'boss.attempt']);
    app.events.emit('weapon.fired', { id: 'weapon.fixture' }); app.events.flush('update');
    window.dispatchEvent(new Event('pagehide')); expect(requests).toHaveLength(2);
    expect(requests[1]?.body).toContain('level.time');
    window.__wildshardHarness = { seed: 1, capture: 30 };
    app.events.emit('weapon.fired', { id: 'weapon.fixture' }); app.events.flush('update');
    vi.advanceTimersByTime(30_000); window.dispatchEvent(new Event('pagehide'));
    expect(requests).toHaveLength(2);
    delete window.__wildshardHarness;
    vi.useRealTimers(); vi.unstubAllGlobals();
  });
});
