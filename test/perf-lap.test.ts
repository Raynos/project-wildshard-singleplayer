// src/engine/ui/perfLapSummary.ts — the PERF LAP's summary (E350 F-J1): the text Jake copies off the phone. Pins its rows:
// fps p50 / p5, the share at the cap's interval, frames over 50 / 100 ms, gpu~ p50 / p95, the worst frame + its cause, and
// the header (build, tier, dpr, cap, the Low Power Mode hint, elapsed time, the lap's start / end gpu~).
import { describe, expect, it } from 'vitest';
import { lapSummary, lowPower, pct, type LapFrame, type LapMeta } from '../src/engine/ui/perfLapSummary';

const frame = (ms: number, gpu = 2, cause = ''): LapFrame => ({ frame: ms, update: 4, render: 3, gpu, calls: 90, tris: 1_200_000, cause });
const meta = (o: Partial<LapMeta> = {}): LapMeta => ({
  build: 'abc1234-xyz', startedAt: '2026-09-30 14:02', shard: 'pine-hollow', tier: 'phone', dpr: 3, pixelRatio: 2,
  canvas: '804×1748', engine: 'WebKit', capFps: 30, rafHz: 60, elapsedS: 74, total: 6, cancelled: null, ...o,
});

describe('PERF LAP summary', () => {
  it('pct takes the nearest-rank percentile and 0 for no frames', () => {
    expect(pct([], 0.5)).toBe(0);
    expect(pct([3, 1, 2], 0.5)).toBe(2);
    expect(pct([1, 2, 3, 4], 1)).toBe(4);
  });

  it('flags Low Power Mode from a ~30 Hz requestAnimationFrame only', () => {
    expect(lowPower(30.2)).toBe('likely (rAF ~30 Hz)');
    expect(lowPower(59.8)).toBe('no');
    expect(lowPower(0)).toBe('n/a');
  });

  it('prints the header, one row per spot, ALL and the worst frames', () => {
    // gate: 90 frames at the cap, one 60 ms hitch; pond: GPU-bound at ~22 fps with a 120 ms spike
    const gate = [...Array.from({ length: 89 }, () => frame(33.3, 3)), frame(60, 3, 'render 50ms')];
    const pond = [...Array.from({ length: 59 }, () => frame(45, 11)), frame(120, 40, 'gpu~ 80ms')];
    const text = lapSummary(meta(), [{ id: 'gate', frames: gate }, { id: 'pond', frames: pond }]);
    const L = text.split('\n');
    expect(L[0]).toBe('WILDSHARD PERF LAP · build abc1234-xyz');
    expect(L[1]).toBe('2026-09-30 14:02 · pine-hollow · 2/6 spots · 1m14s');
    expect(L[2]).toBe('phone · dpr 3 · render 2.00× · 804×1748 · cap 30 fps · WebKit');
    expect(L[3]).toBe('rAF 60 Hz · Low Power Mode: no');
    expect(L[4]).toBe('gpu~ p50 start 3.0 → end 11.0 ms (thermal drift +8.0)');
    expect(L[5]).toBe('spot    fps50 fps5 @33ms >50 >100 gpu50 gpu95 calls tris');
    expect(L[6]).toBe('gate     30.0 30.0   99%   1    0   3.0   3.0    90 1.2M');
    expect(L[7]).toBe('pond     22.2 22.2    0%   1    1  11.0  11.0    90 1.2M');
    expect(L[8]?.startsWith('ALL      ')).toBe(true);
    expect(L.slice(-3)).toEqual(['worst frame per spot:', ' gate    60ms render 50ms', ' pond    120ms gpu~ 80ms']);
    for (const line of L.slice(5, 9)) expect(line.length).toBeLessThanOrEqual(62); // the phone panel's width
  });

  it('says a cancelled lap and the spots it did', () => {
    const text = lapSummary(meta({ cancelled: 'touch / key', rafHz: 30, capFps: 0 }), [{ id: 'gate', frames: [frame(16.7)] }]);
    expect(text).toContain('1/6 spots · 1m14s · CANCELLED: touch / key');
    expect(text).toContain('cap off');
    expect(text).toContain('Low Power Mode: likely (rAF ~30 Hz)');
    expect(text).toContain('@17ms');
    expect(text).not.toContain('ALL');
  });
});
