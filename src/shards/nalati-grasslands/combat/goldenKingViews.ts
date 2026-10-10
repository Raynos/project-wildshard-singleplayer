import type { BossViewBinding } from '@wildshard/sdk/phasedBoss';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import * as THREE from 'three';
import { type KurganDungeon, DUNGEON, COFFIN } from '../world/KurganDungeon';
import { KING_TUNING } from '../data/goldenKingFight';

/** The chamber the Golden King's views draw on: its lid, shafts, niches, rings, pours, beam, dome, painted arc and heap. */
export type KingChamber = Pick<KurganDungeon, 'setLid' | 'setShaft' | 'setNicheStatue' | 'showHeap' | 'sandAt' | 'rings' | 'streams' | 'beam' | 'dome' | 'arc'>;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3();
const n = (value: number | undefined): number => value ?? 0;

/**
 * The Golden King fight's view bindings (SF27): every view the platform fight (combat/goldenKingRow.ts) names, drawn on
 * the kurgan chamber's meshes in its local frame, and the King's gold glow on his body's materials. View only: nothing
 * here moves the fight.
 */
export function goldenKingViews(d: KingChamber, king: () => Animal | null): BossViewBinding {
  d.dome.mesh.scale.setScalar(1.75);
  d.dome.mat.uniforms.uAlpha.value = 0.9;
  return {
    'arena.lid.open': (open) => { d.setLid(n(open)); },
    'arena.shaft': (i, strength) => { d.setShaft(n(i), n(strength)); },
    'arena.fx.hide': () => {
      for (const r of d.rings) r.mesh.visible = false;
      for (const s of d.streams) { s.mesh.visible = false; s.tell.visible = false; }
      d.beam.mesh.visible = false; d.beam.line.visible = false; d.dome.mesh.visible = false; d.arc.mesh.visible = false;
    },
    'arena.shield': (on) => { d.dome.mesh.visible = on === 1; },
    'arena.shield.at': (x, y, z) => { d.dome.mesh.position.set(n(x) - DUNGEON.x, n(y) - DUNGEON.y, n(z) - DUNGEON.z); },
    'adds.spot': (i, on) => { d.setNicheStatue(n(i), on === 1); },
    'boss.glow': (k) => {
      const body = king();
      if (!body) return;
      const mats = Array.isArray(body.mesh.material) ? body.mesh.material : [body.mesh.material];
      for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.emissive.setRGB(1.0, 0.62, 0.16); m.emissiveIntensity = n(k); }
    },
    'strike.arc': (x, floorY, z, yaw) => {
      const arc = d.arc;
      arc.mesh.visible = true;
      arc.mesh.position.set(n(x) - DUNGEON.x, n(floorY) - DUNGEON.y + 0.04, n(z) - DUNGEON.z);
      arc.mesh.rotation.y = n(yaw) - Math.PI / 2;
      arc.mesh.scale.setScalar(KING_TUNING.reach * 1.15);
    },
    'strike.arc.off': () => { d.arc.mesh.visible = false; },
    'hazard.ring': (i, cx, cz, r) => {
      const vis = d.rings[n(i)];
      if (!vis) return;
      vis.mesh.visible = true;
      vis.mesh.position.set(n(cx) - DUNGEON.x, 0.06, n(cz) - DUNGEON.z);
      vis.mesh.scale.setScalar(n(r));
      vis.mat.uniforms.uAlpha.value = 1.4 * (1 - THREE.MathUtils.smoothstep(n(r), KING_TUNING.ringMax * 0.7, KING_TUNING.ringMax));
    },
    'hazard.ring.off': (i) => { const vis = d.rings[n(i)]; if (vis) vis.mesh.visible = false; },
    'hazard.ring.tell': (x, floorS, z, charge) => {
      const ring = d.rings[1];
      if (!ring) return;
      ring.mesh.visible = true;
      ring.mesh.position.set(n(x) - DUNGEON.x, n(floorS) - DUNGEON.y + 0.05, n(z) - DUNGEON.z);
      ring.mesh.scale.setScalar(2.4 - 1.6 * n(charge));
      ring.mat.uniforms.uAlpha.value = 0.4 + 0.6 * n(charge);
    },
    'hazard.pour.off': (i) => { const vis = d.streams[n(i)]; if (vis) { vis.mesh.visible = false; vis.tell.visible = false; } },
    'hazard.pour.tell': (i, t) => {
      const vis = d.streams[n(i)];
      if (!vis) return;
      vis.tell.visible = true; vis.tellMat.uniforms.uAlpha.value = Math.min(1, n(t) * 2) * 0.9;
      vis.tell.position.y = d.sandAt(vis.x, vis.z) + 0.05;
    },
    'hazard.pour.fall': (i, k) => {
      const vis = d.streams[n(i)];
      if (!vis) return;
      vis.tell.visible = false;
      vis.mesh.visible = true;
      vis.mat.uniforms.uAlpha.value = n(k);
    },
    'hazard.sweep': (cx, cz, angle, dir, k) => {
      const b = d.beam, R = KING_TUNING.beamRadius, a = n(angle);
      const top = _w.set(COFFIN.x + 0.3, 6.2, COFFIN.z + 0.1);
      _v.set(n(cx), 0, n(cz));
      const len = _v.distanceTo(top);
      b.mesh.visible = true;
      b.mesh.position.copy(_v);
      b.mesh.scale.set(1, len, 1);
      b.mesh.quaternion.setFromUnitVectors(_h.set(0, 1, 0), top.sub(_v).normalize());
      b.mat.uniforms.uAlpha.value = 0.7 * n(k);
      b.line.visible = true;
      b.line.rotation.y = n(dir) > 0 ? a - Math.PI / 2 : a - Math.PI / 2 - Math.PI * 0.6;
      b.line.scale.set(R / 6, 1, R * 0.85 / 6);
      b.line.position.set(0, 0.05, -0.5);
      b.lineMat.uniforms.uAlpha.value = 0.55 * n(k);
    },
    'hazard.sweep.off': () => { d.beam.mesh.visible = false; d.beam.line.visible = false; },
    'victory.heap': (on, x, z) => {
      if (on !== 1) { d.showHeap(false); return; }
      d.showHeap(true, n(x) - DUNGEON.x, n(z) - DUNGEON.z);
    },
  };
}
