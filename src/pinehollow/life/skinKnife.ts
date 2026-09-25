/**
 * The skinning beat's first-person knife (PINE-HOLLOW-REMASTER §5 Polish, on PH-F2's beat): a gloved right hand holding a
 * drop-point skinning knife at the lower right of the view, in the lever-action's style — a Blender model
 * (scripts/blender/weapons/skinning_knife.py → `public/assets/pine-hollow/weapons/skinning-knife[.phone].glb`, ONE mesh,
 * one baked atlas: albedo / normal / ARM) on the viewmodels' shared lit program (Crossbow.viewmodelMaterial: no program of
 * its own, lit with the scene: the sun, the CSM shadows, the fog). `?knife=proc` — or a failed load — draws a procedural
 * stand-in (a steel blade, a walnut handle, a leather fist) on the same program.
 *
 *   const knife = new SkinKnife(game, sky);   // parented to the camera, hidden; starts the GLB fetch
 *   knife.update(beatT);                      // every frame: −1 = hidden; 0 … BEAT.len = the beat's clock (lifeMath.BEAT)
 *
 * The motion follows the beat: it rises into view as the view kneels (0 → kneelIn), then two strokes — each a short
 * wind-up and a fast draw down and across the hide that lands on `BEAT.cuts[i]` (the flesh sound, the kick) — and it
 * drops out of view from `BEAT.rise`. One draw while shown (the holstered weapon's are gone then), none otherwise.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../../core/Game';
import type { Sky } from '../../world/Sky';
import { isMesh, viewmodelMaterial, whiteColors } from '../../player/Crossbow';
import { BEAT } from './lifeMath';

export const KNIFE_MODEL_URL = '/assets/pine-hollow/weapons/skinning-knife.glb';

/** the hold: camera space, the grip's centre at the lower right, the blade reaching forward and in toward the carcass */
const HOLD = new THREE.Vector3(0.11, -0.115, -0.33);
/** the blade turned well in across the view (held straight along −z the fist hides it), tipped down to the hide, the
 *  edge rolled toward it */
const HOLD_ROT = new THREE.Euler(-0.3, 0.95, -0.45, 'YXZ');
/** where it comes from / goes to: below the frame */
const LOW = new THREE.Vector3(0.2, -0.46, -0.3);

const ease = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export class SkinKnife {
  readonly group = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private readonly mat: THREE.MeshPhysicalMaterial;

  constructor(private readonly game: Game, sky: Sky, wantModel = new URLSearchParams(location.search).get('knife') !== 'proc') {
    this.mat = viewmodelMaterial(sky, 'skin-knife', { roughness: 0.55, metalness: 0.25 });
    this.group.name = 'skin-knife';
    this.group.add(this.pivot);
    // no depth clear (the weapons' viewmodels have one): the knife is 0.3 m out and the carcass a metre below the
    // kneeling eye, and a clear here washed the kneeling view in the depth-read haze (the weapons are holstered then)
    this.group.visible = false;
    game.camera.add(this.group);
    this.use(proceduralKnife(), null);
    // fetched once booted (off the load's requests and bytes); the stand-in holds until it lands
    if (wantModel) document.addEventListener('ws:ready', () => { setTimeout(() => { void this.load(); }, 600); }, { once: true });
  }

  private async load(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(KNIFE_MODEL_URL);
      const m = parseKnife(gltf.scene);
      this.use(m.geo, m.tex);
    } catch (e: unknown) { console.warn('[skin-knife] the Blender model did not load — the procedural knife stands in:', e); }
  }

  private use(geo: THREE.BufferGeometry, tex: { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture } | null): void {
    whiteColors(geo);
    const m = this.mat;
    if (tex) {
      m.map = tex.map; m.normalMap = tex.normalMap; m.aoMap = tex.arm; m.roughnessMap = tex.arm; m.metalnessMap = tex.arm;
      m.normalScale.set(1, -1); // glTF's v runs down the image (three's GLTFLoader flips the green the same way)
      m.roughness = 1; m.metalness = 1; m.envMapIntensity = 0.9;
      // upload now, not on the first harvest
      for (const t of [tex.map, tex.normalMap, tex.arm]) this.game.renderer.initTexture(t);
    } else { m.roughness = 0.55; m.metalness = 0.25; } // the stand-in: one set of factors over steel and leather alike
    const old = this.mesh;
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
    m.transparent = true; m.depthWrite = true;
    this.pivot.add(mesh);
    this.mesh = mesh;
    if (old) { old.removeFromParent(); old.geometry.dispose(); }
  }

  /** the beat's clock (−1 = none): place the hand for it */
  update(t: number): void {
    if (t < 0 || t >= BEAT.len) { this.group.visible = false; return; }
    this.group.visible = true;
    const cam = this.game.camera;
    const port = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0; // portrait: the frame is narrow — pull it in
    const up = ease(t / BEAT.kneelIn) * (1 - ease((t - BEAT.rise) / (BEAT.len - BEAT.rise)));
    const p = this.pivot.position.copy(LOW).lerp(HOLD, up);
    p.x -= port * 0.075; p.y += port * 0.04;
    const r = this.pivot.rotation; r.copy(HOLD_ROT);
    r.x += (1 - up) * 0.5;
    // the strokes: 0.12 s of wind-up (back and up, the tip lifting), 0.14 s of draw (down and across, the tip dipping
    // into the hide) ending just past the cut, then 0.12 s back to the hold
    for (let i = 0; i < BEAT.cuts.length; i++) {
      const cut = BEAT.cuts[i];
      if (cut === undefined) continue;
      const s = t - (cut - 0.16);
      if (s < 0 || s > 0.42) continue;
      const wind = ease(s / 0.12) * (1 - ease((s - 0.12) / 0.12));
      const draw = ease((s - 0.1) / 0.14) * (1 - ease((s - 0.3) / 0.12));
      // the first stroke opens the belly (down and to the left); the second pulls back toward you along the leg
      const dir = i === 0 ? { x: -0.075, y: -0.055, z: -0.02 } : { x: -0.03, y: -0.05, z: 0.06 };
      p.x += 0.03 * wind + dir.x * draw; p.y += 0.035 * wind + dir.y * draw; p.z += 0.02 * wind + dir.z * draw;
      // a wrist flick, not an arm swing: small turns (about the grip, the sleeve would sweep up into view)
      r.x += 0.1 * wind - 0.16 * draw; r.y += (i === 0 ? 0.22 : -0.14) * draw; r.z += (i === 0 ? -0.12 : 0.1) * draw;
    }
  }
}

/** the GLB's one mesh (`knife_hand`) as plain float geometry + its atlas */
function parseKnife(root: THREE.Object3D): { geo: THREE.BufferGeometry; tex: { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture } } {
  root.updateMatrixWorld(true);
  const found: THREE.Mesh[] = [];
  root.traverse((o) => { if (isMesh(o)) found.push(o); });
  const mesh = found[0];
  if (mesh === undefined) throw new Error(`[skin-knife] ${KNIFE_MODEL_URL} has no mesh`);
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) throw new Error(`[skin-knife] no ${name}`);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) { out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i); if (size > 2) out[i * size + 2] = a.getZ(i); }
    return out;
  };
  g.setAttribute('position', new THREE.BufferAttribute(copy('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(copy('normal', 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(copy('uv', 2), 2));
  const idx = src.getIndex();
  if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.array), 1));
  g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingSphere();
  const m = mesh.material;
  if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial)) throw new Error('[skin-knife] not a PBR material');
  const { map, normalMap, roughnessMap } = m;
  if (map === null || normalMap === null || roughnessMap === null) throw new Error('[skin-knife] an atlas map is missing');
  for (const t of [map, normalMap, roughnessMap]) t.anisotropy = 8;
  return { geo: g, tex: { map, normalMap, arm: roughnessMap } };
}

/** the stand-in: a steel drop-point blade, a brass guard, a walnut handle, a tan leather fist round it and a dark cuff —
 *  vertex-coloured on the filler maps (one geometry, one draw); model space as the GLB's (grip at 0, blade −z, edge −y) */
function proceduralKnife(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry => {
    const out = g.index ? g.toNonIndexed() : g;
    const c = new THREE.Color(hex), n = out.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') out.deleteAttribute(k);
    parts.push(out);
    return out;
  };
  // the blade: a drop-point outline (spine straight, the belly sweeping up to the tip), extruded thin, tapered by its bevel
  const s = new THREE.Shape();
  s.moveTo(0, 0.012); s.lineTo(0.075, 0.012); s.quadraticCurveTo(0.098, 0.009, 0.105, 0.0);
  s.quadraticCurveTo(0.085, -0.014, 0.05, -0.016); s.lineTo(0, -0.014); s.lineTo(0, 0.012);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 1, curveSegments: 8 });
  blade.translate(0, 0, -0.0015); blade.rotateY(Math.PI / 2); blade.translate(0, 0.004, -0.062);
  paint(blade, '#c9ccd0');
  const guard = new THREE.BoxGeometry(0.012, 0.036, 0.006); guard.translate(0, 0, -0.06); paint(guard, '#b08a4a');
  const handle = new THREE.CylinderGeometry(0.0125, 0.014, 0.11, 12); handle.rotateX(Math.PI / 2); handle.translate(0, 0, -0.005); paint(handle, '#5a3a24');
  // the fist: a rounded block wrapped round the handle, the thumb along its top, the wrist and a cuff back toward you
  const fist = new THREE.SphereGeometry(1, 14, 10); fist.scale(0.034, 0.038, 0.05); fist.translate(0.004, -0.006, 0.0); paint(fist, '#8a6644');
  const thumb = new THREE.CapsuleGeometry(0.009, 0.03, 4, 8); thumb.rotateX(Math.PI / 2); thumb.translate(-0.012, 0.024, -0.02); paint(thumb, '#8a6644');
  const wrist = new THREE.CylinderGeometry(0.028, 0.032, 0.07, 12); wrist.rotateX(Math.PI / 2 - 0.35); wrist.translate(0.01, -0.02, 0.07); paint(wrist, '#7d5c3d');
  const cuff = new THREE.CylinderGeometry(0.042, 0.046, 0.12, 14, 1, true); cuff.rotateX(Math.PI / 2 - 0.35); cuff.translate(0.014, -0.042, 0.15); paint(cuff, '#2b2f33');
  return mergeGeometries(parts, false);
}
