// Fixed tassel, paper, cord and knot. Their live simulation only rewrites the baked channels.
import type { BufferGeometry } from 'three';
import { ClassKit, type ClassLook, v3 } from './kit/classKit';
import { tubeTopology, sheetTopology } from './kit/clothTopology';
import viewmodel from '../data/decals.json' with { type: 'json' };
import { TALISMAN, TASSEL, TASSEL_DARK_EVERY } from '../data/cloth';

const classKit = (): ClassKit => new ClassKit({ fallback: viewmodel.classes.brass, glow: viewmodel.classes.glow });
function tasselGeo(): BufferGeometry {
  const g = classKit();
  const silk: ClassLook = { cls: viewmodel.classes.silk };
  const dark: ClassLook = { cls: viewmodel.classes.trim };
  tubeTopology(g, TASSEL.cordPts, TASSEL.cordSegs, dark, 0.03);
  for (let s = 0; s < TASSEL.strands; s++) tubeTopology(g, TASSEL.pts, TASSEL.strandSegs, s % TASSEL_DARK_EVERY === 0 ? dark : silk, TASSEL.len);
  return g.build();
}

function sheetGeo(): BufferGeometry {
  const g = classKit();
  sheetTopology(g, TALISMAN.cols, TALISMAN.rows, { cls: viewmodel.classes.paper });
  return g.build();
}

function cordGeo(): BufferGeometry {
  const cg = classKit();
  tubeTopology(cg, TALISMAN.cordPts + 1, TALISMAN.cordSegs, { cls: viewmodel.classes.trim }, 0.03);
  return cg.build();
}


export function buildViewmodelParts(): { knot: BufferGeometry; tassel: BufferGeometry; sheet: BufferGeometry; cord: BufferGeometry } {
  const kx = classKit();
  kx.ellipsoid(v3(0, 0.008, 0), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 0.012, 0.0135, 0.012, { cls: viewmodel.classes.silk }, (d) => 1 + 0.08 * Math.sin(d.x * 9) * Math.sin(d.z * 9), 14);
  kx.lathe(0, -0.024, 0, [[0.007, 0], [0.0135, 0.005], [0.0145, 0.012], [0.012, 0.018], [0.008, 0.022]], 16, { cls: viewmodel.classes.brass, line: 1, edges: 4 | 8 });
  return { knot: kx.build(), tassel: tasselGeo(), sheet: sheetGeo(), cord: cordGeo() };
}
