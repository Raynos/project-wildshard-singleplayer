// @vitest-environment happy-dom
import { Group, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ClientChannels } from '../src/sdk/clientChannels';
import { createClientChannels } from '../src/game/plugin/ui';
import { HeldPlayback } from '../src/game/plugin/weaponFamily';

describe('bounded held playback on the existing visual DAG', () => {
  it('keeps the original interpolation arithmetic at every key and either side of a segment', () => {
    const keys = [[0, -0], [.18, .45], [.5, -1.05], [1, 0]] as const;
    for (const interpolation of ['linear', 'smoothstep'] as const) {
      const g = new ClientChannels('sample'); g.output('value', g.sample(g.read('phase'), keys, interpolation));
      const lane = createClientChannels(g.build());
      for (const k of [-.5, -0, 0, .18 - Number.EPSILON, .18, .18 + Number.EPSILON, .5, .73, 1, 2]) {
        let expected: number = keys[3][1];
        for (let i = 1; i < keys.length; i++) {
          const start = keys[i - 1], end = keys[i];
          if (start === undefined || end === undefined) throw new Error('Missing original key');
          if (k > end[0]) continue;
          const u = Math.max(0, Math.min(1, (k - start[0]) / Math.max(1e-6, end[0] - start[0])));
          const e = interpolation === 'smoothstep' ? u * u * (3 - 2 * u) : u;
          expected = start[1] + (end[1] - start[1]) * e; break;
        }
        lane.evaluate({ time: 0, delta: 0, values: [k] });
        expect(Object.is(lane.frame.value, expected), `${interpolation}:${k}`).toBe(true);
      }
    }
  });
  it('refuses unordered, excessive, nonfinite and forward-referencing keys at admission', () => {
    for (const keys of [[], [[0, 0]], [[0, 0], [0, 1]], [[1, 0], [0, 1]], [[0, 0], [1, Infinity]], Array.from({ length: 33 }, (_, i) => [i, i])]) {
      expect(() => createClientChannels({ id: 'bad', reads: [], nodes: [{ op: 'constant', value: 0 }, { op: 'sample', a: 0, interpolation: 'smoothstep', keys }], channels: [{ property: 'x', value: 1 }] })).toThrow();
    }
    const g = new ClientChannels('forward'); g.output('x', g.sample(1, [[0, 0], [1, 1]], 'linear'));
    expect(() => g.build()).toThrow();
  });
  it('owns only presentation time and copied observations, preserving independent selected groups', () => {
    const root = new Group(), pendant = new Object3D(), observed = { turn: .25 };
    root.add(pendant);
    const a = new ClientChannels('root'); a.output('yaw', a.read('turn')); a.bind('yaw', 'root');
    const b = new ClientChannels('pendant'); b.output('roll', b.clock('time')); b.bind('roll', 'pendant');
    const rows = { active: [a.build(), b.build()], idle: [b.build()] };
    const playback = new HeldPlayback(rows, new Map([['root', root], ['pendant', pendant]]));
    playback.beginFrame(1 / 60); playback.apply('active', observed);
    observed.turn = 99; expect(root.rotation.y).toBe(.25); expect(pendant.rotation.z).toBe(1 / 60);
    playback.beginFrame(.1); playback.apply('idle', {});
    expect(root.rotation.y).toBe(.25); expect(pendant.rotation.z).toBe(1 / 60 + .1);
    const before = playback.time;
    for (const dt of [Number.NaN, Infinity, -1]) expect(() => playback.beginFrame(dt)).toThrow();
    expect(playback.time).toBe(before);
    expect(() => playback.apply('unknown', {})).toThrow();
    expect(() => playback.apply('active', {})).toThrow();
    expect(() => new HeldPlayback({}, new Map())).toThrow();
    expect(() => new HeldPlayback(rows, new Map<string, unknown>([['root', {}], ['pendant', pendant]]))).toThrow();
  });
});
