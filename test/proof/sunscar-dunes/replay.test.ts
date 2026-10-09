import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('refuses replay without a real encounter checkpoint and complete native continuation', () => {
  const result = nativeCompatibility('sunscar-dunes', 'replay');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ compatible: false, replay: { status: 'blocked',
    checkpointCaptured: false, suffixTicksExecuted: 0, dependency: 'Renderer dependency in Node simulation: repo:/src/engine/anim/rig.ts' } });
});
