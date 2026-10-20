import { expect, test } from 'vitest';
import { parseGraphArms } from '../src/format/heldArms';
import { heldView } from '../src/shards/nine-dragon-stack/generators/heldView';
import arms from '../src/shards/nine-dragon-stack/data/arms.json' with { type: 'json' };

test('Nine held arms are one admitted GraphArms row', () => {
  const row = parseGraphArms(heldView());
  expect(row.blade).toEqual({ socket: 'R_weapon', base: arms.ARMS.bladeBase, tip: arms.ARMS.bladeTip });
  expect(row.rig.joints.flat()).toHaveLength(14);
  expect(new Set(row.meshes.map(mesh => mesh.look)).size).toBeGreaterThan(0);
  for (const entry of row.frame) if (entry.look !== undefined) expect(row.params[entry.look]).toContain(entry.param);
  expect(() => parseGraphArms({ ...row, frame: [{ param: 'uTime', source: 'clock' }] })).toThrow();
});
