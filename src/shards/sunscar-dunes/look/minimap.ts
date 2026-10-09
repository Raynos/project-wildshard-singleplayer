/**
 * Signal Dunes' map look (loop 4; review #14, mockup B): the manifest's `minimap.palette`. The ground is painted in the
 * shard's own sand (the engine's default is the olive meadow): pale gold on the crests, a deeper amber on the slip faces,
 * dusky violet-brown in the hollows, the boss basin's floor a shade darker. Over it the wind-cut sandstone ridges, the
 * caravan tracks (the trails) as a worn line, and the named places as the full map's pins. Node-safe: layout only, no
 * runtime engine import (the manifest imports this).
 */
import type { MapOverlay, MapPoi, MinimapPalette } from '@wildshard/engine/ui/Minimap';
import { BASIN, BRAZIERS, CARAVAN, RIDGES, TOWER, WELL } from '../data/layout';
import { STRINGS } from '../data/strings';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number, out: RGB): RGB => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const POI_COLOR = '#f6dcae';

/** The sand by slope and height: the low hollows violet-brown, the slopes amber, the high crests pale gold. */
const HOLLOW: RGB = [128, 82, 74], SAND: RGB = [196, 130, 78], CREST: RGB = [226, 172, 112], SLIP: RGB = [176, 104, 58], BASIN_FLOOR: RGB = [150, 96, 70];
function ground(x: number, z: number, h: number, slope: number, _forest: number, out: RGB): void {
  mix(HOLLOW, SAND, smooth(1, 6.5, h), out);
  mix(out, CREST, smooth(8, 15, h) * 0.8, out);
  mix(out, SLIP, smooth(0.08, 0.3, slope) * 0.6, out);
  const inBasin = Math.hypot(x - BASIN.x, z - BASIN.z);
  if (inBasin < BASIN.r) mix(out, BASIN_FLOOR, (1 - smooth(BASIN.floor, BASIN.r, inBasin)) * 0.6, out);
}

/** The ridges as dark sandstone spines, the trails as a worn caravan track (a dark bed, a pale centre), the places' marks. */
function overlay({ ctx, toU, toV, ppm, trails }: MapOverlay): void {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of RIDGES) {
    const dx = Math.sin(r.yaw) * r.len * 0.5, dz = Math.cos(r.yaw) * r.len * 0.5;
    for (const [w, style] of [[r.h * 1.4, 'rgba(60, 28, 22, 0.55)'], [r.h * 0.8, '#8a4a34']] as const) {
      ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.beginPath();
      ctx.moveTo(toU(r.x - dx), toV(r.z - dz)); ctx.lineTo(toU(r.x + dx), toV(r.z + dz)); ctx.stroke();
    }
  }
  for (const [w, style] of [[4.5, 'rgba(84, 48, 34, 0.55)'], [2, 'rgba(244, 214, 168, 0.85)']] as const) {
    ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.setLineDash(w < 3 ? [5 * ppm, 4 * ppm] : []); ctx.beginPath();
    for (const poly of trails) poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z))));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // The places: the tower a dark square, the caravan a long box, the well a ring, the waymarks small dots.
  const dot = (x: number, z: number, r: number, fill: string): void => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(toU(x), toV(z), r * ppm, 0, Math.PI * 2); ctx.fill(); };
  ctx.fillStyle = '#3a2016'; ctx.fillRect(toU(TOWER.x) - 3 * ppm, toV(TOWER.z) - 3 * ppm, 6 * ppm, 6 * ppm);
  ctx.save(); ctx.translate(toU(CARAVAN.x), toV(CARAVAN.z)); ctx.rotate(-CARAVAN.yaw); ctx.fillStyle = '#4a2a1c'; ctx.fillRect(-1.6 * ppm, -3 * ppm, 3.2 * ppm, 6 * ppm); ctx.restore();
  ctx.lineWidth = 1.2 * ppm; ctx.strokeStyle = '#4a2e24'; ctx.beginPath(); ctx.arc(toU(WELL.x), toV(WELL.z), 2.2 * ppm, 0, Math.PI * 2); ctx.stroke();
  for (const b of BRAZIERS) dot(b.x, b.z, 1.6, '#3a2016');
}

const pois = (): MapPoi[] => [
  { x: TOWER.x, z: TOWER.z, label: STRINGS.tower, color: POI_COLOR },
  { x: CARAVAN.x, z: CARAVAN.z, label: STRINGS.caravan, color: POI_COLOR },
  { x: WELL.x, z: WELL.z, label: STRINGS.well, color: POI_COLOR },
  { x: BASIN.x, z: BASIN.z, label: STRINGS.placeBasin, color: POI_COLOR },
];

export const SIGNAL_DUNES_MINIMAP: MinimapPalette = { ground, overlay, pois };
