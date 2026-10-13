
type V3 = readonly [number, number, number];

export type CordRgb = readonly [number, number, number];
/** A cord's braid: its tube's segments and sides, the two strands' colours, and the pale popper at the tip. */
export interface CordStyle {
  readonly segments: number; readonly radial: number;
  readonly strandA: CordRgb; readonly strandB: CordRgb; readonly popper: CordRgb; readonly popperRings: number;
  /** The thrown cord's matte braid (`roughness`) and its warm self-light (`emissive`, hex). */
  readonly roughness: number; readonly emissive: number;
}
/** The plait tile (u along the cord, v round it): `size` texels a side, `columns` strands round, `rows` strands along. */
export interface PlaitStyle {
  readonly size: number; readonly columns: number; readonly rows: number;
  /** sRGB bytes: the creases' near-black and what the crown adds over them. */
  readonly crease: CordRgb; readonly crown: CordRgb;
  /** The normal map's relief, and the roughness from the creases (`rough[0]`) down by `rough[1]` on the crowns. */
  readonly relief: number; readonly rough: readonly [number, number];
}
/** A held coil: from the handle's top (`from`, at the ellipse angle `start`) round `turns` turns of an ellipse turned by `face`, each turn stepped by `step`, then the fall through `tail`. */
export interface CoilPath {
  readonly cord: number; readonly from: readonly [number, number, number]; readonly start: number; readonly rx: number; readonly ry: number; readonly face: number;
  readonly turns: number; readonly step: readonly [number, number, number]; readonly tail: readonly (readonly [number, number, number])[];
}

/** A code coil: `turns` loops of radius `loopR` shrinking by `shrink` along it, its cord's radius, and its pose. */
export interface LashCodeCoil { readonly turns: number; readonly loopR: number; readonly cord: number; readonly pos: V3; readonly rot: V3 }

/** The held lash as rows. */
export interface LashHoldRow {
  /** the tubes' sides */
  readonly radial: number;
  /** the leathers' warm self-light (hex) */
  readonly leathers: { readonly emissive: number };
  /** the braid: the popper, and the braided materials' roughness */
  readonly braid: { readonly popper: CordRgb; readonly roughness: number };
  /** the plain wrap material's colour (hex) and roughness */
  readonly wrap: { readonly colour: number; readonly roughness: number };
  /**
   * The generated glove's fit (the bake's `tip`, `generators/lash.ts`): its handle runs along +X from the butt; the
   * handle's axis is the mean of the vertices between `collar[0]` and `collar[1]` short of the far end, the fist `fist`
   * of the way along; stood on +Y, turned by `turn` about it and scaled; the lash leaves `keeper` short of the far end.
   */
  readonly glove: { readonly collar: readonly [number, number]; readonly fist: number; readonly turn: number; readonly scale: number; readonly keeper: number };
  /** the generated glove's pose: the grip's turn and the rest coil */
  readonly made: { readonly grip: V3; readonly coil: LashCodeCoil };
  /** the rest coil's path: points round the loops, the loops' horizontal squash, their start, their drift per unit along, then the fall's points */
  readonly coil: { readonly points: number; readonly tubular: number; readonly shrink: number; readonly squash: number; readonly origin: V3; readonly drift: readonly [number, number]; readonly fall: readonly V3[]; readonly a: CordRgb; readonly b: CordRgb; readonly roughness: number };
  /** user data set on both coils' materials (e.g. a flag a shard's light pass reads) */
  readonly coilUserData: Readonly<Record<string, boolean>>;
  /** the hero glove's pose in the hold's frame */
  readonly hd: { readonly pos: V3; readonly rot: V3 };
  /** the hero coil's path in the hero glove's own frame, and its plait */
  readonly loop: CoilPath;
  readonly plait: PlaitStyle;
  /** the thrown cord */
  readonly lash: CordStyle;
}

/** The lash weapon's view as rows (metres, seconds, radians). */
export interface LashView {
  /** the model's place in the view: with the hero hand, and with the code hand */
  readonly hold: { readonly hero: readonly [number, number, number]; readonly code: readonly [number, number, number] };
  /** the view spring (`blocks.viewmodel`) */
  readonly spring: { readonly gain: number; readonly clampYaw: number; readonly clampPitch: number; readonly k: number; readonly c: number };
  /**
   * The flick: the grip rises `lift` and pushes `push` as the cord unrolls and settles back as it falls slack; the slack
   * cord's far end drops `drop` and comes back `back` per unit slack; the far end sits `reach - lead` out; the cord's
   * extension loosens by `loosen` × slack; its sag is `sag[0]` + `sag[1]` × slack, `tautSag` when caught.
   */
  readonly flick: { readonly lift: number; readonly push: number; readonly drop: number; readonly back: number; readonly lead: number; readonly loosen: number; readonly sag: readonly [number, number]; readonly tautSag: number; readonly overlap: number };
  /** The wrap round a caught lever: coil radius, height, turns, cord, how long it holds; the helix's samples, tube segments and sides. */
  readonly wrap: { readonly r: number; readonly h: number; readonly turns: number; readonly cord: number; readonly hold: number; readonly samples: number; readonly segments: number; readonly sides: number };
}

/**
 * The bullwhip's look as rows (E374 polish; council rounds 1-25) on the lash item's view (`@wildshard/game/systems/items/lashView`):
 * the braids' warm saddle-leather browns, the thrown lash, the held coil's plait tile and its path in the hero glove's frame.
 */

/** The handle's braid: two strands; the popper is pale cord. */
export const STRAND_A = [0.46, 0.25, 0.12] as const, STRAND_B = [0.27, 0.14, 0.065] as const, POPPER = [0.78, 0.68, 0.52] as const;
/** The thrown lash is the handle's dark braid (loop 3: its first metre read as a pale cone against the dusk sun). */
export const LASH_A = [0.24, 0.12, 0.055] as const, LASH_B = [0.13, 0.065, 0.03] as const;
/** The code coil's plait (loop 4: a shade lighter than the glove; mockup D: a dark plait with warm highlights), linear. */
export const COIL_A = [0.12, 0.055, 0.022] as const, COIL_B = [0.045, 0.02, 0.009] as const;
/** A low warm self-light: the dusk sun sits behind the player most of the time, and a backlit viewmodel reads as a black lump. */
export const GLOW = 0x120804;
/** The tubes' sides, and the thrown lash's segments. */
export const RADIAL = 6, SEGMENTS = 30;

/** The thrown lash: matte (a glossy lash catches the low sun along its whole near length), its last two rings the popper. */
export const LASH_CORD = { segments: SEGMENTS, radial: RADIAL, strandA: LASH_A, strandB: LASH_B, popper: POPPER, popperRings: 2, roughness: 0.85, emissive: GLOW } as const;

/**
 * The held coil's plait tile (round 8, council rounds 1-7: the model-space plait read as a checker tape): four strand
 * columns round the cord (two face the eye, one chevron spine between them), near-black creases under a dark brown strand
 * and a warmer worn crown (round 10, R9B-4: a lighter copper-brown crown for the light to catch), a sheen on each crown
 * only (round 9: strand p99 56 against the mockup's ~140).
 */
export const PLAIT = { size: 128, columns: 4, rows: 4, crease: [12, 8, 7], crown: [98, 58, 38], relief: 4, rough: [0.92, 0.68] } as const;

/**
 * The held coil in the hero glove's own frame (it spans ~2 units, ~0.13 m a unit; the handle's top at (-0.613, 0.922,
 * -0.537)). Round 15: a closed upright ellipse, its turns lying close, the fall dropping behind the hand; round 17: the
 * cord leaves the handle's top straight into it; rounds 21-25 (every mockup holds a coil hanging LOW in the lower-right
 * corner; A / B / C two separate loops ~0.5 wide): two turns, the second stepped up and to the left of the first, a
 * thicker cord, x ~0.33-0.80.
 */
export const LOOP = { cord: 0.075, from: [-0.613, 0.922, -0.537], start: 1.8, rx: 0.8, ry: 0.85, face: 0.4, turns: 2, step: [-0.35, 0.2, 0.06], tail: [[-0.45, -0.4, -1.0], [-0.15, -1.8, -1.1]] } as const;

/**
 * The held whip's motion on the lash weapon (`@wildshard/sdk/items/lashWeapon`): mockup D's hold (the fist whole at the
 * right above the DODGE / JUMP discs, the coil beside it, the centre clear; loop 3 tune G: half a metre out so the
 * generated glove reads a hand's size; round 1: lower), a soft view spring, the hand's snap forward on each lash, the
 * slack lash's fall, and the pull's wrap round a caught lever (after the check pass: the board showed no lash round the crank).
 */
export const WHIP_VIEW: LashView = {
  hold: { hero: [0.1, -0.095, -0.5], code: [0.08, -0.17, -0.38] },
  spring: { gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 46, c: 11 },
  flick: { lift: 0.03, push: -0.04, drop: 1.5, back: 2, lead: 0.42, loosen: 0.35, sag: [0.25, 0.4], tautSag: 0.05, overlap: 0.08 },
  wrap: { r: 0.06, h: 0.24, turns: 4, cord: 0.018, hold: 0.9, samples: 40, segments: 80, sides: 5 },
};

/**
 * The held whip (E374 polish, after Jake's "the custom whip we built was a lot better") on the lash item's held view
 * (`@wildshard/sdk/items/lashHold`): the first build's warm brown code fist and hand-sized loop, the rebuild's braided
 * coil; the generated gloved fist on the braided handle (loop 2, P3: `art/sunscar-dunes/round-11-loop-2/ref-glove.jpg` →
 * Hunyuan3D-2, painted facets) replacing the code fist when its file loads, and the textured hero glove-and-coiled-whip
 * (loop 6, mockup D) replacing both, its coil the plaited LOOP.
 *
 * - glove: its file lies with the handle along +X from the butt, the knuckles toward +Z and the cuff up; stood on the
 *   grip's +Y (the fist at the origin), scaled to a hand's size and turned so the cuff runs back down toward the
 *   lower-right corner and the fingers wrap away. Round 1 (R1A-2 / R1C-4): the flat facets read as a decimated scan, so
 *   its normals are averaged; check pass: fully averaged colours were a clay mitt, half keeps the seams, knuckles and
 *   braid. Loop 4 / 5 (mockup D): dark worn brown leather, a touch of warm self-light, the rim picks out its edges.
 * - code / made: round 1 (R1C-4) the handle tilts forward and toward the crosshair; loop 5 (mockup D) it runs down and
 *   back into the palm, the fist holding two big braided loops up beside it, the fall hanging below; with the code fist
 *   a small loop and a half hanging toward the bottom-right edge.
 * - coil: loop 3, the lash's own dark braid a shade lighter (the handle's pale strands read cream in the sun).
 * - hd: rounds 9-21 (the council and the lead: every mockup holds a coil hanging LOW in the lower-right corner, the
 *   handle inside the fist), glove-hd4 (`art/sunscar-dunes/round-27-glove`) lower and pitched forward; council round 2
 *   (R2B-3c): the coil ~0.1 of the frame lower, laid diagonally.
 */
export const WHIP_HOLD: LashHoldRow = {
  radial: RADIAL,
  leathers: { emissive: GLOW },
  braid: { popper: POPPER, roughness: 0.55 },
  wrap: { colour: 0x7a4a26, roughness: 0.85 },
  glove: { collar: [0.16, 0.1], fist: 0.48, turn: -2.06, scale: 0.55, keeper: 0.06 },
  made: { grip: [-0.9, 0, -0.55], coil: { turns: 2.2, loopR: 0.05, cord: 0.006, pos: [0.01, -0.02, -0.01], rot: [0.05, 0.35, 0.12] } },
  coil: { points: 80, tubular: 140, shrink: 0.12, squash: 0.85, origin: [-0.005, -0.01, -0.02], drift: [0.03, 0.03],
    fall: [[-0.02, -0.06, -0.04], [0.0, -0.2, -0.05], [0.02, -0.36, -0.06]], a: COIL_A, b: COIL_B, roughness: 0.75 },
  coilUserData: { sunscarNoRim: true },
  hd: { pos: [0.02, -0.19, 0], rot: [-0.5, 0.5, 0.2] },
  loop: LOOP, plait: PLAIT, lash: LASH_CORD,
};

/** The hero glove's span in the hold's frame (metres; the model library fits it by its span). */
export const HD_GLOVE_SIZE = 0.14;

/**
 * Where the lash leaves the hand in the hold's frame (the bake's `tip`): `lashTip(WHIP_HOLD, glove)` (generators/lash.ts)
 * over the generated glove (`whip-glove.glb`) as the client's model library takes it in, frozen as a row so the world bake
 * reads no public/ model (G320). test/shards/sunscar-dunes/whip-view.test.ts recomputes it from the GLB.
 */
export const LASH_TIP: V3 = [-0.04935241128166193, -0.05003700856880042, 0.06305454752961058];

/** Exact private held hierarchy and undecorated material rows; no placement executes at runtime. */
export const WHIP_SCENE = { version: 1, root: 'root', nodes: [
    {kind:'group',id:'root',children:['grip','coil','cord','glove']}, {kind:'group',id:'grip'},
    {kind:'mesh',id:'coil',geometry:'coil',material:'coil',missing:'group',position:WHIP_HOLD.made.coil.pos,rotation:WHIP_HOLD.made.coil.rot,visibleWhen:{object:'hero',present:false}},
    {kind:'mesh',id:'cord',geometry:'cord',material:'cord',missing:'empty',visible:false},
    {kind:'object',id:'glove',source:'hero',missing:'omit',position:WHIP_HOLD.hd.pos,rotation:WHIP_HOLD.hd.rot},
    {kind:'anchor',id:'turn',source:'glove',path:[0,0],missing:'omit',children:['loop']},
    {kind:'mesh',id:'loop',geometry:'loop',material:'plait',missing:'omit',whenTexture:{texture:'plait.map',present:true}},
  ], materials:[
    {kind:'standard',id:'coil',properties:{vertexColors:true,roughness:WHIP_HOLD.coil.roughness,metalness:0,emissive:WHIP_HOLD.leathers.emissive},userData:WHIP_HOLD.coilUserData},
    {kind:'standard',id:'cord',properties:{vertexColors:true,roughness:WHIP_HOLD.lash.roughness,metalness:0,emissive:WHIP_HOLD.lash.emissive}},
    {kind:'standard',id:'plait',properties:{roughness:1,metalness:0,fog:false},maps:{map:'plait.map',normalMap:'plait.normal',roughnessMap:'plait.roughness'},userData:WHIP_HOLD.coilUserData,decorate:'plait'},
  ], textures:[
    {kind:'rgba',id:'plait.map',source:'plait',width:128,height:128,offset:0,bytes:196608,colorSpace:'srgb',repeat:{port:'plait.repeat'},wrapS:1000,wrapT:1000,magFilter:1006,minFilter:1008,mipmaps:true,anisotropy:4},
    {kind:'rgba',id:'plait.normal',source:'plait',width:128,height:128,offset:65536,bytes:196608,colorSpace:'',repeat:{port:'plait.repeat'},wrapS:1000,wrapT:1000,magFilter:1006,minFilter:1008,mipmaps:true,anisotropy:4},
    {kind:'rgba',id:'plait.roughness',source:'plait',width:128,height:128,offset:131072,bytes:196608,colorSpace:'',repeat:{port:'plait.repeat'},wrapS:1000,wrapT:1000,magFilter:1006,minFilter:1008,mipmaps:true,anisotropy:4},
  ]} as const;

/** Exact caught-wrap mesh and plain braid material; geometry is still the original committed helix. */
export const WHIP_WRAP_SCENE = {version:1,root:'wrap',nodes:[{kind:'mesh',id:'wrap',geometry:'wrap',material:'braid',missing:'empty'}],
  materials:[{kind:'standard',id:'braid',properties:{color:WHIP_HOLD.wrap.colour,roughness:WHIP_HOLD.wrap.roughness,metalness:0,emissive:WHIP_HOLD.leathers.emissive}}]} as const;
