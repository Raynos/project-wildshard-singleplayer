import * as LAYOUT from './layout';
import STRINGS from '../data/strings.json' with { type: 'json' };
import type { MapMark, MapPaletteRow } from '@wildshard/format/minimap';

/**
 * Signal Dunes' map look (loop 4; review #14, mockup B) as rows for `@wildshard/format/minimap`'s `mapPalette`: the manifest's
 * `minimap.palette` and the tile bake's vertex colours. The ground is painted in the shard's own sand (the engine's default
 * is the olive meadow): the low hollows violet-brown, the slopes amber, the high crests pale gold, the slip faces a deeper
 * amber, the boss basin's floor a shade darker. Over it the wind-cut sandstone ridges as dark spines, the caravan tracks
 * (the trails) as a worn line (a dark bed, a pale dashed centre), and the places' marks: the tower a dark square, the
 * caravan a long box, the well a ring, the waymarks small dots; the named places are the full map's pins.
 */
const POI_COLOR = '#f6dcae';
export const SIGNAL_DUNES_MAP: MapPaletteRow = {
  ground: {
    base: [128, 82, 74],
    layers: [
      { color: [196, 130, 78], by: 'height', edges: [1, 6.5] },
      { color: [226, 172, 112], by: 'height', edges: [8, 15], gain: 0.8 },
      { color: [176, 104, 58], by: 'slope', edges: [0.08, 0.3], gain: 0.6 },
      { color: [150, 96, 70], by: 'distance', edges: [LAYOUT.BASIN.floor, LAYOUT.BASIN.r], gain: 0.6, invert: true, centre: { x: LAYOUT.BASIN.x, z: LAYOUT.BASIN.z, within: LAYOUT.BASIN.r } },
    ],
  },
  segments: LAYOUT.RIDGES.map((r) => {
    const dx = Math.sin(r.yaw) * r.len * 0.5, dz = Math.cos(r.yaw) * r.len * 0.5;
    return { from: [r.x - dx, r.z - dz], to: [r.x + dx, r.z + dz], strokes: [{ width: r.h * 1.4, style: 'rgba(60, 28, 22, 0.55)' }, { width: r.h * 0.8, style: '#8a4a34' }] };
  }),
  trails: [{ width: 4.5, style: 'rgba(84, 48, 34, 0.55)' }, { width: 2, style: 'rgba(244, 214, 168, 0.85)', dash: [5, 4] }],
  marks: [
    { kind: 'square', x: LAYOUT.TOWER.x, z: LAYOUT.TOWER.z, half: 3, fill: '#3a2016' },
    { kind: 'box', x: LAYOUT.CARAVAN.x, z: LAYOUT.CARAVAN.z, yaw: LAYOUT.CARAVAN.yaw, width: 3.2, length: 6, fill: '#4a2a1c' },
    { kind: 'ring', x: LAYOUT.WELL.x, z: LAYOUT.WELL.z, r: 2.2, line: 1.2, stroke: '#4a2e24' },
    ...LAYOUT.BRAZIERS.map((b): MapMark => ({ kind: 'dot', x: b.x, z: b.z, r: 1.6, fill: '#3a2016' })),
  ],
  pois: [
    { x: LAYOUT.TOWER.x, z: LAYOUT.TOWER.z, label: STRINGS.tower, color: POI_COLOR },
    { x: LAYOUT.CARAVAN.x, z: LAYOUT.CARAVAN.z, label: STRINGS.caravan, color: POI_COLOR },
    { x: LAYOUT.WELL.x, z: LAYOUT.WELL.z, label: STRINGS.well, color: POI_COLOR },
    { x: LAYOUT.BASIN.x, z: LAYOUT.BASIN.z, label: STRINGS.placeBasin, color: POI_COLOR },
  ],
};
