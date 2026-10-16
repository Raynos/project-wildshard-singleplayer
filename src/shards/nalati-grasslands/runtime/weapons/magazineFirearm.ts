import type { RangedOptions, RangedWorld } from '@wildshard/engine/combat/view/ranged';
import type { Targets } from '@wildshard/engine/combat/types';
import { HeldFirearm, heldFirearmDisplay, type HeldFirearmRows } from '@wildshard/game/plugin/heldFirearm';
import { parseHeldModelRows, parseHeldPresentation } from '@wildshard/format/weaponProfiles';
import type { FirearmProfile } from '@wildshard/sdk/weapons/firearmProfile';
import { AR15 } from '../../data/firearmProfile';
import model from '../../data/heldRifle.json' with { type: 'json' };

/**
 * The magazine firearm: the AR-15 style semi-automatic carbine on the held-firearm host (`@wildshard/game/plugin/heldFirearm`, H3):
 * its model, pose, reload and sight programmes are rows (data/heldRifle.json, the model as primitive rows: flat-top upper and lower receiver, free-float handguard under a
 * full-length rail, 14.5" barrel with an A2 flash hider, front post between ears, flip-up rear ghost ring with its cyan
 * glow sighted, charging handle, bolt, 30-round PMAG, pistol grip, collapsible stock), its numbers
 * the AR15 profile. Semi-auto: one round per pull, 30 + 90, reload on `R` or on an empty
 * pull; hitscan along the camera forward; ADS = shouldered iron sights, FOV 72 → 58.
 *
 *   const gun = rifle(world, targets, { row: AR15, allowUnlocked, muzzleLight: true });
 */
export type RifleWeapon = HeldFirearm<FirearmProfile>;

/** The AR-15's view: the hip pose, the ejection port, a two-frame flash with a 50 ms light, a 90 ms tracer. */
const RIFLE_VIEW = {
  kick: AR15.kick, port: [0.03, 0.008, 0.0], sight: { muzzleZ: AR15.ads.muzzleZ }, timing: { autoReloadDelay: AR15.autoReload },
  hip: { px: 0.13, py: -0.115, pz: -0.38, rx: 0.03, ry: 0.08, rz: 0.03, scale: 1.0 },
  flash: { frames: 2, lightTime: 0.05, light: 30, size: 0.22 }, brass: AR15.brass, tracer: { count: AR15.tracer.count, time: 0.09 },
} as const;

/** The AR-15's rows: the model, the frame, pose, reload and sight programmes, the presentation (heldRifle.json). */
const MODEL = parseHeldModelRows(model);
export const RIFLE_ROWS: HeldFirearmRows = {
  ...MODEL, mount: 'shared', brass: { geometry: 'case', material: 'brass' },
  playback: {
    groups: { frame: model.frame, pose: model.pose, parts: model.reloadParts, sight: model.sight },
    inputs: [{ group: 'frame', rows: model.frameInputs }, { group: 'pose', rows: model.poseInputs }, { group: 'parts', rows: model.partInputs }, { group: 'sight', rows: model.sightInputs }],
    outputs: [{ group: 'frame', rows: model.frameOutputs, target: 'frame' }, { group: 'sight', rows: model.sightOutputs, target: 'sight' }],
    schedule: { frame: 'frame', sight: 'sight', pose: 'pose', action: ['parts'], grip: [] },
  },
  presentation: parseHeldPresentation(model.presentation),
};

/** The Model Explorer's card (models/gear.ts): the displayed parts on their own materials, no glow, flash or depth clear. */
export function rifleSpecimen(sky: Parameters<typeof heldFirearmDisplay>[0]): ReturnType<typeof heldFirearmDisplay> { return heldFirearmDisplay(sky, RIFLE_ROWS, {}); }

/** The AR-15 as rows on the held-firearm host. */
export function rifle(world: RangedWorld, targets: Targets | undefined, opts: RangedOptions & { muzzleLight?: boolean; profile?: FirearmProfile }): RifleWeapon {
  return new HeldFirearm(world, targets, { ...opts, profile: opts.profile ?? AR15, view: RIFLE_VIEW, rows: RIFLE_ROWS, model: {} });
}
