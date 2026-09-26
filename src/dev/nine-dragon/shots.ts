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
  'spawn': { at: [1.45, Y0, 6], yaw: 8, pitch: 5, hfovPortrait: 58, vfovLandscape: 56 },
  'spawn-wide': { at: [1.6, Y0, 12], yaw: 9, pitch: 11, hfovPortrait: 60, vfovLandscape: 58 },
  'well-edge': { at: [-10.5, Y0 + 0.4, 11.75], yaw: -3, pitch: -23, hfovPortrait: 62, vfovLandscape: 56, hook: 0.32, hookNear: [-3, Y0 - 3, -24] },
  'well-edge-wide': { at: [-10.5, Y0 + 0.4, 11.7], yaw: -2, pitch: -20, hfovPortrait: 70, vfovLandscape: 58, hook: 0.32, hookNear: [-3, Y0 - 3, -24] },
  'well-down': { at: [-10.5, Y0 + 0.75, 10.55], yaw: -3, pitch: -64, hfovPortrait: 64, vfovLandscape: 62, hook: 0.32, hookNear: [-3, Y0 - 12, -6] },
  'well-down-wide': { at: [-10.5, Y0 + 0.75, 10.3], yaw: -3, pitch: -64, hfovPortrait: 64, vfovLandscape: 66, hook: 0.32, hookNear: [-3, Y0 - 12, -6] },
  'stair-street': { at: [18, Y0, 6], yaw: 90, pitch: 10, hfovPortrait: 62, vfovLandscape: 56 },
  'canyon-up': { at: [7, Y0, -52], yaw: 3, pitch: 52, hfovPortrait: 68, vfovLandscape: 62 },
};
