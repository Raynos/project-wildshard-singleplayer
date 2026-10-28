/** Frozen complete marker method from 966a782a42 HUD; only its test receiver/signature is named. */
import { CABIN_SITES } from '../world/Heightfield';
import { bearingTo, type HUDState } from '../ui/HUD';

const PAW_RANGE = 120;
export interface MarkerFixture {
  animals: { x: number; z: number }[];
  markHouse: HTMLElement; markPaw: HTMLElement; range: HTMLElement;
  band: HTMLElement; bandW: number; ppd: number;
  lastMark: {house: number; paw: number; range: string};
  placeMark: (mark: HTMLElement, key: 'house' | 'paw', rel: number) => void;
}
function original(this: MarkerFixture, s: Pick<HUDState, 'pos' | 'nearest'>, heading: number): void {
    const { x, z } = s.pos;
    let cabin: { d: number; b: number } | null = null;
    for (const c of CABIN_SITES) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (!cabin || d < cabin.d) cabin = { d, b: bearingTo(x, z, c.x, c.z) };
    }
    let paw: { d: number; b: number } | null = null;
    if (s.nearest) { if (s.nearest.distance <= PAW_RANGE) paw = { d: s.nearest.distance, b: s.nearest.bearing }; }
    else for (const a of this.animals) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d <= PAW_RANGE && (!paw || d < paw.d)) paw = { d, b: bearingTo(x, z, a.x, a.z) };
    }
    this.placeMark(this.markHouse, 'house', cabin ? cabin.b - heading : Number.NaN);
    this.placeMark(this.markPaw, 'paw', paw ? paw.b - heading : Number.NaN);
    const range = cabin ? `Cabin · ${Math.round(cabin.d)} m` : '';
    if (range !== this.lastMark.range) { this.lastMark.range = range; this.range.textContent = range; this.range.classList.toggle('show', range !== ''); }
  }

export const markersBefore: typeof original = original;

