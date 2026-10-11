import type { CommonsPack } from '@wildshard/sdk/commons';
/** Authored starter bow parameters shared by Nalati and Pine; runtime supplies wind and the view. */
const STARTER_BOW_DATA = {
  family: 'bow', quiver: 24, swayMax: 1.5 * (Math.PI / 180), speedBase: 30, speedDraw: 28, damageScale: 1.2,
  aimZoom: 2, aimVmZoom: 0.85, aimSway: 0.5, aimSpread: 0.5, aimIn: 10,
  arcFrom: 0.25, arcColour: 0x8fe3ff, arcMode: 'setting', zoomLook: true,
  inspectZ: -0.5, inspectHidesArms: false, transparentParts: false, vmScale: 0.72,

} as const;

/** Emit the unchanged shared starter bow parameters; runtime wind and rendered view remain injected. */
export function starterWeaponsPack(provenance: { credit: string; licence: string }): CommonsPack {
  return { id: 'starter-weapons', version: '1.0.0', entries: [{ id: 'bow', kind: 'binary',
    bytes: new TextEncoder().encode(JSON.stringify(STARTER_BOW_DATA)), ...provenance }] };
}
