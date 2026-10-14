/** The two authored shipwreck sites and their native interaction anchors. */
export interface WreckSpec {
  x: number; z: number; heading: number;
  /** radians of heel (negative = starboard down, the deck tilted toward the beach) */
  roll?: number;
  /** radians of trim (positive = stern down) */
  pitch?: number;
  /** world y of the hold floor at the origin (default: 0.4 m over the terrain there) */
  floorY?: number;
}
export interface WreckAnchor { x: number; y: number; z: number; yaw: number }
export interface HoldBounds { x: number; z: number; r: number; yMin: number; yMax: number }
