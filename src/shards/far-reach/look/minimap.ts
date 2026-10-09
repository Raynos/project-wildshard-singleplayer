/**
 * Sky Reach's map look (loop 5; council R1B-6: the minimap was a dark olive disc with dots): the manifest's
 * `minimap.palette`. The void is the cloud sea, a pale rose; every island is a meadow disc with a darker soil rim; rope
 * bridges are solid plank lines, hover bridges dashed cyan glass, the updraft a cyan ramp; the windmill, the crown's dais
 * and stones, and the named places as the full map's pins. Node-safe: layout only, no runtime engine import (the manifest
 * imports this).
 */
import type { MapOverlay, MapPoi, MinimapPalette } from '@wildshard/engine/ui/Minimap';
import { CROWN, DAIS, FALLEN_BRIDGE, GROVE, ISLES, KEEPER, MILL, ROOST, RUIN, SPANS, STEP, SUNREST, UPDRAFT, WINDMILL, APOTHEM } from '../data/layout';
import { STRINGS } from '../data/strings';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number, out: RGB): RGB => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const POI_COLOR = '#fbe6c4';

const SEA: RGB = [214, 170, 172], SEA_DEEP: RGB = [176, 138, 162], MEADOW: RGB = [128, 150, 74], MEADOW_GOLD: RGB = [168, 164, 84], SOIL: RGB = [110, 76, 54];
/** The cloud sea, banded a little; inside an island's rim, its meadow, a soil ring at the lip. */
function ground(x: number, z: number, _h: number, _slope: number, _forest: number, out: RGB): void {
  mix(SEA_DEEP, SEA, 0.5 + 0.5 * Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2), out);
  for (const isle of ISLES) {
    const d = Math.hypot(x - isle.x, z - isle.z), a = isle.r * APOTHEM * 0.97; // the island top's apothem (layout.ts `apothem`), read as data: the manifest's closure stays in budget
    if (d > a + 1.5) continue;
    const top: RGB = [0, 0, 0]; mix(MEADOW, MEADOW_GOLD, 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.17), top);
    mix(top, SOIL, smooth(a - 1.6, a, d), top);
    mix(out, top, 1 - smooth(a, a + 1.5, d), out);
    return;
  }
}

function overlay({ ctx, toU, toV, ppm }: MapOverlay): void {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (x0: number, z0: number, x1: number, z1: number, w: number, style: string, dash: number[] = []): void => {
    ctx.lineWidth = w * ppm; ctx.strokeStyle = style; ctx.setLineDash(dash.map((d) => d * ppm)); ctx.beginPath();
    ctx.moveTo(toU(x0), toV(z0)); ctx.lineTo(toU(x1), toV(z1)); ctx.stroke();
  };
  for (const s of [...SPANS, FALLEN_BRIDGE]) {
    if (s.kind === 'rope') { line(s.x0, s.z0, s.x1, s.z1, s.width + 1.2, 'rgba(60, 36, 24, 0.6)'); line(s.x0, s.z0, s.x1, s.z1, s.width, '#a0764e'); }
    else { line(s.x0, s.z0, s.x1, s.z1, s.width + 0.8, 'rgba(40, 90, 110, 0.45)'); line(s.x0, s.z0, s.x1, s.z1, s.width * 0.6, '#9fe6f2', [3, 2.5]); }
  }
  line(UPDRAFT.x0, UPDRAFT.z0, UPDRAFT.x1, UPDRAFT.z1, UPDRAFT.width * 0.6, '#9fe6f2', [3, 2.5]);
  ctx.setLineDash([]);
  // the windmill a white disc, the crown's dais a stone ring
  ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.arc(toU(MILL.x), toV(MILL.z), 2.6 * ppm, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.2 * ppm; ctx.strokeStyle = '#5c5264'; ctx.beginPath(); ctx.arc(toU(DAIS.x), toV(DAIS.z), DAIS.r * ppm, 0, Math.PI * 2); ctx.stroke();
}

const pois = (): MapPoi[] => [
  { x: SUNREST.x, z: SUNREST.z, label: STRINGS.sunrest, color: POI_COLOR },
  { x: WINDMILL.x, z: WINDMILL.z, label: STRINGS.windmill, color: POI_COLOR },
  { x: GROVE.x, z: GROVE.z, label: STRINGS.grove, color: POI_COLOR },
  { x: ROOST.x, z: ROOST.z, label: STRINGS.roost, color: POI_COLOR },
  { x: KEEPER.x, z: KEEPER.z, label: STRINGS.keeper, color: POI_COLOR },
  { x: RUIN.x, z: RUIN.z, label: STRINGS.ruin, color: POI_COLOR },
  { x: STEP.x, z: STEP.z, label: STRINGS.step, color: POI_COLOR },
  { x: CROWN.x, z: CROWN.z, label: STRINGS.crown, color: POI_COLOR },
];

export const SKY_REACH_MINIMAP: MinimapPalette = { ground, overlay, pois };
