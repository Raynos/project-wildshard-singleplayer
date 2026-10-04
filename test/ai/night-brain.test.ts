import { describe, expect, it, vi } from 'vitest';
import { NightBrain, type NightActor, type NightPorts, type NightSpec } from '../../src/shards/pine-hollow/quest/nightBrain';

const spec: NightSpec = { max: 3, region: { x: 0, z: 0, ax: 100, az: 100 }, exclude: { x: 200, z: 200, blend: 1 },
  face: { x: 20, z: 0 }, mill: { x: 0, z: 0 }, water: 0, roamKinds: ['a', 'b'], race: [{ kind: 'b', x: -10, z: 0 }, { kind: 'a', x: -20, z: 0 }, { kind: 'b', x: -30, z: 0 }] };
function fixture(): { brain: NightBrain<NightActor>; actors: NightActor[]; h: NightPorts<NightActor>; setNight: (value: number) => void } {
  const actors: NightActor[] = []; let night = 1;
  const h: NightPorts<NightActor> = {
    night: () => night, errand: () => true, onErrandDone: vi.fn<() => void>(), next: () => 0.25, height: () => 1,
    spawn: (_kind, x, z) => { const a = { position: { x, y: 1, z }, alive: true, hp: 100, maxHp: 100, lookWeight: 1, setMotion: vi.fn<() => void>() }; actors.push(a); return a; },
    shot: vi.fn<() => void>(), own: vi.fn<() => void>(), release: vi.fn<() => void>(), retire: vi.fn<(a: NightActor) => void>((a) => { a.alive = false; }), burst: vi.fn<() => void>(),
  };
  return { brain: new NightBrain(h, spec), actors, h, setNight: (value) => { night = value; } };
}
describe('night population lifecycle', () => {
  it('retains the one-second spawn pulse, mill distance and wake radius', () => {
    const { brain, actors, h } = fixture();
    brain.update(0.99, { x: -74, y: 0, z: 0 }); expect(brain.count).toBe(0);
    brain.update(0.01, { x: -74, y: 0, z: 0 }); expect(brain.count).toBe(4);
    expect(h.own).toHaveBeenCalledTimes(3);
    brain.update(0.1, { x: 0, y: 0, z: 0 }); expect(h.release).toHaveBeenCalledTimes(1);
    const second = actors[1]; if (second === undefined) throw new Error('Race missing');
    second.hp = 99; brain.update(0.1, { x: -74, y: 0, z: 0 }); expect(h.release).toHaveBeenCalledTimes(2);
  });
  it('completes the errand once when all racers are dead at the next pulse', () => {
    const { brain, actors, h } = fixture(); brain.force({ x: 0, y: 0, z: 0 });
    expect(brain.count).toBe(6); for (const a of actors.slice(3)) a.alive = false;
    brain.update(1, { x: 0, y: 0, z: 0 }); expect(h.onErrandDone).toHaveBeenCalledOnce();
  });
  it('starts dawn flight below .35 and retires roamers only after 3.5 seconds', () => {
    const { brain, h, setNight } = fixture(); const p = { x: 0, y: 0, z: 0 };
    brain.force(p); setNight(0.35); brain.update(0.1, p); expect(h.shot).not.toHaveBeenCalledWith('thrall_move', expect.anything());
    setNight(0.34); brain.update(0.1, p); expect(h.own).toHaveBeenCalledTimes(6);
    brain.update(3.49, p); expect(h.retire).not.toHaveBeenCalled();
    brain.update(0.01, p); expect(h.retire).toHaveBeenCalledTimes(3); expect(h.burst).toHaveBeenCalledTimes(3); expect(brain.count).toBe(3);
  });
  it('retires distant roamers at the population pulse', () => {
    const { brain, h } = fixture(); brain.force({ x: 0, y: 0, z: 0 });
    brain.update(1, { x: -500, y: 0, z: 0 }); expect(h.retire).toHaveBeenCalledTimes(3); expect(brain.count).toBe(3);
  });
});
