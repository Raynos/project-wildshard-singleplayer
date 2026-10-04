import { describe, expect, it, vi } from 'vitest';
import { App } from '#engine-internal/app/app';

describe('active level trampling', () => {
  it('resolves each resident field independently and drops disposed registrations', () => {
    const app = new App(), first = app.engineScope.child('first'), second = app.engineScope.child('second');
    const a = { push: vi.fn() }, b = { push: vi.fn() };
    expect(app.world.trample).toBeNull();
    app.registerTrample(a, first); app.registerTrample(b, second);
    app.levelScope = first;
    app.world.trample?.push(1, 2, 0.6, 0.8, 3, 4);
    expect(a.push).toHaveBeenCalledWith(1, 2, 0.6, 0.8, 3, 4);
    expect(b.push).not.toHaveBeenCalled();
    app.levelScope = second; expect(app.world.trample).toBe(b);
    first.dispose(); expect(app.world.trample).toBe(b);
    second.dispose(); expect(app.world.trample).toBeNull();
    app.levelScope = null; expect(app.world.trample).toBeNull();
    app.engineScope.dispose();
  });
});
