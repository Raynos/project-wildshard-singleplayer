import * as THREE from 'three';
import { PaintKit, v3 } from './paint';
import { pole, lathe } from './smoothGeometry';

const C = {
  skin: '#c89066', skinDark: '#a8704c', hair: '#2a211c', black: '#1c1a1a', boot: '#2a1d16', trousers: '#39373e',
  coat: '#6b5a3a', gold: '#d2a646', red: '#b5302a', shirt: '#ece4d2', fur: '#8c6a47', tymaqTop: '#1f5a7a', wood: '#6e4a2c',
};
const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 12, h = 9): THREE.BufferGeometry => new THREE.SphereGeometry(r, w, h).scale(sx, sy, sz);

export function shepherdBody(): THREE.BufferGeometry {
  const b = new PaintKit(0x5e9d);
  for (const s of [-1, 1]) {
    b.add(pole(v3(s * 0.1, 0.04, 0.0), v3(s * 0.2, -0.06, 0.3), 0.075, 0.07, 8), C.trousers);                 // thighs over the saddle
    b.add(pole(v3(s * 0.2, -0.06, 0.3), v3(s * 0.25, -0.5, 0.22), 0.07, 0.065, 8), C.boot);                  // tall boots down the flanks
    b.add(sphere(0.06, 1, 0.7, 1.6).translate(s * 0.25, -0.54, 0.29), C.boot);
  }
  // the chapan: a seated torso, its skirt draped over the saddle, a red sash
  b.add(lathe([[0.001, -0.02], [0.23, -0.02], [0.22, 0.18], [0.2, 0.36], [0.22, 0.52], [0.17, 0.62], [0.08, 0.68], [0.001, 0.69]], 20),
    (p) => { const a = Math.abs(Math.atan2(p.x, p.z)); return a < 0.2 && p.y > 0.36 ? C.shirt : a < 0.42 && a >= 0.2 ? C.gold : C.coat; }, { foot: 0.85 });
  b.add(lathe([[0.2, 0.12], [0.3, -0.02], [0.34, -0.14], [0.001, -0.14]], 18).scale(1, 1, 1.25), C.coat, { foot: 0.8 });
  b.add(new THREE.TorusGeometry(0.21, 0.035, 6, 16).rotateX(Math.PI / 2).translate(0, 0.3, 0), C.red);
  // the left arm forward to the reins at the withers
  b.add(pole(v3(0.2, 0.58, 0), v3(0.14, 0.3, 0.3), 0.06, 0.05, 8), C.coat);
  b.add(sphere(0.047).translate(0.12, 0.28, 0.33), C.skin);
  // the head: face, nose, eyes, ears, a moustache and a fur tymaq with ear flaps
  const hy = 0.7;
  b.add(sphere(0.11, 0.92, 1.05, 0.98).translate(0, hy + 0.1, 0.01), C.skin, { brush: 0.05 });
  b.add(sphere(0.022, 0.8, 1, 1.1, 8, 6).translate(0, hy + 0.09, 0.115), C.skinDark);
  for (const s of [-1, 1]) {
    b.add(sphere(0.011, 1, 1, 0.6, 6, 5).translate(s * 0.04, hy + 0.12, 0.105), C.black, { jitter: 0 });
    b.add(sphere(0.055, 0.5, 1.2, 1).translate(s * 0.125, hy + 0.08, -0.01), C.fur, { brush: 0.15 });      // ear flaps
  }
  b.add(pole(v3(-0.06, hy + 0.07, 0.108), v3(0.06, hy + 0.07, 0.108), 0.012, 0.012, 5), C.hair);
  b.add(sphere(0.13, 1, 0.75, 1, 12, 8).translate(0, hy + 0.2, -0.005), C.tymaqTop);
  b.add(new THREE.TorusGeometry(0.12, 0.045, 6, 14).rotateX(Math.PI / 2).translate(0, hy + 0.17, 0), C.fur, { brush: 0.15 });
  b.add(sphere(0.07, 1, 0.8, 0.5).translate(0, hy + 0.09, -0.12), C.fur, { brush: 0.15 });
  return b.finish({ ao: false });
}

/** the whip arm, from the right shoulder (its origin) hanging down-forward, the qamshy in the fist */
export function shepherdArm(): THREE.BufferGeometry {
  const a = new PaintKit(0x5e9e);
  const hand = v3(0, -0.36, 0.14);
  a.add(pole(v3(0, 0.02, 0), hand, 0.06, 0.05, 8), C.coat);
  a.add(sphere(0.047).translate(hand.x, hand.y - 0.03, hand.z), C.skin);
  const grip = v3(hand.x, hand.y - 0.03, hand.z), tip = v3(hand.x - 0.03, hand.y + 0.05, hand.z + 0.42);
  a.add(pole(grip, tip, 0.014, 0.01, 5), C.wood);
  a.add(pole(tip, v3(tip.x - 0.05, tip.y - 0.45, tip.z + 0.12), 0.006, 0.004, 4), C.boot);                    // the lash
  return a.finish({ ao: false });
}
