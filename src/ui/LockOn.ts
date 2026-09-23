/**
 * LockOn — four cyan corner brackets around the animal the sword would lunge onto (`meleeLock.target`, written by Sword.ts
 * every frame it is held — in range and inside the lunge cone). Mockups: art/hud/round-7-sword-touch/B-lunge.jpg, C-heavy.jpg.
 * The "BOAR · 3 M" tag under the crosshair is the HUD's existing aim readout; this only draws the frame.
 *
 *   const lockOn = new LockOn(game.camera);   // mounts into #hud
 *   lockOn.update();                          // once per frame, after the camera is posed
 *
 * The frame is sized from the animal's body (dims × scale) projected at its distance, so it tightens as you close in;
 * `.lunging` brightens it while the lunge dash runs. Hidden when nothing is locked or the target is behind the camera.
 */
import * as THREE from 'three';
import { meleeLock, targetRadius } from '../player/AimTargets';
import { viewportHeight } from '../core/viewport';

const _c = new THREE.Vector3(), _e = new THREE.Vector3(), _right = new THREE.Vector3();

export class LockOn {
  private readonly el: HTMLElement;
  private shown = false; private lunging = false;
  private x = -1; private y = -1; private w = -1; private h = -1;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.el = document.createElement('div');
    this.el.className = 'ws-game-lock';
    this.el.innerHTML = '<i></i><i></i><i></i><i></i>';
    (document.getElementById('hud') ?? document.body).append(this.el);
  }

  update(): void {
    const t = meleeLock.target;
    let show = t !== null;
    if (t !== null) {
      const s = t.scale ?? 1;
      _c.copy(t.position); _c.y += (t.dims?.bodyY ?? 0.5) * s;
      _right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      _e.copy(_c).addScaledVector(_right, Math.max(targetRadius(t), (t.dims?.bodyHalfLen ?? 0) * s) * 1.3).project(this.camera); // half-length: a boar side-on fits
      _c.project(this.camera);
      if (_c.z > 1 || _c.z < -1) show = false;
      else {
        const vw = innerWidth, vh = viewportHeight();
        const x = (_c.x + 1) / 2 * vw, y = (1 - _c.y) / 2 * vh;
        const half = Math.max(22, Math.min(vw * 0.4, Math.abs(_e.x - _c.x) / 2 * vw));
        this.place(Math.round(x), Math.round(y), Math.round(half * 2), Math.round(half * 1.6));
      }
    }
    if (show !== this.shown) { this.shown = show; this.el.classList.toggle('show', show); }
    const lunging = show && meleeLock.lunging;
    if (lunging !== this.lunging) { this.lunging = lunging; this.el.classList.toggle('lunging', lunging); }
  }

  private place(x: number, y: number, w: number, h: number): void {
    if (x === this.x && y === this.y && w === this.w && h === this.h) return;
    this.x = x; this.y = y; this.w = w; this.h = h;
    const st = this.el.style;
    st.transform = `translate(${x - w / 2}px, ${y - h / 2}px)`;
    st.width = `${w}px`; st.height = `${h}px`;
  }
}
