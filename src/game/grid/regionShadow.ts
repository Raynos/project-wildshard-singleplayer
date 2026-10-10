/**
 * SF63 (SHARD-PLATFORM, E435): a grid cell's shadows when its level's own rig is the phone's split cascades (three 2048²
 * cascades to 7 / 22 / 80 m, `LookStrategy.shadows.rig = 'phoneSplits'`). The page shell draws one 1024² cascade over its
 * tier's reach (≈ ±88 m on the phone), so such a level's small casters (posts, palms, ferns) cast nothing visible in its
 * cell. The cascade count is a page-wide shader define, so the cheaper option is taken here: while the region is entered,
 * the page's one cascade pulls in to `FOCUS_FAR` m at `FOCUS_SIZE`² (`SkyRig.focusCascade`, no recompile), losing the far
 * shadows. Default off behind pause ▸ Settings ▸ Debug ▸ Grid cell shadows until Jake picks from the A / B board
 * (art/sf63/round-1-driftwood-shadows/). Generic game code (E405): no shard is named here.
 */
import { onSettingChange, setting } from '@wildshard/engine/ui/Settings';

/** how far the focused cascade reaches (m): the split rig's middle cascade */
export const FOCUS_FAR = 22;
/** the focused cascade's map size (texels a side): the split rig's */
export const FOCUS_SIZE = 2048;

/** What the focus needs of the page sky: `SkyRig.focusCascade` (null on a rig with more than one cascade). */
export interface FocusableSky { readonly focusCascade: (far: number, size: number) => (() => void) | null }

/** Where the Debug row is read (the page's settings; a test hands its own `createSettings`). */
export interface RegionShadowSettings {
  readonly setting: (key: 'regionShadowFocus') => string;
  readonly onSettingChange: (key: 'regionShadowFocus', fn: (value: 'off' | 'tight') => void) => () => void;
}
const PAGE_SETTINGS: RegionShadowSettings = { setting, onSettingChange };

/**
 * Focus the page's one cascade while `entry` lasts, following the Debug row live. Register it after the region's light
 * swap: an entry's cleanups run last-in first-out, so the reach and map size are back before the swap holds the region's
 * light for its next entry and puts the page's back.
 */
export function focusRegionShadow(sky: FocusableSky, entry: { readonly onDispose: (fn: () => void) => void }, settings: RegionShadowSettings = PAGE_SETTINGS): void {
  let undo: (() => void) | null = null;
  const apply = (value: string): void => {
    if (value === 'tight' && undo === null) undo = sky.focusCascade(FOCUS_FAR, FOCUS_SIZE);
    else if (value !== 'tight' && undo !== null) { undo(); undo = null; }
  };
  apply(settings.setting('regionShadowFocus'));
  const off = settings.onSettingChange('regionShadowFocus', apply);
  entry.onDispose(() => { off(); undo?.(); undo = null; });
}
