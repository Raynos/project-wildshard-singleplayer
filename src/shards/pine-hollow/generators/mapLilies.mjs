// G508: the shared pond pads, evaluated offline over native Pine data.
import * as THREE from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { Noise2D } from '@wildshard/engine/core/noise';

export function mapLilies(seed       ,pond                                          ,heightAt                            ,exclusions                                        ){
  const wl = pond.level, rng = new Rng(seed + 4411), cluster = new Noise2D(seed + 4412);
  const pads                                                                                   = [];
  for (let i = 0; i < 6000 && pads.length < 110; i++) {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * (pond.r + 8);
    const x = pond.x + Math.cos(a) * d, z = pond.z + Math.sin(a) * d, depth = wl - heightAt(x, z);
    if (depth < 0.3 || depth > 1.6) continue;
    if (cluster.fbm(x * 0.07, z * 0.07, 2) < 0.18) continue;
    if (exclusions.some((spot) => Math.hypot(x - spot.x, z - spot.z) < spot.r)) continue;
    const r = rng.range(0.12, 0.27);
    if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.03)) continue;
    pads.push({ x, z, r, rot: rng.range(0, Math.PI * 2), flower: false, hue: rng.next() });
  }
  if (pads.length === 0) return null;
  for (let i = 0; i < pads.length; i += 13) { pads[i].flower = true; }
  const pos           = [], col           = [], nrm           = [], pad           = [];
  const vert = (x        , y        , z        , c                                   , n                                   , p                          , ph        )       => {
    pos.push(x, y, z); col.push(c[0], c[1], c[2]); nrm.push(n[0], n[1], n[2]); pad.push(p.x, p.z, ph);
  };
  const up = [0, 1, 0]         ;
  for (const p of pads) {
    const y0 = wl + 0.012, ph = p.hue * 40, segs = 14, notch = 0.32;
    const aged = p.hue > 0.86;
    const inner                           = aged ? [0.16, 0.11, 0.035] : [0.035 + p.hue * 0.02, 0.075 + p.hue * 0.03, 0.02];
    const rim                           = aged ? [0.22, 0.12, 0.04] : [0.055 + p.hue * 0.03, 0.11 + p.hue * 0.04, 0.03];
    const curl = p.hue > 0.6 ? 0.012 : 0.004;
    for (let s = 0; s < segs; s++) {
      const a0 = p.rot + notch / 2 + (s / segs) * (Math.PI * 2 - notch), a1 = p.rot + notch / 2 + ((s + 1) / segs) * (Math.PI * 2 - notch);
      const stripe = s % 2 === 0 ? 1 : 0.9;
      const r0                           = [rim[0] * stripe, rim[1] * stripe, rim[2] * stripe];
      vert(p.x, y0 + 0.003, p.z, inner, up, p, ph);
      vert(p.x + Math.cos(a1) * p.r, y0 + curl, p.z + Math.sin(a1) * p.r, r0, up, p, ph);
      vert(p.x + Math.cos(a0) * p.r, y0 + curl, p.z + Math.sin(a0) * p.r, r0, up, p, ph);
    }
    if (!p.flower) continue;
    // a white water lily: two rings of eight petals cupped upward round a yellow heart
    const fx = p.x + Math.cos(p.rot + Math.PI) * p.r * 0.3, fz = p.z + Math.sin(p.rot + Math.PI) * p.r * 0.3, fy = y0 + 0.015;
    const fc = { x: p.x, z: p.z };
    for (const [ring, len, lift, off] of [[0, 0.085, 0.45, 0], [1, 0.065, 0.95, Math.PI / 8]]         ) {
      for (let k = 0; k < 8; k++) {
        const a = off + (k / 8) * Math.PI * 2, w = 0.022, ca = Math.cos(a), sa = Math.sin(a);
        const tipX = fx + ca * len * Math.cos(lift), tipZ = fz + sa * len * Math.cos(lift), tipY = fy + len * Math.sin(lift);
        const bx = -sa * w, bz = ca * w;
        const base                           = ring === 0 ? [0.78, 0.76, 0.7] : [0.9, 0.86, 0.82];
        const tip                           = [0.95, 0.82, 0.84];
        const n                           = [-ca * Math.sin(lift), Math.cos(lift), -sa * Math.sin(lift)];
        const mx = fx + ca * len * 0.5 * Math.cos(lift), mz = fz + sa * len * 0.5 * Math.cos(lift), my = fy + len * 0.5 * Math.sin(lift);
        vert(fx, fy, fz, base, n, fc, ph); vert(mx + bx, my, mz + bz, base, n, fc, ph); vert(tipX, tipY, tipZ, tip, n, fc, ph);
        vert(fx, fy, fz, base, n, fc, ph); vert(tipX, tipY, tipZ, tip, n, fc, ph); vert(mx - bx, my, mz - bz, base, n, fc, ph);
      }
    }
    const heart                           = [0.95, 0.72, 0.12];
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2, r = 0.02;
      vert(fx, fy + 0.03, fz, heart, up, fc, ph);
      vert(fx + Math.cos(a1) * r, fy + 0.012, fz + Math.sin(a1) * r, heart, up, fc, ph);
      vert(fx + Math.cos(a0) * r, fy + 0.012, fz + Math.sin(a0) * r, heart, up, fc, ph);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aPad', new THREE.Float32BufferAttribute(pad, 3));
  return geo;
}
