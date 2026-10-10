import { expect, it } from 'vitest';
import * as v from 'valibot';
import { nalatiWitness } from './native';

it('replays the complete codec/native continuation exactly without claiming the missing gameplay is hosted', () => {
  const result = nalatiWitness('replay');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report = v.parse(v.object({ compatible: v.boolean(), replay: v.object({ status: v.string(), checkpointCaptured: v.boolean(),
    codecByteExact: v.boolean(), suffixTicksExecuted: v.number(), wholeShard: v.boolean(), suffixHash: v.string() }) }), JSON.parse(result.stdout));
  expect(report).toMatchObject({ compatible: false, replay: { status: 'partial',
    checkpointCaptured: true, codecByteExact: true, suffixTicksExecuted: 60, wholeShard: false } });
  expect(report.replay.suffixHash).toMatch(/^[a-f0-9]{64}$/u);
});
