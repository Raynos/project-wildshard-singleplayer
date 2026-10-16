/** Native manager settings; the existing version-3 continuation remains readable. */
export const PINE_NATIVE_HUNT = {
  limit: 512, fight: { telegraphed: false }, player: 'origin',
  bands: { states: ['sidestep'], scripted: true, legacyKinds: [] },
  hit: { namespace: 'creature', tags: ['feel.blow', 'cover.checked'] },
} as const;
