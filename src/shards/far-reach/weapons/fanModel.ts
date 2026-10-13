import { Group, Mesh, MeshStandardMaterial, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { FAN_SILK_EDITS } from '../data/paintLook';
import fanRows from '../data/fan.json' with { type: 'json' };
import { skyHd } from '../world/meshes';
import { fanShape } from './fanShapes';

/**
 * The war fan to mockup C (round-18-council-mockups; E399 seats: "the fan is plain and bright, thin gold ribs on flat
 * teal"): a folding fan whose cloud-silk leaf (nine pleats) covers only its outer part; below it the bare dark-lacquered
 * sticks fan out to a bronze pivot; two heavy dark guard sticks with ornate bronze end plates and studs; a wrapped grip;
 * a red silk tassel with a knot and a bead; held in the textured hero hand. The built shapes and the hand's fit are baked
 * offline (generators/fan.ts, `scripts/bake-sky-world.mjs` → `baked/fan.bin` + `data/fan.json`); here they take their materials.
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
  // the ring at the hand's handle foot and the tassel (mockup C: a red cord, a knot, a bronze bead and cap, a long silk
  // fringe), placed as the bake lays them (generators/fan.ts); the tassel hangs from the pivot boss in front of the fist
  const tassel = new Group(); tassel.position.set(0, -0.004, 0.028);
  for (const p of fanRows.tassel) { const m = new Mesh(fanShape(p.shape), p.bronze ? bronze : red); m.position.fromArray(p.at); m.scale.fromArray(p.scale); (p.fan ? fan : tassel).add(m); }
  fan.add(tassel); group.add(fan);
  // the textured hero hand round its own wrapped handle (E392/E399, row 3), fitted offline (generators/fan.ts), in its
  // model's paint; undrawn when the model did not load
  const hand = skyHd('hand-hd');
  if (hand !== null) { hand.geometry.dispose(); group.add(new Mesh(fanShape('hand'), new MeshStandardMaterial({ map: hand.map, roughness: 0.78, metalness: 0 }))); }
  return { group, fan, pendant: tassel, silk };
}

/** The viewmodel root (kept for the Model Explorer and older callers). */
export function fanModel(): Group { return fanParts().group; }
