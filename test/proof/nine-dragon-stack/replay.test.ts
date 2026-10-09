import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('restores a checkpoint mid-swing and mid-ride (held in the square\'s ring) into a fresh trusted adapter and replays the suffix to the identical snapshot', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'replay');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { replay: { hash: string; replayHash: string } };
  expect(report).toMatchObject({ replay: { status: 'passed', checkpointCaptured: true, checkpoint: { tick: 400, swing: 1 }, suffixTicksExecuted: 170 } });
  expect(report.replay.replayHash).toBe(report.replay.hash);
}, 60_000);
