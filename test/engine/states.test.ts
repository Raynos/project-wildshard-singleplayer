import { describe, expect, it, vi } from 'vitest';
import { App, Scope } from '#engine/index';

describe('app states', () => {
  it('exits the previous state, changes state, enters the next, then queues the transition event', () => {
    const app = new App(), scope = new Scope('test'), log: string[] = [];
    app.onExit('boot', () => { log.push(`exit:${app.state}`); }, scope);
    app.onEnter('title', () => { log.push(`enter:${app.state}`); }, scope);
    app.events.on('app.state', (event) => { log.push(`${event.prev}->${event.next}`); }, scope);
    app.setState('title');
    expect(app.state).toBe('title');
    expect(log).toEqual(['exit:boot', 'enter:title']);
    app.events.flush('update');
    expect(log).toEqual(['exit:boot', 'enter:title', 'boot->title']);
    scope.dispose();
  });

  it('ignores the current state and removes callbacks with their scope', () => {
    const app = new App(), scope = new Scope('test'), callback = vi.fn<() => void>();
    app.onExit('boot', callback, scope);
    app.onEnter('play', callback, scope);
    app.setState('boot');
    expect(callback).not.toHaveBeenCalled();
    scope.dispose();
    app.onEnter('play', callback, scope);
    app.setState('play');
    expect(callback).not.toHaveBeenCalled();
  });

  it('runs callbacks in registration order and serializes transitions requested by a callback', () => {
    const app = new App(), scope = new Scope('test'), log: string[] = [];
    app.onEnter('title', () => { log.push('first'); app.setState('play'); }, scope);
    app.onEnter('title', () => { log.push(`second:${app.state}`); }, scope);
    app.onExit('title', () => { log.push('exit'); }, scope);
    app.onEnter('play', () => { log.push('play'); }, scope);
    app.events.on('app.state', ({ prev, next }) => { log.push(`${prev}->${next}`); }, scope);
    app.setState('title');
    expect(app.state).toBe('play');
    expect(log).toEqual(['first', 'second:title', 'exit', 'play']);
    app.events.flush('late');
    expect(log.slice(-2)).toEqual(['boot->title', 'title->play']);
    scope.dispose();
  });

  it('does not call a hook disposed by an earlier hook', () => {
    const app = new App(), scope = new Scope('first'), other = new Scope('other'), callback = vi.fn<() => void>();
    app.onEnter('play', () => other.dispose(), scope);
    app.onEnter('play', callback, other);
    app.setState('play');
    expect(callback).not.toHaveBeenCalled();
    scope.dispose();
  });
});
