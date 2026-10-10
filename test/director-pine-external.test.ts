// oxlint-disable-next-line import/no-nodejs-modules -- Compare the admitted native module with its exact committed browser bytes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { preparePineDirector, PineScriptClock } from '../src/shards/pine-hollow/runtime/scriptClock';
import { LegacyPineClock, type PineClockEvent } from '../src/shards/pine-hollow/runtime/questClock';
import declaration from '../src/shards/pine-hollow/data/director.json';
import module from '../src/shards/pine-hollow/behaviour/director.json';

function fixture(hasClock: boolean) {
  let seen = false, night = 0, phase = 'boot';
  const events: { phase: string; key: PineClockEvent; value: number }[] = [];
  const ports = { seen: () => seen, hasClock: () => hasClock, night: () => night,
    publish: (key: PineClockEvent, value: number): void => { events.push({ phase, key, value }); if (key === 'dawn.finish') seen = true; } };
  return { ports, events, phase: (value: string): void => { phase = value; }, night: (value: number): void => { night = value; } };
}
describe('Pine director on the actual quest-owned clock', () => {
  it('embeds the exact browser asset rather than a second script build', () => {
    expect(module.module).toBe(declaration.module);
    expect(Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0)).toEqual(new Uint8Array(readFileSync(`src/shards/pine-hollow/assets/${declaration.module}`)));
  });
  it.each([true, false])('keeps same-call event order at variable frame deltas, sky=%s', async hasClock => {
    const create = await preparePineDirector(), old = fixture(hasClock), next = fixture(hasClock);
    const legacy = new LegacyPineClock(old.ports), script = new PineScriptClock(create(), next.ports);
    const deltas = [1 / 60, 1 / 30, 0, 1 / 120, 0.1, 1 / 48];
    for (let frame = 0; frame < 10000; frame++) {
      old.phase(`request:${String(frame)}`); next.phase(`request:${String(frame)}`);
      if (frame === 0 || frame === 50 || frame === 2000) {
        if (frame === 50) { old.night(1); next.night(1); }
        legacy.night(); script.night();
      }
      if (frame === 60 || frame === 70 || frame === 900) { legacy.dawn(); script.dawn(); }
      expect(next.events).toEqual(old.events); // Requests publish now, before the existing frame callback.
      old.phase(`frame:${String(frame)}`); next.phase(`frame:${String(frame)}`);
      const dt = deltas[frame % deltas.length] ?? 0;
      legacy.tick(dt); script.tick(dt);
      expect(next.events).toEqual(old.events);
    }
  });
  it('restores full script state silently and repeats the exact mid-dawn suffix', async () => {
    const create = await preparePineDirector(), old = fixture(true), next = fixture(true);
    const left = new PineScriptClock(create(), old.ports), right = new PineScriptClock(create(), next.ports);
    left.dawn(); for (let frame = 0; frame < 210; frame++) left.tick(1 / 60);
    const saved = left.save(); right.load(saved); expect(next.events).toEqual([]); old.events.length = 0;
    for (let frame = 210; frame < 10000; frame++) {
      old.phase(String(frame)); next.phase(String(frame));
      if (frame === 250) { left.night(); right.night(); }
      left.dawn(); right.dawn(); left.tick(1 / 60); right.tick(1 / 60);
      expect(next.events).toEqual(old.events);
    }
    expect(right.save()).toBe(left.save());
    expect(() => right.load('{}')).toThrow('snapshot'); expect(right.save()).toBe(left.save());
  });
});
