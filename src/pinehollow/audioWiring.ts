import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Music } from '../audio/Music';
import type { ForestAmbience, ZoneSpot } from '../audio/ForestAmbience';
import type { AnimalManager } from '../entities/AnimalManager';
import type { Animal } from '../entities/Animal';
import type { Interactable } from '../world/Cabin';
import { audioLog } from '../audio/audioLog';
import {
  BEAR_CAVE, CREEK, HAMLET_SITES, LOOKOUT, OLD_GROWTH, RIDGE, RIDGE_STREAM, WATERFALL, ridgeFootZ, type XZ,
} from '../chunks/pineHollowLayout';
import { setting } from '../ui/Settings';

/**
 * Pine Hollow's sound, hooked to its gameplay (PINE-HOLLOW-REMASTER A-rows, the audio-wiring lane). The sound lane made
 * the music slots, the zoned beds, the one-shots and the barks; the fights, the quest and the loadout already call the
 * one-shots / barks / the King's music themselves (antlerKing.ts, quest/index.ts, loadout.ts). What is left lives here:
 *
 *   the clock        PineDayNight's `night` → the ambience's night beds (owls, crickets, the thralls' fog) and the music's
 *                    scene: calm-night past dusk, theme 1 by day (hysteresis 0.55 / 0.35; the King's fight owns the scene
 *                    while it runs; Debug ▸ Audio ▸ Pine Hollow score pins it)
 *   the elites       an engaged named elite keeps the score in combat (theme / night's tension stem up) while it lasts
 *   the zones        the layout's creek (along its bed + the ridge stream), the waterfall, the mill wheel (only while it turns),
 *                    ridge wind (the crest + the lookout, open sky), the old-growth hush, the bear cave's mouth
 *   one-shots        a deer's alarm snort when one goes alert near you; the cabins' and the hamlet's doors (open / close)
 *
 * main.ts calls `installPineAudio` once on Pine Hollow, after the ambience, the fights and the quest. Every trigger lands in
 * `window.__audioLog` (src/audio/audioLog.ts); `window.__pineAudio` has the spots.
 */
export interface PineAudioHost {
  game: Game;
  sky: Sky;
  music: Music;
  ambience: ForestAmbience;
  animals: AnimalManager;
  /** the cabins + the hamlet (their doors, the mill wheel's speed); null = none built */
  cabins: { interactables: Interactable[]; wheelSpeed: number } | null;
  /** a named elite is engaged (PineCombat.eliteEngaged) */
  eliteEngaged: () => boolean;
  params: URLSearchParams;
}

const NIGHT_ON = 0.55, NIGHT_OFF = 0.35;
const SNORT_R = 70, SNORT_GAP = 3;

/** points along a polyline, every `step` m (the vertices and the points between them) */
function along(poly: readonly XZ[], step: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i], b = poly[i + 1];
    if (!a || !b) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const last = poly[poly.length - 1];
  if (last) out.push([last[0], last[1]]);
  return out;
}

/** Pine Hollow's zone spots from the layout (src/chunks/pineHollowLayout.ts); `wheel` = the mill wheel's speed */
export function pineZoneSpots(wheel: () => number): ZoneSpot[] {
  const spots: ZoneSpot[] = [];
  // the creek from the pond's outlet to the slab's edge, and the ridge-top stream that feeds the waterfall: its bed, close up
  for (const [x, z] of along(CREEK, 18)) spots.push({ zone: 'creek', x, z, r: 6, fade: 18 });
  for (const [x, z] of along(RIDGE_STREAM, 18)) spots.push({ zone: 'creek', x, z, r: 4, fade: 14 });
  // the waterfall: its plunge pool at the foot (heard across the pond's north shore) and its lip up on the ridge
  spots.push({ zone: 'waterfall', x: WATERFALL.foot.x, z: WATERFALL.foot.z, r: 10, fade: 45, open: true });
  spots.push({ zone: 'waterfall', x: WATERFALL.lip.x, z: WATERFALL.lip.z, r: 5, fade: 25, open: true });
  // the mill wheel in the creek: only while it turns (the miller's errand starts it)
  spots.push({ zone: 'mill', x: HAMLET_SITES.wheel.x, z: HAMLET_SITES.wheel.z, r: 5, fade: 30, gain: () => (wheel() > 0.01 ? 1 : 0) });
  // ridge wind: along the crest (its foot + `climb`), and the lookout's crag top — open sky, the rain falls on you
  for (let x = -230; x <= 150; x += 38) spots.push({ zone: 'ridge', x, z: ridgeFootZ(x) + RIDGE.climb, r: 18, fade: 22, open: true });
  spots.push({ zone: 'ridge', x: LOOKOUT.x, z: LOOKOUT.z, r: 16, fade: 26, open: true });
  // the old-growth: its ellipse (centre, half-axes ax × az) as a column of circles down its long axis
  const og = OLD_GROWTH, rOg = Math.min(og.ax, og.az) * 0.62;
  for (let k = -2; k <= 2; k++) spots.push({ zone: 'oldgrowth', x: og.x + 10, z: og.z + k * (og.az - rOg) / 2, r: rOg, fade: 30 });
  // the bear cave: its dark mouth in the den's wall (a step inside the arch, toward the rock)
  const fx = -Math.sin(BEAR_CAVE.rot), fz = -Math.cos(BEAR_CAVE.rot);
  spots.push({ zone: 'cave', x: BEAR_CAVE.x - fx * 2, z: BEAR_CAVE.z - fz * 2, r: 2, fade: 12 });
  return spots;
}

export function installPineAudio(h: PineAudioHost): void {
  const { game, sky, music, ambience: amb, animals } = h;
  const spots = pineZoneSpots(() => h.cabins?.wheelSpeed ?? 0);
  for (const s of spots) amb.addSpot(s);

  // ── doors: every cabin / hamlet door (their prompts flip "Open door" ↔ "Close door") ──
  for (const it of h.cabins?.interactables ?? []) {
    if (!/^(Open|Close) door$/.test(it.label)) continue;
    const use = it.onInteract;
    it.onInteract = () => {
      const opening = it.label.startsWith('Open');
      use();
      amb.sfx.shot(opening ? 'doorOpen' : 'doorClose', { at: it.position });
    };
  }

  const pinned = setting('pineScore') !== 'auto'; // Debug ▸ Audio ▸ Pine Hollow score holds the scene (Music.ts reads it)
  const prev = new WeakMap<Animal, Animal['state']>();
  let night = false, slowT = 0, snortAt = -99, elite = false, eliteT = 0;
  game.onUpdate((dt, t) => {
    const dn = sky.pine;
    if (dn) amb.night = dn.night;
    slowT += dt;
    if (slowT < 0.2) return;
    slowT = 0;
    // the clock → the music's scene (the King's fight owns it while it runs)
    if (dn) {
      const was = night;
      night = night ? dn.night > NIGHT_OFF : dn.night > NIGHT_ON;
      if (night !== was) audioLog('wire', night ? 'clock:night' : 'clock:day', true, dn.night.toFixed(2));
      if (!pinned && music.pineScene !== 'boss') music.setPineScene(night ? 'night' : 'day');
    }
    // an engaged elite: combat, refreshed each second (Music.combat decays to alert 8 s after the last one)
    const on = h.eliteEngaged();
    if (on !== elite) { elite = on; audioLog('wire', on ? 'elite:engaged' : 'elite:clear'); }
    if (on && t - eliteT > 1) { eliteT = t; music.combat(0.8); }
    // a deer's alarm snort: one going alert near you (not one already running), one snort per few seconds
    const p = game.camera.position;
    for (const a of animals.animals) {
      const was = prev.get(a);
      prev.set(a, a.state);
      if (a.kind !== 'deer' || !a.alive || a.state !== 'alert' || was === undefined || was === 'alert' || was === 'flee') continue;
      if (t - snortAt < SNORT_GAP || a.position.distanceToSquared(p) > SNORT_R * SNORT_R) continue;
      snortAt = t;
      amb.sfx.shot('deer_snort', { at: a.position });
    }
  }, 'audio');
  Object.assign(window, { __pineAudio: { spots, get night() { return night; } } });
}
