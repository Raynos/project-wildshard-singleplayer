// Named camera presets for the captures (window.__nd.shot(name)). Positions are ground points (the eye is added);
// yaw 0 = north (-z), positive turns east; the portrait frame keeps a horizontal FOV, the landscape one a vertical FOV.
import { Y0 } from './layout';

export interface Shot {
  at: readonly [number, number, number];
  yaw: number;
  pitch: number;
  hfovPortrait: number;
  vfovLandscape: number;
  /** fire the Fei Zhua at the hook nearest the frame's centre, frozen at this phase (0.3 = line taut, claw bitten) */
  hook?: number;
  /** aim the claw at the hook nearest this point instead */
  hookNear?: readonly [number, number, number];
  /** false: hide the first-person weapon (the aerial / god views) */
  weapon?: boolean;
}

export const SHOTS: Readonly<Record<string, Shot>> = {
  // the hero frame of round-6 style-A-jiehua-neon.jpg: close by the balustrade, looking along it, the paifang ~1/3 of
  // the width a little left of centre, the mahjong tables and the noodle stall mid-right, the horizon just over centre
  'spawn': { at: [0.95, Y0, 7.5], yaw: 12, pitch: -4, hfovPortrait: 58, vfovLandscape: 56 },
  /** the same frame for the 2:3 portrait card (a wider horizontal FOV keeps the paifang at ~1/3) */
  'spawn-card': { at: [0.95, Y0, 8.5], yaw: 12, pitch: -1, hfovPortrait: 68, vfovLandscape: 56 },
  'spawn-wide': { at: [1.2, Y0, 11], yaw: 11, pitch: 5, hfovPortrait: 60, vfovLandscape: 58 },
  'well-edge': { at: [-10.5, Y0 + 0.4, 11.75], yaw: -3, pitch: -23, hfovPortrait: 62, vfovLandscape: 56, hook: 0.32, hookNear: [-3, Y0 - 3, -24] },
  'well-edge-wide': { at: [-10.5, Y0 + 0.4, 11.7], yaw: -2, pitch: -20, hfovPortrait: 70, vfovLandscape: 58, hook: 0.32, hookNear: [-3, Y0 - 3, -24] },
  'well-down': { at: [-10.5, Y0 + 0.75, 10.55], yaw: -3, pitch: -64, hfovPortrait: 64, vfovLandscape: 62, hook: 0.32, hookNear: [-3, Y0 - 12, -6] },
  'well-down-wide': { at: [-10.5, Y0 + 0.75, 10.3], yaw: -3, pitch: -64, hfovPortrait: 64, vfovLandscape: 66, hook: 0.32, hookNear: [-3, Y0 - 12, -6] },
  // ── the 9-angle look loop (LOOK-LOOP.md), anchor P = the spawn, moved between two balustrade posts (1.45, +125, 5.05): FP 1–6 portrait, 7–9 aerial ──
  'loop-1': { at: [1.45, Y0, 5.05], yaw: 8, pitch: 5, hfovPortrait: 58, vfovLandscape: 56 },
  'loop-2': { at: [1.45, Y0, 5.05], yaw: -84, pitch: -10, hfovPortrait: 62, vfovLandscape: 56 },
  'loop-3': { at: [1.45, Y0, 5.05], yaw: 48, pitch: 6, hfovPortrait: 62, vfovLandscape: 56 },
  'loop-4': { at: [1.45, Y0, 5.05], yaw: 93, pitch: 7, hfovPortrait: 58, vfovLandscape: 56 },
  'loop-5': { at: [1.45, Y0, 5.05], yaw: 14, pitch: 62, hfovPortrait: 66, vfovLandscape: 60 },
  'loop-6': { at: [0.8, Y0 + 0.5, 5.05], yaw: -92, pitch: -62, hfovPortrait: 64, vfovLandscape: 60 },
  'loop-7': { at: [-15, Y0 + 30, 2], yaw: 70, pitch: -46, hfovPortrait: 66, vfovLandscape: 60, weapon: false },
  'loop-8': { at: [-14, Y0 - 80, -14], yaw: 0, pitch: 78, hfovPortrait: 70, vfovLandscape: 66, weapon: false },
  'loop-9': { at: [-24.5, Y0 + 4, -12], yaw: 88, pitch: -6, hfovPortrait: 62, vfovLandscape: 56, weapon: false },
  // ── dome B (the half dome the spawn LOOKS at): anchor Q (13.0, +125, −13.0), a few metres in front of the gate / banyan
  // line; FP 1–6 portrait (no weapon: prop polish), 7–9 aerial diagonals of the gate + banyan + stall cluster ──
  'domeb-1': { at: [13, Y0, -13], yaw: -31, pitch: 14, hfovPortrait: 62, vfovLandscape: 56, weapon: false },
  'domeb-2': { at: [13, Y0, -13], yaw: 27, pitch: 13, hfovPortrait: 62, vfovLandscape: 56, weapon: false },
  'domeb-3': { at: [13, Y0, -13], yaw: -66, pitch: 4, hfovPortrait: 62, vfovLandscape: 56, weapon: false },
  'domeb-4': { at: [13, Y0, -13], yaw: 80, pitch: 4, hfovPortrait: 62, vfovLandscape: 56, weapon: false },
  'domeb-5': { at: [13, Y0, -13], yaw: -132, pitch: 4, hfovPortrait: 62, vfovLandscape: 56, weapon: false },
  'domeb-6': { at: [13, Y0, -13], yaw: -4, pitch: 55, hfovPortrait: 66, vfovLandscape: 60, weapon: false },
  'domeb-7': { at: [2, Y0 + 22, 4], yaw: 26, pitch: -36, hfovPortrait: 66, vfovLandscape: 58, weapon: false },
  'domeb-8': { at: [-12, Y0 + 20, -12], yaw: 74, pitch: -33, hfovPortrait: 66, vfovLandscape: 58, weapon: false },
  'domeb-9': { at: [18.5, Y0 + 15, -4], yaw: -30, pitch: -27, hfovPortrait: 66, vfovLandscape: 58, weapon: false },
  'stair-street': { at: [18, Y0, 6], yaw: 90, pitch: 10, hfovPortrait: 62, vfovLandscape: 56 },
  'canyon-up': { at: [7, Y0, -52], yaw: 3, pitch: 52, hfovPortrait: 68, vfovLandscape: 62 },
};
