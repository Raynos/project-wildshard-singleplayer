import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { TRACER_RED, TRACER_ORDER } from './ranged';

const TRACER_WIDTH = 3;
/** muzzle flash sprite: a hot white core, orange petals, alpha in the luminance (additive) */
export function makeFlashTexture(): THREE.CanvasTexture {
  const S = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d');
  if (ctx === null) throw new Error('makeFlashTexture: no 2d canvas context');
  ctx.clearRect(0, 0, S, S);
  const c = S / 2;
  // petals
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3, len = S * (0.32 + (k % 3) * 0.08), w = S * 0.07;
    ctx.save(); ctx.translate(c, c); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255,220,150,0.9)'); g.addColorStop(0.5, 'rgba(255,150,60,0.55)'); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -w); ctx.quadraticCurveTo(len * 0.6, -w * 0.4, len, 0); ctx.quadraticCurveTo(len * 0.6, w * 0.4, 0, w); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const core = ctx.createRadialGradient(c, c, 0, c, c, S * 0.3);
  core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(0.35, 'rgba(255,230,170,0.9)'); core.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = core; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ───────────────────────────── hitscan tracer ─────────────────────────────

/** one straight red line, muzzle → impact, alive TRACER_TIME s */
export class HitLine {
  readonly line: LineSegments2; readonly mat: LineMaterial;
  private geo: LineSegmentsGeometry; private buf = new Float32Array(6);
  t0 = -1;
  constructor(scene: THREE.Scene) {
    this.geo = new LineSegmentsGeometry(); this.geo.setPositions(this.buf);
    this.mat = new LineMaterial({ linewidth: TRACER_WIDTH, transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mat.color = TRACER_RED.clone();
    this.line = new LineSegments2(this.geo, this.mat);
    this.line.frustumCulled = false; this.line.renderOrder = TRACER_ORDER; this.line.visible = false;
    scene.add(this.line);
  }
  show(a: THREE.Vector3, b: THREE.Vector3, t: number): void {
    this.buf[0] = a.x; this.buf[1] = a.y; this.buf[2] = a.z; this.buf[3] = b.x; this.buf[4] = b.y; this.buf[5] = b.z;
    this.geo.setPositions(this.buf);
    this.mat.opacity = 1; this.line.visible = true; this.t0 = t;
  }
  update(t: number, res: THREE.Vector2, life: number): void {
    if (this.t0 < 0) return;
    this.mat.resolution.copy(res);
    const a = 1 - (t - this.t0) / life;
    if (a <= 0) { this.t0 = -1; this.line.visible = false; return; }
    this.mat.opacity = a;
  }
}

