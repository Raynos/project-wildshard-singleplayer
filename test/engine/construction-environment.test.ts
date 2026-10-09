import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { bindConstructionEnvironment, withOwner } from '../../src/engine/app/ownership';

it('keeps the construction frame across awaits but restores the road for scoped page callbacks and nested calls', async () => {
  const page = new Scope('page'), build = page.child('destination'), piece = build.child('piece');
  const road = { terrain: 'road', registry: 'road', selection: 'road' }, destination = { terrain: 'region', registry: 'region', selection: 'region' };
  let frame = road;
  const leave = bindConstructionEnvironment(build, () => withOwner(build, () => {
    const prior = frame; frame = destination; return () => { withOwner(build, () => { frame = prior; }); };
  }));
  try {
    await Promise.resolve(); expect(frame).toBe(destination);
    const target = new EventTarget();
    page.listen(target, 'frame', () => {
      expect(frame).toBe(road);
      withOwner(piece, () => { expect(frame).toBe(destination); });
      expect(frame).toBe(road);
      withOwner(null, () => { expect(frame).toBe(road); });
    });
    target.dispatchEvent(new Event('frame')); expect(frame).toBe(destination);
    withOwner(piece, () => { expect(frame).toBe(destination); });
    leave(); leave(); expect(frame).toBe(road);
    withOwner(page, () => { expect(frame).toBe(road); });
  } finally { leave(); page.dispose(); }
});

it('restores the construction frame after a failed page callback, then disposes it exactly once', () => {
  const page = new Scope('page'), build = page.child('destination');
  let frame = 'road', enters = 0, exits = 0;
  bindConstructionEnvironment(build, () => { const prior = frame; frame = 'region'; enters++; return () => { frame = prior; exits++; }; });
  try {
    expect(() => withOwner(page, () => { expect(frame).toBe('road'); throw new Error('Page callback failed'); })).toThrow('Page callback failed');
    expect(frame).toBe('region'); expect(enters).toBe(2); expect(exits).toBe(1);
    build.dispose(); expect(frame).toBe('road'); expect(exits).toBe(2);
    withOwner(page, () => { expect(frame).toBe('road'); }); expect(enters).toBe(2);
  } finally { page.dispose(); }
});

it('does not restore a cancelled construction after its page callback retires the owner', () => {
  const page = new Scope('page'), build = page.child('destination'); let frame = 'road';
  bindConstructionEnvironment(build, () => { const prior = frame; frame = 'region'; return () => { frame = prior; }; });
  try {
    withOwner(page, () => { expect(frame).toBe('road'); build.dispose(); });
    expect(frame).toBe('road');
    const next = page.child('replacement');
    const leave = bindConstructionEnvironment(next, () => { const prior = frame; frame = 'next'; return () => { frame = prior; }; });
    expect(frame).toBe('next'); leave(); expect(frame).toBe('road');
  } finally { page.dispose(); }
});

it('refuses overlapping or disposed construction owners before installing their bindings', () => {
  const page = new Scope('page'), first = page.child('first'), second = page.child('second'); let installs = 0;
  const enter = (): (() => void) => { installs++; return () => undefined; };
  const leave = bindConstructionEnvironment(first, enter);
  try {
    expect(() => bindConstructionEnvironment(second, enter)).toThrow('previous construction'); expect(installs).toBe(1);
    leave(); second.dispose();
    expect(() => bindConstructionEnvironment(second, enter)).toThrow('live scope'); expect(installs).toBe(1);
  } finally { leave(); page.dispose(); }
});

it('releases the construction slot when an atomic binding installer refuses', () => {
  const page = new Scope('page'), build = page.child('destination');
  try {
    expect(() => bindConstructionEnvironment(build, () => { throw new Error('Binding refused'); })).toThrow('Binding refused');
    const leave = bindConstructionEnvironment(build, () => () => undefined); leave();
  } finally { page.dispose(); }
});
