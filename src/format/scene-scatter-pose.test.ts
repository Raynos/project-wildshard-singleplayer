import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readSceneScatterPose, SceneScatterPoseSchema } from './sceneDressing';

const base = { x: 1, y: -2.5, z: 3, yaw: 0.25, sx: 1, sy: 1.5, sz: 1, far: 40, r: 0.1, g: 0.2, b: 0.3 };

// G782: the one-pass reader keeps the schema's exact rules and output
test('a scatter pose reads as the schema parses it, and is refused where the schema refuses it', () => {
  const accepted: unknown[] = [base, { ...base, tiltX: 0.1 }, { ...base, tiltZ: -0.2, solid: true }, { ...base, solid: 1 }, { tiltZ: 0, b: 0.3, g: 0.2, r: 0.1, far: 40, sz: 1, sy: 1.5, sx: 1, yaw: 0.25, z: 3, y: -2.5, x: 1, tiltX: 0 }];
  for (const row of accepted) {
    const read = readSceneScatterPose(row), parsed = v.parse(SceneScatterPoseSchema, row);
    expect(read).toEqual(parsed);
    expect(Object.keys(read)).toEqual(Object.keys(parsed));
  }
  const { far: _far, ...missing } = base;
  const refused: unknown[] = [null, 7, [], 'pose', missing, { ...base, x: Number.NaN }, { ...base, y: Infinity }, { ...base, z: '3' },
    { ...base, tiltX: undefined }, { ...base, tiltZ: null }, { ...base, solid: false }, { ...base, solid: 2 }, { ...base, extra: 1 }];
  for (const row of refused) {
    expect(v.safeParse(SceneScatterPoseSchema, row).success).toBe(false);
    expect(() => readSceneScatterPose(row)).toThrow();
  }
});
