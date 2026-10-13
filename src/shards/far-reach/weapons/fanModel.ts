import { type MeshStandardMaterial, type BufferGeometry, Mesh, type Object3D, Texture } from 'three';
import handScene from '../data/fanHandScene.json' with { type: 'json' };
import scene from '../data/fanScene.json' with { type: 'json' };
import { skyHd } from '../world/meshes';
import { skyMappedLook } from '../world/looks';
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
/** Paint the silk with the leaf texture (loaded and owned by the plugin's scope): its meshes wear the `fan-silk` look over it
 *  (data/paintLook.ts FAN_SILK_GRAPH: the leaf toward the mockups' muted, lighter teal, E399 round 6). */
export function paintFanLeaf(parts: { readonly group: Object3D; readonly silk: MeshStandardMaterial }, leaf: Texture): void {
  if (!(leaf instanceof Texture)) throw new Error('Fan leaf must be its owned texture');
  const silk = skyMappedLook('fan-silk', leaf);
  parts.group.traverse((part) => { if (part instanceof Mesh && part.material === parts.silk) part.material = silk; });
}

/** Original silk and hand stay owned by the shard; assembly is admitted scene data. */
export function fanSource(): {readonly row:typeof scene;readonly ports:{readonly geometry:(id:string)=>BufferGeometry};readonly hand:null|{readonly row:typeof handScene;readonly ports:{readonly geometry:()=>BufferGeometry;readonly textures:ReadonlyMap<string,Texture|null>}}} {
  const hand = skyHd('hand-hd'); hand?.geometry.dispose();
  return { row: scene, ports: { geometry: (id: string): ReturnType<typeof fanShape> => fanShape(id.startsWith('shape') ? Number(id.slice(5)) : id as Parameters<typeof fanShape>[0]) },
    hand: hand === null ? null : {row:handScene,ports:{geometry:():BufferGeometry=>fanShape('hand'),textures:new Map([['hand',hand.map]])}} };
}

