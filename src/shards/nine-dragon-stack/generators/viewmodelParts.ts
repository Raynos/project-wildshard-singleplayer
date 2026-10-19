// Fixed pendant buffers and bounded per-vertex flutter coefficients, baked in weapon space.
import { BufferAttribute, type BufferGeometry, Quaternion, Vector3 } from 'three';
import { ClothSheet, StrandTassel } from './clothRest';
import arms from '../data/arms.json' with { type: 'json' };
import motion from '../data/clothMotion.json' with { type: 'json' };
import { ClassKit, type ClassLook, v3 } from './kit/classKit';
import { tubeTopology, sheetTopology } from './kit/clothTopology';
import viewmodel from '../data/decals.json' with { type: 'json' };
import cloth from '../data/cloth.json' with { type: 'json' };
import * as v from 'valibot';

const quad = v.tuple([v.number(), v.number(), v.number(), v.number()]);
const breeze = v.tuple([v.number(), v.number(), v.number(), v.number(), v.number()]);
const tuples = v.parse(v.object({ TASSEL: v.object({ strandTaper: quad, spread: quad, breezeX: breeze, breezeZ: breeze }),
  TALISMAN: v.object({ flutter: breeze, sway: breeze }) }), cloth);

const classKit = (): ClassKit => new ClassKit({ fallback: viewmodel.classes.brass, glow: viewmodel.classes.glow });
function tasselGeo(): BufferGeometry {
  const g = classKit();
  const silk: ClassLook = { cls: viewmodel.classes.silk };
  const dark: ClassLook = { cls: viewmodel.classes.trim };
  tubeTopology(g, cloth.TASSEL.cordPts, cloth.TASSEL.cordSegs, dark, 0.03);
  for (let s = 0; s < cloth.TASSEL.strands; s++) tubeTopology(g, cloth.TASSEL.pts, cloth.TASSEL.strandSegs, s % cloth.TASSEL_DARK_EVERY === 0 ? dark : silk, cloth.TASSEL.len);
  return g.build();
}

function sheetGeo(): BufferGeometry {
  const g = classKit();
  sheetTopology(g, cloth.TALISMAN.cols, cloth.TALISMAN.rows, { cls: viewmodel.classes.paper });
  return g.build();
}

function cordGeo(): BufferGeometry {
  const cg = classKit();
  tubeTopology(cg, cloth.TALISMAN.cordPts + 1, cloth.TALISMAN.cordSegs, { cls: viewmodel.classes.trim }, 0.03);
  return cg.build();
}


export function buildViewmodelParts(): { knot: BufferGeometry; tassel: BufferGeometry; sheet: BufferGeometry; cord: BufferGeometry } {
  const kx = classKit();
  kx.ellipsoid(v3(0, 0.008, 0), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 0.012, 0.0135, 0.012, { cls: viewmodel.classes.silk }, (d) => 1 + 0.08 * Math.sin(d.x * 9) * Math.sin(d.z * 9), 14);
  kx.lathe(0, -0.024, 0, [[0.007, 0], [0.0135, 0.005], [0.0145, 0.012], [0.012, 0.018], [0.008, 0.022]], 16, { cls: viewmodel.classes.brass, line: 1, edges: 4 | 8 });
  const tassel = new StrandTassel({ ...cloth.TASSEL, ...tuples.TASSEL }, tasselGeo()), sheet = new ClothSheet({ ...cloth.TALISMAN, ...tuples.TALISMAN }, sheetGeo(), cordGeo());
  const q = new Quaternion(), gravity = new Vector3(0, -9.8, 0);
  const pivot = (name: keyof typeof arms.ARMS.pendants): Vector3 => new Vector3().fromArray(arms.ARMS.pendants[name]);
  const caps = arms.ARMS.colliders.filter(row => row.a.bone === arms.ARMS.weapon && row.b.bone === arms.ARMS.weapon)
    .map(row => ({ a: new Vector3().fromArray(row.a.at ?? [0, 0, 0]), b: new Vector3().fromArray(row.b.at ?? [0, 0, 0]), r: row.r }));
  for (let i = 0; i < 120; i++) {
    tassel.step(1 / 60, pivot('tassel'), q, gravity, 0, caps);
    sheet.step(1 / 60, pivot('talisman'), q, gravity, 0, caps);
  }
  const knot = kx.build().applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), tassel.capDir)).translate(tassel.cap.x, tassel.cap.y, tassel.cap.z);
  for (const [geometry, top, length] of [[tassel.geo, pivot('tassel').y - cloth.TASSEL.cordLen - cloth.TASSEL.cap, cloth.TASSEL.len], [sheet.geo, pivot('talisman').y - cloth.TALISMAN.cordLen, cloth.TALISMAN.h], [sheet.cordGeo, pivot('talisman').y, cloth.TALISMAN.cordLen]] as const) {
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
  knot.setAttribute('aHullN', knot.getAttribute('normal').clone());
  return { knot, tassel: tassel.geo, sheet: sheet.geo, cord: sheet.cordGeo };
}
