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
}

export const SHOTS: Readonly<Record<string, Shot>> = {
  'spawn': { at: [1.35, Y0, 6], yaw: 9, pitch: 5, hfovPortrait: 52, vfovLandscape: 56 },
  'spawn-wide': { at: [1.6, Y0, 11], yaw: 10, pitch: 5, hfovPortrait: 56, vfovLandscape: 52 },
  'well-edge': { at: [-10.5, Y0 + 0.15, 12.3], yaw: -3, pitch: -15, hfovPortrait: 62, vfovLandscape: 56, hook: 0.32, hookNear: [-3, Y0 - 3, -24] },
  'well-edge-wide': { at: [-10.5, Y0 + 0.15, 12.3], yaw: -2, pitch: -13, hfovPortrait: 70, vfovLandscape: 58, hook: 0.32, hookNear: [-3, Y0 - 3, -24] },
  'well-down': { at: [-10.5, Y0 + 0.45, 11.9], yaw: -3, pitch: -55, hfovPortrait: 64, vfovLandscape: 62, hook: 0.32, hookNear: [-3, Y0 - 12, -6] },
  'well-down-wide': { at: [-10.5, Y0 + 0.6, 10.4], yaw: -3, pitch: -60, hfovPortrait: 64, vfovLandscape: 66, hook: 0.32, hookNear: [-3, Y0 - 12, -6] },
  'stair-street': { at: [26, Y0, 6], yaw: 90, pitch: 10, hfovPortrait: 62, vfovLandscape: 56 },
  'canyon-up': { at: [6.5, Y0, -40], yaw: 3, pitch: 52, hfovPortrait: 68, vfovLandscape: 62 },
};
