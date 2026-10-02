import { BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { forearm } from '#engine';

/**
 * The war fan to the review brief (mockup C, loop 2): nine teal silk panels with a pale cloud band, bronze ribs, a heavier
 * guard rib each side, a riveted pivot, a short wrapped grip and a red silk tassel, about 0.55 m across open, held in a
 * gloved right hand (the engine's shared `forearm`: a fist closed round the grip and a sleeve back toward the camera).
 *
 * Local frame: the pivot at the origin, the fan opens up (+Y) in the XY plane facing +Z (the camera); the grip runs down
 * −Y into the fist.
 */
export const FAN = { panels: 9, reach: 0.31, spread: Math.PI * 0.86, grip: 0.11 } as const;

/**
 * The leaf (loop 4): each panel is a real pleat, two strips meeting at a raised crease, mapped polar onto the painted silk
 * (`public/assets/far-reach/fan/leaf.webp`: u across the open fan guard to guard, v from the pivot's inner edge out to the
 * gilt rim). The vertex colour shades the pleat's two faces apart (one toward the light, one turned away), so the folds
 * read even under the flat viewmodel light; without the texture the silk is one plain teal.
 */
export function fanPanels(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], nor: number[] = [], uv: number[] = [], from = -FAN.spread / 2, step = FAN.spread / FAN.panels, inner = 0.07;
  const rings = [inner, 0.38, 0.7, 1];
  const at = (a: number, r: number): [number, number] => [Math.sin(a) * r * FAN.reach, Math.cos(a) * r * FAN.reach];
  const vert = (a: number, r: number, z: number, shade: number): void => {
    const [x, y] = at(a, r); pos.push(x, y, z); col.push(shade, shade, shade); nor.push(0, 0, 1);
    uv.push((a - from) / FAN.spread, (r - inner) / (1 - inner));
  };
  for (let i = 0; i < FAN.panels; i++) {
    const a = from + i * step, m = a + step / 2, b = a + step;
    // the crease stands proud toward the camera; the two faces of the pleat take the light differently
    const crease = 0.008;
    for (let k = 0; k + 1 < rings.length; k++) {
      const r0 = rings[k] ?? inner, r1 = rings[k + 1] ?? 1;
      for (const [x0, x1, z0, z1, shade] of [[a, m, 0, crease, 0.82], [m, b, crease, 0, 1]] as const) {
        vert(x0, r0, z0 * r0, shade); vert(x1, r0, z1 * r0, shade); vert(x1, r1, z1 * r1, shade);
        vert(x0, r0, z0 * r0, shade); vert(x1, r1, z1 * r1, shade); vert(x0, r1, z0 * r1, shade);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

export interface FanParts { readonly group: Group; readonly fan: Group; readonly tassel: Group; readonly silk: MeshStandardMaterial }

export function fanParts(): FanParts {
  const group = new Group(), fan = new Group();
  // untextured (the Model Explorer, before the leaf loads) the silk is a plain teal; `setLeaf` paints it
  const silk = new MeshStandardMaterial({ vertexColors: true, color: 0x3f9c9a, roughness: 0.75, metalness: 0, side: 2, emissive: 0x0c2a2a });
  const bronze = new MeshStandardMaterial({ color: 0xb98a46, roughness: 0.45, metalness: 0.55, emissive: 0x2a1a08 });
  const iron = new MeshStandardMaterial({ color: 0x4a4038, roughness: 0.5, metalness: 0.5 });
  const wrap = new MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.9, metalness: 0 });
  const red = new MeshStandardMaterial({ color: 0xc0321e, roughness: 0.8, metalness: 0, emissive: 0x2a0806 });
  fan.add(new Mesh(fanPanels(), silk));
  const from = -FAN.spread / 2, step = FAN.spread / FAN.panels;
  for (let i = 0; i <= FAN.panels; i++) {
    const a = from + i * step, guard = i === 0 || i === FAN.panels, len = FAN.reach * (guard ? 1.04 : 1);
    const rib = new Mesh(new CylinderGeometry(guard ? 0.006 : 0.0035, guard ? 0.008 : 0.0045, len, 5), guard ? iron : bronze);
    rib.position.set(Math.sin(a) * len / 2, Math.cos(a) * len / 2, 0.007); rib.rotation.z = -a; fan.add(rib);
  }
  const rivet = new Mesh(new SphereGeometry(0.012, 8, 6), bronze); rivet.position.z = 0.01; fan.add(rivet);
  const grip = new Mesh(new CylinderGeometry(0.016, 0.018, FAN.grip, 8), wrap); grip.position.y = -FAN.grip / 2; fan.add(grip);
  const tassel = new Group(); tassel.position.set(0, -FAN.grip, 0); fan.add(tassel);
  const cord = new Mesh(new CylinderGeometry(0.0025, 0.0025, 0.06, 4), red); cord.position.y = -0.03; tassel.add(cord);
  const tuft = new Mesh(new ConeGeometry(0.014, 0.07, 6), red); tuft.position.y = -0.09; tassel.add(tuft);
  group.add(fan);
  // the gloved hand closes round the grip; the sleeve runs back and down toward the camera's lower right
  // (the shared fist only: its lofted sleeve is ~0.5 MB of buffers; a cream linen wrap and a leather bracer stand in)
  const dir = new Vector3(0.35, -0.55, 1).normalize();
  const fist = new Mesh(forearm(dir, 0.42, 0.017, { part: 'fist' }), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
  fist.position.y = -FAN.grip * 0.55; group.add(fist);
  const sleeve = new Group(); sleeve.position.set(dir.x * 0.07, -FAN.grip * 0.55 + dir.y * 0.07, dir.z * 0.07);
  sleeve.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir); group.add(sleeve);
  const bracer = new Mesh(new CylinderGeometry(0.036, 0.04, 0.12, 10), new MeshStandardMaterial({ color: 0x6a4630, roughness: 0.8, metalness: 0 })); bracer.position.y = 0.06; sleeve.add(bracer);
  const linen = new Mesh(new CylinderGeometry(0.046, 0.058, 0.36, 10), new MeshStandardMaterial({ color: 0xe6dcc6, roughness: 1, metalness: 0 })); linen.position.y = 0.3; sleeve.add(linen);
  return { group, fan, tassel, silk };
}

/** The viewmodel root (kept for the Model Explorer and older callers). */
export function fanModel(): Group { return fanParts().group; }
