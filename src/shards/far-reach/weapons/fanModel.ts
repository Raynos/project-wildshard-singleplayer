import { type MeshStandardMaterial, Mesh, type Object3D, Texture } from 'three';
import { skyMappedLook } from '../world/looks';

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
/** Paint the silk with the leaf texture (loaded and owned by the plugin's scope): its meshes wear the `fan-silk` look over it
 *  (data/paintLook.ts FAN_SILK_GRAPH: the leaf toward the mockups' muted, lighter teal, E399 round 6). */
export function paintFanLeaf(parts: { readonly root: Object3D; readonly material:(id:string)=>MeshStandardMaterial }, leaf: Texture): void {
  if (!(leaf instanceof Texture)) throw new Error('Fan leaf must be its owned texture');
  const original=parts.material('silk'), silk = skyMappedLook('fan-silk', leaf);
  parts.root.traverse((part) => { if (part instanceof Mesh && part.material === original) part.material = silk; });
}

