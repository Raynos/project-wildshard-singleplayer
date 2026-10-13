import { type MeshStandardMaterial, type BufferGeometry, Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { FAN_SILK_EDITS } from '../data/paintLook';
import handScene from '../data/fanHandScene.json' with { type: 'json' };
import scene from '../data/fanScene.json' with { type: 'json' };
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


/** Paint the silk with the leaf texture (loaded and owned by the plugin's scope). */
export function paintFanLeaf(parts: {readonly silk:MeshStandardMaterial}, leaf: Texture): void { if (!(leaf instanceof Texture)) throw new Error('Fan leaf must be its owned texture'); parts.silk.map = leaf; parts.silk.color.set(SILK_TINT); parts.silk.needsUpdate = true; }

/** Original decorated silk and hand stay owned by the shard; assembly is admitted scene data. */
  // the painted silk toward the mockups' muted, lighter teal (E399 round 6, measured in the leaf region: mockup C's median
  // 47,91,97 and A's 55,71,77 against ours 2,48,49, its red channel at 0-2): part-way to grey, then lifted
function decorateFanSilk(silk: MeshStandardMaterial): void {
  patchShader(silk, 'far.fan-silk', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, spliceEdits(FAN_SILK_EDITS, { saturation: SILK.saturation.toFixed(2), lift: SILK.lift.toFixed(2), tint: SILK.tint.map((v) => v.toFixed(2)).join(', ') }));
  }, { key: (prior) => `${prior}|far.fan-silk` });
}

export function fanSource(): {readonly row:typeof scene;readonly ports:{readonly geometry:(id:string)=>BufferGeometry;readonly decorators:ReadonlyMap<string,(material:MeshStandardMaterial)=>void>};readonly hand:null|{readonly row:typeof handScene;readonly ports:{readonly geometry:()=>BufferGeometry;readonly textures:ReadonlyMap<string,Texture|null>}}} {
  const hand = skyHd('hand-hd'); hand?.geometry.dispose();
  return { row: scene, ports: { geometry: (id: string): ReturnType<typeof fanShape> => fanShape(id.startsWith('shape') ? Number(id.slice(5)) : id as Parameters<typeof fanShape>[0]),
    decorators: new Map([['silk', decorateFanSilk]]) },
    hand: hand === null ? null : {row:handScene,ports:{geometry:():BufferGeometry=>fanShape('hand'),textures:new Map([['hand',hand.map]])}} };
}

