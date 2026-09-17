import * as THREE from 'three';
import { heightAt } from '../world/Heightfield';

/**
 * Scripted camera fly-through used to record the progress video headlessly:
 * `?tour=1` puts the camera under Tour control; `window.__world.tour.setTime(seconds)` poses it,
 * then the capture script screenshots frame by frame (see scripts/progress-video.sh).
 */
export class Tour {
  duration = 40;
  private path: THREE.CatmullRomCurve3;
  private look: THREE.CatmullRomCurve3;
  time = 0;

  constructor(private camera: THREE.PerspectiveCamera) {
    const eye = (x: number, z: number, h = 1.7) => new THREE.Vector3(x, heightAt(x, z) + h, z);
    // south gate → up the trail → cabin 1 hollow → across to cabin 2 → ridge cabin 3 → ends looking over the planet
    this.path = new THREE.CatmullRomCurve3([
      eye(0, -240, 1.7), eye(2, -200, 1.7), eye(-6, -150, 1.8), eye(-28, -100, 1.8), eye(-24, -60, 1.9), eye(-6, -46, 1.9),
      eye(14, -30, 2.0), eye(30, 4, 2.2), eye(52, 22, 1.9), eye(70, 16, 1.8), eye(78, 60, 2.4), eye(96, 110, 2.6), eye(108, 132, 1.9),
      eye(126, 150, 2.0), eye(150, 165, 3.0), eye(160, 190, 5.0),
    ], false, 'centripetal', 0.5);
    this.look = new THREE.CatmullRomCurve3([
      eye(0, -200, 1.6), eye(-4, -150, 1.6), eye(-20, -110, 1.6), eye(-24, -60, 1.6), eye(-14, -34, 2.0), eye(-14, -34, 2.2),
      eye(40, -10, 1.6), eye(62, 30, 2.2), eye(62, 30, 2.4), eye(80, 70, 1.6), eye(110, 130, 2.0), eye(118, 142, 2.6), eye(118, 142, 2.6),
      eye(150, 170, 1.5), eye(200, 230, 30), eye(-300, 400, 200),
    ], false, 'centripetal', 0.5);
  }

  setTime(t: number) {
    this.time = t;
    const u = THREE.MathUtils.clamp(t / this.duration, 0, 1);
    const p = this.path.getPointAt(u);
    const l = this.look.getPointAt(u);
    // subtle handheld sway
    p.y += Math.sin(t * 1.3) * 0.03;
    this.camera.position.copy(p);
    this.camera.lookAt(l);
    this.camera.rotation.z += Math.sin(t * 0.7) * 0.004;
  }
}
