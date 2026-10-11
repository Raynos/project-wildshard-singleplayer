import { expect, it } from 'vitest';
import * as v from 'valibot';
import { nalatiWitness } from './native';

it('replays the complete codec/native continuation exactly without claiming the missing gameplay is hosted', () => {
  const result = nalatiWitness('slice-replay');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report = v.parse(v.object({ compatible: v.boolean(), replay: v.object({ status: v.string(), checkpointCaptured: v.boolean(),
    codecByteExact: v.boolean(), suffixTicksExecuted: v.number(), wholeShard: v.boolean(), suffixHash: v.string() }) }), JSON.parse(result.stdout));
  expect(report).toMatchObject({ compatible: false, replay: { status: 'partial',
    checkpointCaptured: true, codecByteExact: true, suffixTicksExecuted: 60, wholeShard: false } });
  expect(report.replay.suffixHash).toMatch(/^[a-f0-9]{64}$/u);
});

// The real 8,172-tick journey has one mid-round checkpoint and a 4,297-tick restored suffix.
// DEPLOY.md permits 60 seconds for a native gameplay tape below 10k ticks; codec and entry work run separately.
it('replays the actual five-round taming journey exactly through its mid-round checkpoint', () => {
  const result = nalatiWitness('taming-replay');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report = v.parse(v.object({ compatible: v.boolean(), taming: v.object({ checkpointTick: v.number(), suffixExact: v.boolean() }) }), JSON.parse(result.stdout));
  expect(report.compatible).toBe(false);
  expect(report.taming).toMatchObject({ suffixExact: true });
  expect(report.taming.checkpointTick).toBeGreaterThan(250);
}, 60_000);
