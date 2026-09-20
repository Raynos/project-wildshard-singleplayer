/**
 * Hands — the first-person viewmodel while swimming: no weapon, just the player's two forearms and hands doing a
 * looping breaststroke at the water line. The hands ALWAYS wear white gloves (a mitten shape with a thumb, over a plain
 * sleeve cuff — no finger detail by design). Styled per shard: `getActiveChunk().style ?? 'pbr'` —
 *   'pbr'     smooth-shaded MeshStandardMaterial (roughness 0.7), IBL-fixed like the crossbow
 *   'lowpoly' faceted: non-indexed geometry, flat vertex colours with a per-facet jitter, `flatShading: true`
 * Both are lit through `sky.setupMaterial()` (CSM shadows + fog). Parented to the camera with its own depth clear
 * (renderOrder 999 / 1000, like the crossbow and the hoverboard) so the arms never clip into the water or the pier.
 *
 *   const hands = new Hands(sky, camera);   // already parented: camera.add(hands.group) — adding it again is harmless
 *   hands.update(dt, player);               // every frame, after player.update(); shows itself only while player.swimming
 *   hands.visible                           // what it decided this frame (read-only in spirit)
 *
 * Animation: idle tread (the hands slowly scull side to side at the surface) when still; a breaststroke cycle
 * (reach forward together → sweep out and pull back → recover under the chin → reach) whose rate follows the swim
 * speed — one cycle per `STROKE_PERIOD` at full speed, the same clock Player uses for `onStroke`, so the sound and
 * the pull line up. Fades in / out over ~0.25 s (scale + drop) when swimming starts / stops.
 */
import * as THREE from 'three';
import type { Sky } from '../world/Sky';
import { SWIM_SPEED, STROKE_PERIOD, type Player } from './Player';
import { getActiveChunk } from '../chunks/registry';
import { fixIBL, isMesh } from './Crossbow';
import { Rng } from '../core/rng';

type Style = 'pbr' | 'lowpoly';

const GLOVE = new THREE.Color(0.92, 0.92, 0.9);
const SLEEVE = new THREE.Color(0.11, 0.14, 0.16);   // dark slate cloth
const CUFF = new THREE.Color(0.2, 0.27, 0.3);       // a lighter band at the wrist

// the stroke, as a closed loop of wrist positions in camera space for the RIGHT hand (x mirrored for the left):
// reach forward together → sweep out → pull back low → recover under the chin → reach
const STROKE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.09, -0.29, -0.80),
  new THREE.Vector3(0.36, -0.27, -0.58),
  new THREE.Vector3(0.30, -0.35, -0.42),
  new THREE.Vector3(0.11, -0.31, -0.48),
], true, 'catmullrom', 0.6);
const IDLE = new THREE.Vector3(0.27, -0.32, -0.56); // treading water: hands out to the sides at the surface
const ELBOW = new THREE.Vector3(0.30, -0.70, 0.02); // where the (off-screen) elbow hangs; the forearm points from here to the wrist

export class Hands {
  readonly group = new THREE.Group();
  visible = false;
  readonly style: Style;
  private arms: [THREE.Group, THREE.Group];
  private blend = 0; private speed = 0; private phase = 0; private t = 0;
  private tmp = { p: new THREE.Vector3(), q: new THREE.Vector3(), e: new THREE.Vector3(), d: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, -1) };

  constructor(sky: Sky, private camera: THREE.PerspectiveCamera) {
    this.style = getActiveChunk().style ?? 'pbr';
    const low = this.style === 'lowpoly';
    const rng = new Rng(0x5a1d);
    const seg = low ? 7 : 18;

    // ── materials: one per part in pbr (plain colours), one shared flat-shaded vertex-colour material in lowpoly ──
    const mk = (color: THREE.Color, rough: number) => {
      const m = low
        ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 })
        : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
      m.name = `hands-${color === GLOVE ? 'glove' : color === SLEEVE ? 'sleeve' : 'cuff'}`;
      if (!low) fixIBL(m, m.name);
      sky.setupMaterial(m);
      return m;
    };
    const gloveMat = mk(GLOVE, 0.7), sleeveMat = low ? gloveMat : mk(SLEEVE, 0.9), cuffMat = low ? gloveMat : mk(CUFF, 0.8);

    /** lowpoly: drop the index, paint every facet a jittered flat colour (a hair darker/lighter per face so the facets read) */
    const facet = (geo: THREE.BufferGeometry, color: THREE.Color, jitter: number) => {
      if (!low) return geo;
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.deleteAttribute('normal'); g.deleteAttribute('uv');
      const n = g.getAttribute('position').count, col = new Float32Array(n * 3);
      for (let f = 0; f < n; f += 3) {
        const k = 1 + (rng.next() * 2 - 1) * jitter;
        for (let i = 0; i < 3; i++) { col[(f + i) * 3] = color.r * k; col[(f + i) * 3 + 1] = color.g * k; col[(f + i) * 3 + 2] = color.b * k; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    };

    // ── one arm, wrist at the origin, hand along −z, forearm along +z ──
    const buildArm = (side: 1 | -1) => {
      const arm = new THREE.Group();
      // forearm sleeve: a tapered tube from the wrist back to the (off-screen) elbow
      const fore = new THREE.CylinderGeometry(0.044, 0.056, 0.34, seg, 1);
      fore.rotateX(Math.PI / 2); fore.translate(0, 0, 0.19);
      arm.add(new THREE.Mesh(facet(fore, SLEEVE, 0.12), sleeveMat));
      // cuff band at the wrist
      const cuff = new THREE.CylinderGeometry(0.05, 0.05, 0.04, seg, 1);
      cuff.rotateX(Math.PI / 2); cuff.translate(0, 0, 0.012);
      arm.add(new THREE.Mesh(facet(cuff, CUFF, 0.1), cuffMat));
      // the glove: a mitten — a flat, rounded paddle from the cuff forward (fingers dipping a touch), a thumb angled
      // out along the inside edge. The ellipsoid's tail sits inside the cuff so the glove reads as pulled over the sleeve.
      const mitt = new THREE.SphereGeometry(1, seg + 1, Math.max(4, Math.round(seg * 0.6)));
      mitt.scale(0.05, 0.02, 0.1); mitt.rotateX(0.12); mitt.translate(0, -0.006, -0.088);
      arm.add(new THREE.Mesh(facet(mitt, GLOVE, 0.05), gloveMat));
      const thumb = new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * 0.5)));
      thumb.scale(0.014, 0.014, 0.042); thumb.rotateY(-side * 0.75); thumb.translate(-side * 0.052, -0.002, -0.058);
      arm.add(new THREE.Mesh(facet(thumb, GLOVE, 0.05), gloveMat));
      return arm;
    };
    this.arms = [buildArm(1), buildArm(-1)];
    this.group.add(...this.arms);

    // depth clear so the arms never clip into the water / pier; the viewmodel lives in the transparent queue after it
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.group.add(clearer);
    this.group.traverse((o) => {
      if (!isMesh(o) || o === clearer) return;
      o.frustumCulled = false; o.castShadow = false; o.receiveShadow = true; o.renderOrder = 1000;
      const mat = o.material as THREE.Material; mat.transparent = true; mat.depthWrite = true;
    });
    this.group.visible = false;
    camera.add(this.group);
  }

  update(dt: number, p: Player): void {
    const on = p.swimming;
    this.blend += ((on ? 1 : 0) - this.blend) * Math.min(1, dt * 14); // ~0.25 s
    if (this.blend < 0.005 && !on) { this.group.visible = this.visible = false; return; }
    this.group.visible = this.visible = true;
    this.t += dt;
    const cam = this.camera;
    const port = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0; // portrait: the frame is narrow — pull the hands in

    // stroke clock: the same pacing as Player.onStroke (one cycle per STROKE_PERIOD at full speed), smoothed so a tap of the stick doesn't jerk
    const hs = Math.hypot(p.velocity.x, p.velocity.z);
    const want = Math.min(1, hs / SWIM_SPEED);
    this.speed += (want - this.speed) * Math.min(1, dt * 4);
    this.phase = (this.phase + dt * (0.06 + this.speed / STROKE_PERIOD)) % 1; // 0.06 Hz idle drift keeps the pose alive even when parked
    const stroke = this.tmp.p; STROKE.getPointAt(this.phase, stroke);
    // idle tread: slow sculling — hands drift in a small figure-8 at the surface
    const idle = this.tmp.q.copy(IDLE);
    idle.x += Math.sin(this.t * 1.5) * 0.035; idle.z += Math.sin(this.t * 3.0) * 0.025; idle.y += Math.sin(this.t * 1.5 + 0.8) * 0.012;
    const mix = this.speed * this.speed * (3 - 2 * this.speed); // smoothstep
    const drop = (1 - this.blend) * 0.3;

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1, arm = this.arms[i];
      if (arm === undefined) continue;
      // the left hand runs a hair behind the right so the pair doesn't read as one mirrored object
      const lag = i === 1 ? 0.03 : 0;
      const s = lag ? STROKE.getPointAt((this.phase + 1 - lag) % 1, this.tmp.d) : stroke;
      // portrait (phone): the frame is narrow and the AIM / DIVE discs sit where the hands would be — pull them in
      // between the discs, push them further out and a touch up so they stay clear of the control row
      const w = this.tmp.e.set(
        (idle.x + (s.x - idle.x) * mix) * side * (1 - port * 0.55),
        idle.y + (s.y - idle.y) * mix - drop + port * 0.05,
        (idle.z + (s.z - idle.z) * mix) * (1 + port * 0.35));
      arm.position.copy(w);
      // aim the forearm from the elbow to the wrist; the hand carries on along that line, palm down
      const e = this.tmp.d.set(ELBOW.x * side, ELBOW.y, ELBOW.z);
      const dir = e.sub(w).multiplyScalar(-1).normalize(); // elbow → wrist
      arm.quaternion.setFromUnitVectors(this.tmp.fwd, dir);
      // a little wrist roll into the sweep, and the pull phase turns the palms to face back
      const roll = Math.sin(this.phase * Math.PI * 2) * 0.35 * mix;
      arm.rotateZ(-side * (0.15 + roll)); arm.rotateX(-0.25 * mix);
      arm.scale.setScalar(0.4 + 0.6 * this.blend);
    }
  }
}
