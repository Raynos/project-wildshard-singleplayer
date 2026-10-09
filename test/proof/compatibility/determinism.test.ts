import { expect, it } from 'vitest';
import { nativeCompatibility } from './native';
import { signalWitness } from '../sunscar-dunes/native';

it.each(['far-reach', 'pine-hollow', 'driftwood-isle', 'nalati-grasslands', 'nine-dragon-stack'])(
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
