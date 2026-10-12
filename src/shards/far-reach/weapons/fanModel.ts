import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { FAN_SILK_EDITS } from '../data/paintLook';
import { gloveHand, heroHand } from './glove';
import { fanShape } from './fanShapes';

/**
 * The war fan to mockup C (round-18-council-mockups; E399 seats: "the fan is plain and bright, thin gold ribs on flat
 * teal"): a folding fan whose cloud-silk leaf (nine pleats) covers only its outer part; below it the bare dark-lacquered
 * sticks fan out to a bronze pivot; two heavy dark guard sticks with ornate bronze end plates and studs; a wrapped grip;
 * a red silk tassel with a knot and a bead; held in the gloved hand (weapons/glove.ts). The built shapes are baked offline
 * (generators/fan.ts, `scripts/bake-sky-world.mjs` → `baked/fan.bin` + `data/fan.json`); here they take their materials.
 *
 * Local frame: the pivot at the origin, the fan opens up (+Y) in the XY plane facing +Z (the camera); the grip runs down
 * −Y into the fist.
 */
export const FAN = { panels: 9, reach: 0.31, spread: Math.PI * 0.68, grip: 0.07, leaf: 0.42 } as const;
/** The silk's grade: how much of the paint's saturation stays, the lift after it and a tint toward blue (measured against the mockups' leaf, where blue >= green). */
export const SILK = { saturation: 0.8, lift: 2.6, tint: [0.94, 1.0, 1.16] } as const;

/** The painted silk's tint (E399 seats: 'plain and bright'; the mockups' silk is a lighter sea-green with pale cloud swirls). */
export const SILK_TINT = 0xdfece6;

/** The fan's parts: the viewmodel root, the fan, the tassel (the cone fan's pendant) and the silk. */
export interface FanParts { readonly group: Group; readonly fan: Group; readonly pendant: Group; readonly silk: MeshStandardMaterial }

/** Paint the silk with the leaf texture (loaded and owned by the plugin's scope). */
export function paintFanLeaf(parts: FanParts, leaf: Texture): void { parts.silk.map = leaf; parts.silk.color.set(SILK_TINT); parts.silk.needsUpdate = true; }

export function fanParts(): FanParts {
  const group = new Group(), fan = new Group();
  // untextured (the Model Explorer, before the leaf loads) the silk is a muted teal; `setLeaf` paints it
  const silk = new MeshStandardMaterial({ vertexColors: true, color: 0x2f7c7a, roughness: 0.8, metalness: 0, side: 2, emissive: 0x041212 });
  // the painted silk toward the mockups' muted, lighter teal (E399 round 6, measured in the leaf region: mockup C's median
  // 47,91,97 and A's 55,71,77 against ours 2,48,49, its red channel at 0-2): part-way to grey, then lifted
  patchShader(silk, 'far.fan-silk', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, spliceEdits(FAN_SILK_EDITS, { saturation: SILK.saturation.toFixed(2), lift: SILK.lift.toFixed(2), tint: SILK.tint.map((v) => v.toFixed(2)).join(', ') }));
  }, { key: (prior) => `${prior}|far.fan-silk` });
  const lacquer = new MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.1, side: 2 });
  const bronze = new MeshStandardMaterial({ color: 0x7a5c32, roughness: 0.42, metalness: 0.55, emissive: 0x0a0602 });
  const wrap = new MeshStandardMaterial({ color: 0x2c1c14, roughness: 0.85, metalness: 0 });
  const red = new MeshStandardMaterial({ color: 0xa8201a, roughness: 0.75, metalness: 0, emissive: 0x1e0403 });
  fan.add(new Mesh(fanShape('panels'), silk), new Mesh(fanShape('sticks'), lacquer));
  // the guards (row 3, E407): dark lacquered wood on bronze-edged iron backings, riveted, angular bronze plates (the bake's)
  const iron = new MeshStandardMaterial({ color: 0x6a5232, roughness: 0.4, metalness: 0.75, emissive: 0x080503 });
  fan.add(new Mesh(fanShape('straps'), iron));
  const guardLacquer = new MeshStandardMaterial({ color: 0x2a2420, roughness: 0.34, metalness: 0.08 });
  fan.add(new Mesh(fanShape('guards'), guardLacquer));
  // the gilt rim along the leaf's outer edge (mockup C's lit edge)
  fan.add(new Mesh(fanShape('rim'), new MeshStandardMaterial({ color: 0xc49a52, roughness: 0.35, metalness: 0.6, emissive: 0x1a1006 })));
  // the plates, the studs, the pivot's bronze boss and its rivet
  fan.add(new Mesh(fanShape('plates'), bronze));
  const grip = new Mesh(new CylinderGeometry(0.016, 0.018, FAN.grip, 10), wrap); grip.position.y = -FAN.grip / 2; fan.add(grip);
  const ring = new Mesh(new TorusGeometry(0.009, 0.0025, 5, 12), bronze); ring.position.y = -FAN.grip - 0.006; fan.add(ring);
  // the tassel (mockup C): a red cord, a knot, a bronze bead and cap, and a long silk fringe
  const tassel = new Group(); tassel.position.set(0, -FAN.grip - 0.012, 0); fan.add(tassel);
  const cord = new Mesh(new CylinderGeometry(0.0022, 0.0022, 0.04, 4), red); cord.position.y = -0.02; tassel.add(cord);
  const knot = new Mesh(new SphereGeometry(0.009, 8, 6), red); knot.scale.set(1.2, 0.8, 0.7); knot.position.y = -0.042; tassel.add(knot);
  const loops = new Mesh(new TorusGeometry(0.008, 0.0025, 4, 10), red); loops.position.y = -0.042; loops.scale.set(1.6, 1, 1); tassel.add(loops);
  const bead = new Mesh(new SphereGeometry(0.0055, 8, 6), bronze); bead.position.y = -0.058; tassel.add(bead);
  const cap = new Mesh(new CylinderGeometry(0.0045, 0.007, 0.012, 8), bronze); cap.position.y = -0.07; tassel.add(cap);
  tassel.add(new Mesh(fanShape('strands'), red));
  group.add(fan);
  // the gloved hand closes round the grip (weapons/glove.ts: the textured hero hand when it loaded, else the code hand);
  // the forearm runs out to the frame's right edge (E399 seats: 'a long cylinder up through the GUST / JUMP / LOOK buttons')
  const hero = heroHand();
  if (hero === null) { const hand = gloveHand(); hand.position.y = -FAN.grip * 0.35; group.add(hand); }
  else {
    // the hero hand brings its own wrapped handle with bronze caps: the code grip goes, the tassel hangs from its foot
    // row 3 (mockup C): the tassel hangs from the pivot boss in front of the fist (it hung below the fist, off the frame)
    group.add(hero.group); grip.visible = false; ring.position.y = -hero.grip - 0.006; tassel.position.set(0, -0.004, 0.028);
  }
  return { group, fan, pendant: tassel, silk };
}

/** The viewmodel root (kept for the Model Explorer and older callers). */
export function fanModel(): Group { return fanParts().group; }
