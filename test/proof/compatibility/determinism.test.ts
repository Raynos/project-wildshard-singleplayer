import { expect, it } from 'vitest';
import { nativeCompatibility } from './native';
import { signalWitness } from '../sunscar-dunes/native';
import { skyWitness } from '../far-reach/native';
import { pineWitness } from '../pine-hollow/native';
import { driftwoodWitness } from '../driftwood-isle/native';

it.each(['nalati-grasslands'])(
  '%s reports identical fail-closed results in independent native processes', slug => {
    const first = nativeCompatibility(slug), second = nativeCompatibility(slug);
    expect(first.status).toBe(1); expect(first.stderr).toBe(''); expect(second).toEqual(first);
    const report: unknown = JSON.parse(first.stdout);
    expect(report).toMatchObject({ compatible: false, headless: { nativeBoot: true, ticksExecuted: 180 }, replay: { checkpointCaptured: true, codecByteExact: true, suffixTicksExecuted: 60 } });
  },
);

// Whole Driftwood remains refused; compare two real 10k native gameplay slices without running the 22k tape twice.
it('driftwood-isle reports identical real gameplay slices in independent native processes', () => {
  const first = driftwoodWitness('headless'), second = driftwoodWitness('headless');
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ compatible: false, headless: { status: 'passed', ticksExecuted: 10_000, entries: { lanes: 92 } } });
}, 60_000);

// Whole Pine compatibility remains refused, but its real phase-II replay now runs. Keep this CI test below 10k ticks.
it('pine-hollow reports identical King phase-II replays in independent native processes', () => {
  const first = pineWitness('replay'), second = pineWitness('replay');
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true,
    checkpoint: { state: 'fight', phase: 1 }, suffixTicksExecuted: 1200 } });
}, 60_000);

it('sunscar-dunes reports identical passing whole-shard results in independent native processes', () => {
  const first = signalWitness(), second = signalWitness();
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ compatible: true, headless: { status: 'passed' }, replay: { status: 'passed' }, ledger: { status: 'passed' } });
}, 120_000);

// The short replay slices carry canonical state hashes; run.mjs all retains the uninterrupted whole-tape witness.
it.each(['ride', 'crossing'])('nine-dragon-stack reports an identical %s replay in independent native processes (its whole tape is run.mjs all)', name => {
  const first = nativeCompatibility('nine-dragon-stack', `replay-${name}`), second = nativeCompatibility('nine-dragon-stack', `replay-${name}`);
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ transitional: false, replay: { status: 'passed' } });
}, 60_000);

it('far-reach reports identical step → gale-wall replay slices in independent native processes (its whole tape is run.mjs all)', () => {
  const first = skyWitness('slice-replay'), second = skyWitness('slice-replay');
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ 'slice-replay': { status: 'passed', workerExact: true } });
}, 120_000);
