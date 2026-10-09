import { expect, it } from 'vitest';
import { nativeCompatibility } from './native';

it.each(['sunscar-dunes', 'far-reach', 'pine-hollow', 'driftwood-isle', 'nalati-grasslands', 'nine-dragon-stack'])(
  '%s reports identical fail-closed results in independent native processes', slug => {
    const first = nativeCompatibility(slug), second = nativeCompatibility(slug);
    expect(first.status).toBe(1); expect(first.stderr).toBe(''); expect(second).toEqual(first);
    const report: unknown = JSON.parse(first.stdout);
    expect(report).toMatchObject({ compatible: false, headless: { ticksExecuted: 0 }, replay: { checkpointCaptured: false } });
  },
);
