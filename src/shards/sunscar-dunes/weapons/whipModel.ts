import { CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry } from 'three';

/** Braided brown leather: the plait reads as alternating light / dark bands along the lash (vertex colours). */
const LEATHER = [0.2, 0.09, 0.04], LEATHER_LIGHT = [0.34, 0.17, 0.08];
function braid(geometry: BufferGeometry, bands: number): BufferGeometry {
  const uv = geometry.getAttribute('uv'), colors: number[] = [];
  for (let i = 0; i < uv.count; i++) {
    const s = uv.getX(i) * bands + uv.getY(i) * 0.5, c = Math.floor(s * 2) % 2 === 0 ? LEATHER : LEATHER_LIGHT;
    colors.push(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

export interface WhipParts { model: Group; coil: Mesh; lash: Group; tip: Vector3 }

/**
 * The bullwhip in camera space: a wrapped handle low in the right of the frame, the lash coiled under it at rest.
 * `lash` is a unit-length straight lash along −Z from the handle tip; the weapon scales it out to the crack.
 */
export function buildWhip(): WhipParts {
  const model = new Group(); model.name = 'sunscar.whip';
  const leather = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const dark = new MeshStandardMaterial({ color: 0x2a1408, roughness: 0.7 });
  const handle = new Mesh(new CylinderGeometry(0.018, 0.024, 0.3, 8), dark);
  handle.rotation.x = -1.1; model.add(handle);
  for (let i = 0; i < 4; i++) {
    const wrap = new Mesh(new TorusGeometry(0.024, 0.005, 5, 10), leather.clone());
    wrap.position.set(0, -0.1 + i * 0.06, 0); wrap.rotation.x = Math.PI / 2; handle.add(wrap);
  }
  const knob = new Mesh(new SphereGeometry(0.028, 8, 6), dark); knob.position.y = -0.16; handle.add(knob);
  const tip = new Vector3(0, 0.15, 0).applyEuler(handle.rotation);
  // The resting coil: a loose 1.6-turn loop hanging from the handle's tip.
  const points: Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2 * 1.6, r = 0.11 + i * 0.0012;
    points.push(new Vector3(tip.x + Math.sin(a) * r * 0.5 + 0.03, tip.y - 0.12 - Math.cos(a) * r, tip.z + 0.02 + i * 0.003));
  }
  points.unshift(tip.clone());
  const coil = new Mesh(braid(new TubeGeometry(new CatmullRomCurve3(points), 120, 0.011, 6, false), 60), leather);
  model.add(coil);
  const lash = new Group(); lash.position.copy(tip); lash.visible = false;
  const lashGeometry = braid(new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0, 0.02, -0.35), new Vector3(0, 0.01, -0.75), new Vector3(0, 0, -1)]), 48, 0.014, 5, false), 90);
  lash.add(new Mesh(lashGeometry, leather));
  model.add(lash);
  model.position.set(0.1, -0.2, -0.42); model.rotation.set(0.05, -0.25, -0.2);
  return { model, coil, lash, tip };
}
