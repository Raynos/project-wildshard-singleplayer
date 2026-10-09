import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('restores a mid-swing checkpoint into a fresh trusted adapter and replays the suffix to the identical snapshot', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { replay: { hash: string; replayHash: string } };
  expect(report).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true, checkpoint: { tick: 195, swing: 0 }, suffixTicksExecuted: 105 } });
  expect(report.replay.replayHash).toBe(report.replay.hash);
}, 60_000);
