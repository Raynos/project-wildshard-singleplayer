import type { HookPracticeRow } from '@wildshard/format/practiceCourseRows';

/** Numeric observations for the admitted course guest; static checkpoint facing is baked once. */
export function practiceFrame(row: HookPracticeRow): Readonly<Record<string, number>> {
  const startPad = row.pads.findIndex(pad => pad.id === row.run.from), finishPad = row.pads.findIndex(pad => pad.id === row.run.to);
  if (row.pads.length > 11 || startPad === -1 || finishPad === -1) throw new Error('Invalid practice pads');
  return { startPad, finishPad, padCount: row.pads.length, fallY: row.fallY, lowest: Math.min(...row.pads.map(pad => pad.top)),
    ...Object.fromEntries(row.pads.flatMap((pad, index) => {
      const next = pad.next === undefined ? undefined : row.pads.find(value => value.id === pad.next);
      if (pad.next !== undefined && next === undefined) throw new Error('Unknown practice checkpoint');
      const facing = (z: number): readonly [number, number] => next === undefined ? [0, -0.1] : [Math.atan2(-(next.x - pad.x), -(next.z - z)), Math.atan2(next.top - pad.top, Math.hypot(next.x - pad.x, next.z - z)) * 0.8];
      const [Yaw, Pitch] = facing(pad.z), [StartYaw, StartPitch] = facing(pad.z + pad.d / 2 - 3);
      return Object.entries({ Depth: pad.d, Eligible: pad.kind !== 'start' && pad.kind !== 'range' ? 1 << row.pads.findIndex(value => value.id === pad.id) : 0, Pitch, StartPitch, StartYaw, Top: pad.top, Width: pad.w, X: pad.x, Yaw, Z: pad.z })
        .map(([key, value]) => [`pad${String(index).padStart(2, '0')}${key}`, value === 0 ? 0 : value] as const);
    })),
  };
}
