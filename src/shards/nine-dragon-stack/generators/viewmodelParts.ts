// Fixed pendant buffers and bounded per-vertex flutter coefficients, baked in weapon space.
import { BufferAttribute, type BufferGeometry, Quaternion, Vector3 } from 'three';
import { ClothSheet, StrandTassel } from './clothRest';
import { ARMS } from '../data/arms';
import motion from '../data/clothMotion.json' with { type: 'json' };
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
  const tassel = new StrandTassel(TASSEL, tasselGeo()), sheet = new ClothSheet(TALISMAN, sheetGeo(), cordGeo());
  const q = new Quaternion(), gravity = new Vector3(0, -9.8, 0);
  const pivot = (name: string): Vector3 => new Vector3().fromArray(ARMS.pendants[name] ?? [0, 0, 0]);
  const caps = ARMS.colliders.filter(row => row.a.bone === ARMS.weapon && row.b.bone === ARMS.weapon)
    .map(row => ({ a: new Vector3().fromArray(row.a.at ?? [0, 0, 0]), b: new Vector3().fromArray(row.b.at ?? [0, 0, 0]), r: row.r }));
  for (let i = 0; i < 120; i++) {
    tassel.step(1 / 60, pivot('tassel'), q, gravity, 0, caps);
    sheet.step(1 / 60, pivot('talisman'), q, gravity, 0, caps);
  }
  const knot = kx.build().applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), tassel.capDir)).translate(tassel.cap.x, tassel.cap.y, tassel.cap.z);
  for (const [geometry, top, length] of [[tassel.geo, pivot('tassel').y - TASSEL.cordLen - TASSEL.cap, TASSEL.len], [sheet.geo, pivot('talisman').y - TALISMAN.cordLen, TALISMAN.h], [sheet.cordGeo, pivot('talisman').y, TALISMAN.cordLen]] as const) {
    const pos = geometry.getAttribute('position'), field = new Float32Array(pos.count * 4), p = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      let clearance = motion.amplitude;
      for (const cap of caps) {
        const axis = cap.b.clone().sub(cap.a), t = Math.max(0, Math.min(1, p.clone().sub(cap.a).dot(axis) / Math.max(axis.lengthSq(), 1e-12)));
        clearance = Math.min(clearance, Math.max(0, p.distanceTo(cap.a.clone().addScaledVector(axis, t)) - cap.r - motion.pad) * .4);
      }
      const weight = Math.max(0, Math.min(1, (top - p.y) / length));
      field[i * 4] = weight * weight * clearance;
      field[i * 4 + 1] = p.x * motion.phaseX + p.y * motion.phaseY;
      field[i * 4 + 2] = motion.depth;
    }
    geometry.setAttribute('aCloth', new BufferAttribute(field, 4));
    geometry.computeBoundingSphere();
  }
  return { knot, tassel: tassel.geo, sheet: sheet.geo, cord: sheet.cordGeo };
}
