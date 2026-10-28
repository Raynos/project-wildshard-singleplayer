import { expect, test } from 'vitest';
import { ResidencyAllocator, type ResidencyClaim, type ResidencyEviction } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/format/memoryAdmission';
import { CONTENT_CAPS } from '../src/engine/core/config';

// T10: a reserve whose eviction offers steps disposes the evicted owner one step per yield; the evicted claim stays
// charged until its last step, and the new claim is admitted only then.
const BYTES = 1000;
const playing = CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + Math.ceil(BYTES * 1.5 * CONTENT_CAPS.residentFactor);

function rig(stepCount: number, fail = false) {
  const allocator = new ResidencyAllocator({ playing, memory: new MemoryAdmission(() => false) });
  const log: string[] = [];
  const eviction = (id: string): ResidencyEviction => ({
    commit: () => { log.push(`${id}:commit`); }, abort: () => { log.push(`${id}:abort`); },
    *steps() { for (let i = 0; i < stepCount; i++) { log.push(`${id}:step${String(i)}`); if (fail && i === 1) throw new Error('disposal failed'); yield; } log.push(`${id}:done`); },
  });
  const old: ResidencyClaim = { id: 'world:old', owner: 'grid', category: 'sim', bytes: BYTES, needed: false, distance: 50, prepareEvict: () => eviction('old') };
  if (allocator.reserve(old) === null) throw new Error('Missing old world');
  const next: ResidencyClaim = { id: 'render:road', owner: 'platform', category: 'sim', bytes: BYTES, needed: true, distance: 0 };
  const has = (id: string): boolean => allocator.entries().some(row => row.id === id);
  return { allocator, log, next, has };
}

test('a stepped eviction keeps the evicted claim charged until its last step, then admits', () => {
  const { allocator, log, next, has } = rig(3);
  const steps = allocator.reserveSteps(next);
  let step = steps.next(), yields = 0;
  while (step.done !== true) {
    yields++;
    // mid-disposal: the old world is still charged and the new claim not yet admitted
    expect(has('world:old')).toBe(true); expect(has('render:road')).toBe(false);
    step = steps.next();
  }
  expect(yields).toBe(3);
  expect(step.value).not.toBeNull();
  expect(has('world:old')).toBe(false); expect(has('render:road')).toBe(true);
  expect(log).toEqual(['old:step0', 'old:step1', 'old:step2', 'old:done']);
});

test('the one-shot reserve still commits at once', () => {
  const { allocator, log, next, has } = rig(3);
  expect(allocator.reserve(next)).not.toBeNull();
  expect(log).toEqual(['old:commit']); expect(has('world:old')).toBe(false);
});

test('a failed stepped disposal keeps its claim and refuses, as a failed commit does', () => {
  const { allocator, log, next, has } = rig(3, true);
  const steps = allocator.reserveSteps(next);
  expect(() => { for (let step = steps.next(); step.done !== true; step = steps.next()) { /* drained */ } }).toThrow('disposal failed');
  expect(has('world:old')).toBe(true); expect(has('render:road')).toBe(false);
  expect(log).toEqual(['old:step0', 'old:step1', 'old:abort']);
});

test('a reserve stopped mid-eviction leaves the evicted claim charged and admits nothing', () => {
  const { allocator, next, has } = rig(4);
  const steps = allocator.reserveSteps(next);
  steps.next(); steps.next();
  steps.return(null);
  expect(has('world:old')).toBe(true); expect(has('render:road')).toBe(false);
});
