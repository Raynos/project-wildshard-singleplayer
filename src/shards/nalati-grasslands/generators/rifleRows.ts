import { parseFirearmProfile, parseHeldFirearmRows, parseHeldFirearmView } from '@wildshard/sdk/weapons/firearmRows';
import items from '../data/items.json' with { type: 'json' };
import model from '../data/heldRifle.json' with { type: 'json' };

const FEEL = {
  kick: 0.35 * (Math.PI / 180), brass: { count: 3, life: 1.4 }, tracer: { count: 3, life: 0.09, width: 3 },
  ads: { blend: 0.16, motion: 0.3, nearMargin: 0.03, sightY: 0.064, rearZ: 0.10, frontZ: -0.455, muzzleZ: -0.645 },
};
/** Complete source-owned carbine model, feel and native view metadata. */
export interface NalatiRifleRows {
  feel: typeof FEEL;
  view: ReturnType<typeof parseHeldFirearmView>;
  rows: ReturnType<typeof parseHeldFirearmRows>;
}

/** Preserve the original magazine-action refusal, model admission and authored playback parameters.
 * Construct detached data without a scheduler handoff, renderer or weapon instance. */
export function nalatiRifleRows(): NalatiRifleRows {
  const profile = parseFirearmProfile(items.rows.find(row => row.id === 'weapon.rifle')?.profile);
  if (profile.action === 'bolt') throw new Error('Carbine requires a magazine firearm action');
  const feel = structuredClone(FEEL);
  const view = {
    kick: feel.kick, port: [0.03, 0.008, 0.0], sight: { muzzleZ: feel.ads.muzzleZ }, timing: { autoReloadDelay: profile.autoReload },
    hip: { px: 0.13, py: -0.115, pz: -0.38, rx: 0.03, ry: 0.08, rz: 0.03, scale: 1.0 },
    flash: { frames: 2, lightTime: 0.05, light: 30, size: 0.22 }, brass: feel.brass, tracer: { count: feel.tracer.count, time: 0.09 },
  };
  const rows = parseHeldFirearmRows(model);
  return { feel, view: parseHeldFirearmView(view), rows: parseHeldFirearmRows(rows) };
}
