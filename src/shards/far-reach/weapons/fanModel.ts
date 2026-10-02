import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
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
const SILK = { deep: new Color(0x2f8a8c), light: new Color(0x58b3ad), cloud: new Color(0xd9efe6) } as const;

export function fanPanels(): BufferGeometry {
  const pos: number[] = [], col: number[] = [], nor: number[] = [], from = -FAN.spread / 2, step = FAN.spread / FAN.panels, inner = 0.07;
  const at = (a: number, r: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r];
  const tri = (pts: [number, number][], cs: Color[], z: number): void => {
    pts.forEach(([x, y], i) => { const c = cs[i] ?? SILK.deep; pos.push(x, y, z); col.push(c.r, c.g, c.b); nor.push(0, 0, 1); });
  };
  for (let i = 0; i < FAN.panels; i++) {
    const a = from + i * step, b = a + step, base = i % 2 === 0 ? SILK.deep : SILK.light;
    // three bands per panel: the inner silk, a pale cloud band, the outer silk; folds alternate a little in z
    const bands = [[inner, 0.55, base, base], [0.55, 0.72, SILK.cloud, SILK.cloud], [0.72, 1, base, base]] as const;
    const z = i % 2 === 0 ? 0.004 : -0.004;
    for (const [r0, r1, c0, c1] of bands) {
      const R0 = FAN.reach * r0, R1 = FAN.reach * r1;
      tri([at(a, R0), at(b, R0), at(b, R1)], [c0, c0, c1], z); tri([at(a, R0), at(b, R1), at(a, R1)], [c0, c1, c1], z);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

export interface FanParts { readonly group: Group; readonly fan: Group; readonly tassel: Group }

export function fanParts(): FanParts {
  const group = new Group(), fan = new Group();
  const silk = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: 2, emissive: 0x0c2a2a });
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
  const arm = new Mesh(forearm(new Vector3(0.35, -0.55, 1), 0.42, 0.017), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
  arm.position.y = -FAN.grip * 0.55; group.add(arm);
  return { group, fan, tassel };
}

/** The viewmodel root (kept for the Model Explorer and older callers). */
export function fanModel(): Group { return fanParts().group; }
