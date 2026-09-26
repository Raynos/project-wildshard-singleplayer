// The baseline phone HUD (Jake, 2026-09-25: shard 4 uses Driftwood's HUD, no custom elements), rebuilt clean-room from
// the live capture: PAUSE, VITALS, the round minimap with its bag button, the quest chip, the HOVER tab, the crosshair,
// LOCK / DODGE / JUMP, and the pad (MOVE stick, ATTACK, LOOK). The Fei Zhua rides these: LOCK targets a dragon hook
// (a cyan bracket reticle on it), JUMP with a hook locked fires the claw and zips.
import { Vector2 } from 'three';
import type { MapRect } from '../../chunks/nine-dragon-stack/world/ctx';
import './hud.css';

const SVG = {
  heart: '<svg viewBox="0 0 24 22"><path d="M12 21 3 12.2C.6 9.8.8 5.8 3.5 3.7 5.9 1.9 9.4 2.4 12 5.4c2.6-3 6.1-3.5 8.5-1.7 2.7 2.1 2.9 6.1.5 8.5z" fill="#fff"/></svg>',
  bag: '<svg viewBox="0 0 24 26" fill="none" stroke="#8fe3ff" stroke-width="2.2"><rect x="3.5" y="8" width="17" height="16" rx="4.5"/><path d="M8.5 8V5.5a3.5 3.5 0 0 1 7 0V8M7.5 16.5h9"/></svg>',
  arrow: '<svg viewBox="0 0 16 18"><path d="M8 0 15.5 17.5 8 13.2.5 17.5z" fill="#fff"/></svg>',
  hover: '<svg viewBox="0 0 30 18" fill="none" stroke="#fff" stroke-width="2"><path d="M3 11.5q12 6 24 0M3 11.5h24M7 8.5q8-6 16 0M12 5.5h6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="#b4c3cc" stroke-width="1.8"><circle cx="12" cy="12" r="6.6"/><circle cx="12" cy="12" r="1.6" fill="#b4c3cc" stroke="none"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/></svg>',
  dodge: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3"><path d="m4.5 5 7 7-7 7M12 5l7 7-7 7"/></svg>',
  jump: '<svg viewBox="0 0 24 24"><path d="M12 1.5 21.5 12H15.3v10H8.7V12H2.5z" fill="#fff"/></svg>',
  attack: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M20.5 3.5 8 16M20.5 3.5h-6M20.5 3.5v6M5.5 12.5l6 6M7.5 16.5l-4 4"/></svg>',
  look: '<svg viewBox="0 0 24 24" fill="#fff"><path d="m12 1 4 5H8zm0 22-4-5h8zM1 12l5-4v8zm22 0-5 4V8z"/></svg>',
};

export type HudButton = 'lock' | 'dodge' | 'jump' | 'attack' | 'attack-up' | 'pause' | 'hover';

export interface HudFrame {
  x: number;
  z: number;
  yaw: number;
  fps: number;
  ms: number;
  reticle: Vector2 | null;
  locked: boolean;
}

export class Hud {
  readonly root: HTMLDivElement;
  readonly move = new Vector2();
  private readonly look = new Vector2();
  private readonly map: HTMLCanvasElement;
  private readonly plan: HTMLCanvasElement;
  private readonly arrow: HTMLElement;
  private readonly reticle: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly lockBtn: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly envelopes: [number, number][] = [[-14, -60], [22, -40], [40, 6], [-20, 30], [6, -100]];
  onButton: (b: HudButton) => void = () => undefined;
  private mapT = 0;

  constructor(parent: HTMLElement, rects: readonly MapRect[]) {
    const root = document.createElement('div');
    root.className = 'nd-hud';
    root.innerHTML = `
      <div class="nd-glass nd-bag">${SVG.bag}</div>
      <div class="nd-map"><canvas></canvas><div class="nd-ring"></div>
        <i class="nd-tick" style="left:-5px;top:54px;width:7px;height:1.5px"></i><i class="nd-tick" style="right:-5px;top:54px;width:7px;height:1.5px"></i>
        <i class="nd-tick" style="left:15px;top:92px;width:1.5px;height:6px;transform:rotate(-45deg)"></i><i class="nd-tick" style="right:15px;top:92px;width:1.5px;height:6px;transform:rotate(45deg)"></i>
        <i class="nd-tick" style="left:15px;top:12px;width:1.5px;height:6px;transform:rotate(45deg)"></i><i class="nd-tick" style="right:15px;top:12px;width:1.5px;height:6px;transform:rotate(-45deg)"></i>
        <i class="nd-tick" style="left:54px;bottom:-4px;width:1.5px;height:6px"></i>
        <div class="nd-n">N</div><div class="nd-arrow">${SVG.arrow}</div></div>
      <button class="nd-glass nd-pause" data-b="pause"><i></i><i></i><span style="margin-left:6px">PAUSE</span></button>
      <div class="nd-glass nd-vitals">${SVG.heart}<b>100</b><div class="nd-bar"></div><span>VITALS</span></div>
      <div class="nd-glass nd-quest"><div class="nd-dia"></div>RED ENVELOPE 0/9<div class="nd-sep"></div><span class="nd-tgt">SHRINE 64 M</span><span class="nd-up">▲</span></div>
      <button class="nd-glass nd-hover" data-b="hover">${SVG.hover}HOVER</button>
      <div class="nd-cross"><i style="left:9.25px;top:0;width:1.5px;height:6px"></i><i style="left:9.25px;bottom:0;width:1.5px;height:6px"></i><i style="top:9.25px;left:0;width:6px;height:1.5px"></i><i style="top:9.25px;right:0;width:6px;height:1.5px"></i></div>
      <div class="nd-reticle"><i style="left:0;top:0;border-left-width:2px;border-top-width:2px"></i><i style="right:0;top:0;border-right-width:2px;border-top-width:2px"></i><i style="left:0;bottom:0;border-left-width:2px;border-bottom-width:2px"></i><i style="right:0;bottom:0;border-right-width:2px;border-bottom-width:2px"></i></div>
      <div class="nd-perf"></div>
      <button class="nd-btn nd-dim" data-b="lock">${SVG.lock}LOCK</button>
      <button class="nd-btn" data-b="dodge">${SVG.dodge}DODGE</button>
      <button class="nd-btn" data-b="jump">${SVG.jump}JUMP</button>
      <div class="nd-pad"><div class="nd-div"></div><div class="nd-move-l">MOVE</div>
        <div class="nd-stick nd-hit"><i style="left:46px;top:4px;width:1px;height:7px"></i><i style="left:46px;bottom:4px;width:1px;height:7px"></i><i style="top:46px;left:4px;width:7px;height:1px"></i><i style="top:46px;right:4px;width:7px;height:1px"></i><div class="nd-knob"></div></div>
        <button class="nd-attack" data-b="attack">${SVG.attack}<b>ATTACK</b><span>HOLD = HEAVY</span></button>
        <div class="nd-look nd-hit">${SVG.look}LOOK</div></div>`;
    parent.append(root);
    this.root = root;
    const q = (sel: string): HTMLElement => {
      const el = root.querySelector<HTMLElement>(sel);
      if (el === null) throw new Error(`hud: ${sel}`);
      return el;
    };
    const cv = q('.nd-map canvas');
    if (!(cv instanceof HTMLCanvasElement)) throw new Error('hud: minimap canvas');
    this.map = cv;
    this.arrow = q('.nd-arrow');
    this.reticle = q('.nd-reticle');
    this.perf = q('.nd-perf');
    this.lockBtn = q('[data-b="lock"]');
    this.knob = q('.nd-knob');
    this.plan = this.drawPlan(rects);
    // buttons: press feedback, attack reports its release (hold = heavy)
    root.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => {
      const name = el.dataset['b'] ?? '';
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('nd-down');
        if (isButton(name)) this.onButton(name);
      });
      const up = (): void => {
        el.classList.remove('nd-down');
        if (name === 'attack') this.onButton('attack-up');
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    // the MOVE stick
    const stick = q('.nd-stick');
    let stickId = -1;
    const stickAt = (e: PointerEvent): void => {
      const r = stick.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), max = 32;
      const k = len > max ? max / len : 1;
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.move.set((dx * k) / max, (-dy * k) / max);
    };
    stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickAt(e); e.stopPropagation(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickAt(e); });
    const stickEnd = (e: PointerEvent): void => {
      if (e.pointerId !== stickId) return;
      stickId = -1;
      this.knob.style.transform = '';
      this.move.set(0, 0);
    };
    stick.addEventListener('pointerup', stickEnd);
    stick.addEventListener('pointercancel', stickEnd);
    // the LOOK pad
    const pad = q('.nd-look');
    let lookId = -1, lx = 0, ly = 0;
    pad.addEventListener('pointerdown', (e) => { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; pad.setPointerCapture(e.pointerId); e.stopPropagation(); });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.look.x += e.clientX - lx;
      this.look.y += e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
    });
    const lookEnd = (e: PointerEvent): void => { if (e.pointerId === lookId) lookId = -1; };
    pad.addEventListener('pointerup', lookEnd);
    pad.addEventListener('pointercancel', lookEnd);
  }

  /** drag pixels from the LOOK pad since the last call */
  consumeLook(): Vector2 {
    const v = this.look.clone();
    this.look.set(0, 0);
    return v;
  }

  setVisible(on: boolean): void { this.root.classList.toggle('nd-off', !on); }
  setPerf(on: boolean): void { this.perf.classList.toggle('nd-on', on); }

  private drawPlan(rects: readonly MapRect[]): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    const S = 2;
    cv.width = 200 * S;
    cv.height = 280 * S;
    const c = cv.getContext('2d');
    if (c === null) return cv;
    c.fillStyle = '#0b1a26';
    c.fillRect(0, 0, cv.width, cv.height);
    const X = (x: number): number => (x + 90) * S, Z = (z: number): number => (z + 180) * S;
    let seed = 7;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const r of rects) {
      const x = X(r.x0), y = Z(r.z0), w = (r.x1 - r.x0) * S, h = (r.z1 - r.z0) * S;
      if (r.kind === 'block') {
        c.fillStyle = '#12304a';
        c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(120, 190, 220, 0.35)';
        c.lineWidth = 1;
        for (let i = 0; i < (w * h) / 900; i++) {
          const bw = 8 + rnd() * 26, bh = 8 + rnd() * 26;
          c.strokeRect(x + rnd() * (w - bw), y + rnd() * (h - bh), bw, bh);
        }
        c.fillStyle = 'rgba(255, 200, 110, 0.55)';
        for (let i = 0; i < (w * h) / 1400; i++) c.fillRect(x + rnd() * w, y + rnd() * h, 2, 2);
      } else if (r.kind === 'well') {
        c.fillStyle = '#03080d';
        c.fillRect(x, y, w, h);
        c.strokeStyle = '#8fe3ff';
        c.lineWidth = 2;
        c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      } else if (r.kind === 'green') {
        c.fillStyle = '#1c4a3a';
        c.beginPath();
        c.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
        c.fill();
      } else if (r.kind === 'gate') {
        c.fillStyle = '#c23b22';
        c.fillRect(x, y, w, h);
      } else {
        c.fillStyle = '#0d2233';
        c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(143, 227, 255, 0.28)';
        c.strokeRect(x, y, w, h);
      }
    }
    return cv;
  }

  private drawMap(x: number, z: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = Math.round(110 * dpr);
    if (this.map.width !== size) { this.map.width = size; this.map.height = size; }
    const c = this.map.getContext('2d');
    if (c === null) return;
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#0a1823';
    c.fillRect(0, 0, size, size);
    const k = (size / 2) / 60; // 60 m radius
    c.translate(size / 2, size / 2);
    c.scale(k / 2, k / 2);
    c.drawImage(this.plan, -(x + 90) * 2, -(z + 180) * 2);
    c.restore();
    // red envelopes nearby
    c.fillStyle = '#ff4a3a';
    for (const [ex, ez] of this.envelopes) {
      const px = size / 2 + (ex - x) * k, py = size / 2 + (ez - z) * k;
      if ((px - size / 2) ** 2 + (py - size / 2) ** 2 < (size / 2 - 4 * dpr) ** 2) {
        c.beginPath();
        c.arc(px, py, 2.6 * dpr, 0, Math.PI * 2);
        c.fill();
      }
    }
    // a soft glow under the player
    c.fillStyle = 'rgba(143, 227, 255, 0.18)';
    c.beginPath();
    c.arc(size / 2, size / 2, 14 * dpr, 0, Math.PI * 2);
    c.fill();
  }

  update(f: HudFrame, dt: number): void {
    this.mapT -= dt;
    if (this.mapT <= 0) { this.drawMap(f.x, f.z); this.mapT = 0.1; }
    this.arrow.style.transform = `rotate(${(f.yaw * 180) / Math.PI}deg)`;
    this.perf.textContent = `${Math.round(f.fps)} fps ${f.ms.toFixed(1)} ms`;
    if (f.reticle === null) this.reticle.classList.remove('nd-on');
    else {
      this.reticle.classList.add('nd-on');
      this.reticle.style.left = `${f.reticle.x}px`;
      this.reticle.style.top = `${f.reticle.y}px`;
    }
    this.lockBtn.classList.toggle('nd-lit', f.locked);
    this.lockBtn.classList.toggle('nd-dim', !f.locked);
  }
}

function isButton(s: string): s is HudButton {
  return s === 'lock' || s === 'dodge' || s === 'jump' || s === 'attack' || s === 'pause' || s === 'hover';
}
