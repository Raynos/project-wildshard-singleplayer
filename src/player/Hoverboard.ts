/**
 * Hoverboard — the first-person viewmodel for the player's hover mode (Player.hover, toggled with H / the HOVER
 * touch button). A board built from primitives and parented to the camera like the crossbow viewmodel: a rounded
 * dark deck (0.9 × 0.28 m) with a cyan emissive edge strip and two glowing repulsor discs underneath. Sits under the
 * crossbow so the front third shows at the bottom of the frame; leans with lateral velocity, pitches with
 * acceleration, sinks/rises with the ride-height spring, fades in/out over 0.25 s when the mode toggles.
 *
 *   const board = new Hoverboard(camera);   // Player constructs it
 *   board.update(dt, player);               // from Player.update(), every frame
 *
 * Lit by the scene's lights (MeshStandardMaterial, emissive so it reads even unlit — the Player has no `sky` for
 * IBL). Rendered in the transparent queue at renderOrder 1000 after its own depth clear (999), like the crossbow.
 */
import * as THREE from 'three';
import type { Player } from './Player';
import { HOVER_TOP } from './Player';

const CYAN = 0x8fe3ff;
const LEN = 0.9, WID = 0.28, THICK = 0.032;

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export class Hoverboard {
  readonly model = new THREE.Group();
  private blend = 0;                // 0..1 fade
  private lean = 0; private pitch = 0; private bob = 0;
  private t = 0;
  private pulse: THREE.MeshStandardMaterial;
  private glow: THREE.MeshBasicMaterial;

  constructor(private camera: THREE.PerspectiveCamera) {
    const g = this.model;
    // deck: rounded plank, extruded in XY then laid flat (length along −z = camera forward)
    const deckShape = roundedRect(WID, LEN, 0.11);
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: THICK, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 });
    deckGeo.rotateX(-Math.PI / 2); deckGeo.translate(0, -THICK / 2, 0);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.55, metalness: 0.35 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    g.add(deck);
    // grip: a slightly lighter matte inset on the top face
    const gripGeo = new THREE.ExtrudeGeometry(roundedRect(WID - 0.06, LEN - 0.1, 0.08), { depth: 0.004, bevelEnabled: false, curveSegments: 8 });
    gripGeo.rotateX(-Math.PI / 2); gripGeo.translate(0, THICK / 2 + 0.002, 0);
    g.add(new THREE.Mesh(gripGeo, new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.95, metalness: 0.05 })));
    // edge strip: an emissive ring around the deck's top rim, proud of the deck (out 10 mm, up 8 mm) so it reads from the rider's grazing angle
    const ring = roundedRect(WID + 0.02, LEN + 0.02, 0.12);
    ring.holes.push(roundedRect(WID - 0.024, LEN - 0.024, 0.098));
    const stripGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.016, bevelEnabled: false, curveSegments: 10 });
    stripGeo.rotateX(-Math.PI / 2); stripGeo.translate(0, THICK / 2 - 0.008, 0);
    this.pulse = new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: CYAN, emissiveIntensity: 2.2, roughness: 0.4, metalness: 0 });
    g.add(new THREE.Mesh(stripGeo, this.pulse));
    // nose lamp across the front tip + a centre inlay line down the deck (same pulsing material)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.028), this.pulse); lamp.position.set(0, THICK / 2 + 0.006, -LEN / 2 + 0.075); g.add(lamp);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, LEN * 0.66), this.pulse); inlay.position.set(0, THICK / 2 + 0.006, 0.02); g.add(inlay);
    // repulsor discs underneath, front and back, plus a soft additive glow halo under each
    const discGeo = new THREE.CylinderGeometry(0.075, 0.095, 0.022, 24);
    const discMat = new THREE.MeshStandardMaterial({ color: 0x0d2a36, emissive: CYAN, emissiveIntensity: 3, roughness: 0.3, metalness: 0.2 });
    const haloGeo = new THREE.CircleGeometry(0.15, 24); haloGeo.rotateX(-Math.PI / 2);
    this.glow = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const z of [-LEN * 0.3, LEN * 0.3]) {
      const d = new THREE.Mesh(discGeo, discMat); d.position.set(0, -THICK / 2 - 0.02, z); g.add(d);
      const h = new THREE.Mesh(haloGeo, this.glow); h.position.set(0, -THICK / 2 - 0.045, z); g.add(h);
    }
    // depth clear so the deck never clips into the terrain; everything renders in the transparent queue after it
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    g.add(clearer);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || o === clearer) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1000;
      const mat = m.material as THREE.Material;
      mat.transparent = true; if (mat !== this.glow) mat.depthWrite = true;
    });
    g.visible = false;
    camera.add(g);
  }

  update(dt: number, p: Player) {
    const on = p.hover;
    this.blend += ((on ? 1 : 0) - this.blend) * Math.min(1, dt / 0.25 * 3.5); // ~0.25 s
    if (this.blend < 0.005 && !on) { this.model.visible = false; return; }
    this.model.visible = true;
    this.t += dt;
    const cam = this.camera;
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const port = portrait;

    // lean into lateral velocity (board rolls), nose up under acceleration, sink/rise with the ride-height spring (lagged)
    this.lean += (-Math.max(-1, Math.min(1, p.hoverLat / 7)) * 0.28 - this.lean) * Math.min(1, dt * 6);
    this.pitch += ((-p.hoverAccel * 0.012) - this.pitch) * Math.min(1, dt * 5);
    this.bob += ((p.hoverBob * -0.35) - this.bob) * Math.min(1, dt * 7);
    const idle = Math.sin(this.t * 1.7) * 0.004 + Math.sin(this.t * 2.9) * 0.002;
    const wobble = Math.sin(this.t * 1.3) * 0.006;

    // landscape: y −0.55, z −0.75 (front third under the crossbow). Portrait (Hor+ ~94° tall frame, control bar +
    // button row over the bottom ~23 %): lower and a touch further so the tip clears the row.
    const s = 0.25 + 0.75 * this.blend; // fade = scale + drop
    const drop = (1 - this.blend) * 0.35;
    const py = (-0.55 - port * 0.05) - drop + this.bob + idle;
    const pz = -0.75 - port * 0.12;
    this.model.position.set(-Math.max(-1, Math.min(1, p.hoverLat / 7)) * 0.05, py, pz);
    this.model.rotation.set(this.pitch + wobble * 0.5, 0, this.lean + wobble, 'YXZ');
    this.model.scale.setScalar(s * (1 - port * 0.1));

    // repulsors breathe; brighter with speed
    const sp = Math.hypot(p.velocity.x, p.velocity.z) / HOVER_TOP;
    this.pulse.emissiveIntensity = 1.8 + Math.sin(this.t * 6) * 0.25 + sp * 1.2;
    this.glow.opacity = (0.28 + Math.sin(this.t * 9) * 0.06 + sp * 0.25) * this.blend;
  }
}
