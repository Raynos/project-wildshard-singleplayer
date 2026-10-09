import { expect, it } from 'vitest';
import { nativeCompatibility } from './native';
import { signalWitness } from '../sunscar-dunes/native';
import { skyWitness } from '../far-reach/native';

it.each(['pine-hollow', 'driftwood-isle', 'nalati-grasslands'])(
  '%s reports identical fail-closed results in independent native processes', slug => {
    const first = nativeCompatibility(slug), second = nativeCompatibility(slug);
    expect(first.status).toBe(1); expect(first.stderr).toBe(''); expect(second).toEqual(first);
    const report: unknown = JSON.parse(first.stdout);
    expect(report).toMatchObject({ compatible: false, headless: { ticksExecuted: 0 }, replay: { checkpointCaptured: false } });
  },
);

it('sunscar-dunes reports identical passing whole-shard results in independent native processes', () => {
  const first = signalWitness(), second = signalWitness();
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ compatible: true, headless: { status: 'passed' }, replay: { status: 'passed' }, ledger: { status: 'passed' } });
}, 120_000);

it('nine-dragon-stack reports identical passing, transitional results in independent native processes (its ledger declares no rule)', () => {
  const first = nativeCompatibility('nine-dragon-stack'), second = nativeCompatibility('nine-dragon-stack');
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ compatible: true, transitional: true, headless: { status: 'passed' }, replay: { status: 'passed' }, ledger: { status: 'not-declared' } });
}, 120_000);

it('far-reach reports identical step → gale-wall replay slices in independent native processes (its whole tape is run.mjs all)', () => {
  const first = skyWitness('slice-replay'), second = skyWitness('slice-replay');
  expect(first.stderr).toBe(''); expect(first.status).toBe(0); expect(second).toEqual(first);
  expect(JSON.parse(first.stdout)).toMatchObject({ 'slice-replay': { status: 'passed', workerExact: true } });
}, 120_000);
