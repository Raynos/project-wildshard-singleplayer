import { Color, type Texture, type InstancedBufferGeometry, Mesh, type ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { ShaderFamily, uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { tileFieldGeometry, tileOrigin } from '@wildshard/sdk/looks/tileField';
import { DAIS, FALLEN_BRIDGE, ISLES, KNOLL_GLSL, MILL, NOTES, SPANS, UPDRAFT, VANES, NEST, SPIRES, WINCH, WINCH_HOUSE, type Isle } from '../data/layout';
import { MEADOW, MEADOW_CARD, MEADOW_GLSL, MEADOW_PROGRAMS, SWARD } from '../data/meadowLook';
import { apothem, spireAt } from '../layout';
import { MILL_DRUM } from './mill';
import { KEEPER_STAND } from '../quest/keeper';
import { KEEPER_AT } from '../data/quests';
import { crownStones } from '../runtime/crownLayout';
import { FOG, SKY } from '../look/sun';
import { SWARD_ATLAS, swardAtlas } from './swardAtlas';

/**
 * The near meadow (loop 4): a field of tuft cards and flowers that travels with the camera, drawn by data/meadowLook.ts's
 * program on an SDK tile field (one 8 m tile of blades as a grid of instances round the camera; nothing is uploaded per
 * frame). The lattice, the card outline, the sward's paint and the GLSL are data; this module adds what only the world
 * knows: the islands, the holes round the structures, the worn paths and the rocks, and the numbers the program splices.
 */

/** Where grass never grows: discs (x, z, radius) round the structures and pieces you stand at. */
export function meadowHoles(): Vector4[] {
  const holes: [number, number, number][] = [[MILL.x, MILL.z, MILL_DRUM.r + 0.1], [WINCH.x, WINCH.z, 1.3], [NOTES.x, NOTES.z, 0.8], [KEEPER_AT.x, KEEPER_AT.z, 0.7], [KEEPER_STAND.x, KEEPER_STAND.z, 0.45], [DAIS.x, DAIS.z, DAIS.r + 0.4]];
  for (const v of VANES) holes.push([v.x, v.z, 1]);
  for (const st of crownStones()) holes.push([st.x, st.z, 0.85]);
  holes.push([NEST.x, NEST.z, NEST.r + 0.2], [WINCH_HOUSE.x, WINCH_HOUSE.z, WINCH_HOUSE.w * 0.75]);
  for (const sp of SPIRES) { const at = spireAt(sp); holes.push([at.x, at.z, sp.r + 0.2]); }
  const out = holes.map(([x, z, r]) => new Vector4(x, z, r, 0));
  // the keeper's trodden ground (E399 round 6, mockup B: he stands in low grass, his boots and his stand in view; the
  // sward between him and the spawn hid both): a disc where the grass grows short (w 1, as round the hero rocks)
  // (round 7, seat B: at 3.2 m it mowed A's foreground, 1.8-2.4 m from him: to his boots and the stand)
  out.push(new Vector4(KEEPER_AT.x, KEEPER_AT.z, 1.2, 1), new Vector4(KEEPER_STAND.x, KEEPER_STAND.z, 0.9, 1));
  return out;
}

/** The worn paths: a segment (x0, z0) → (x1, z1) from each bridge landing in toward its island's middle. */
export function meadowPaths(isles: readonly Isle[] = ISLES): Vector4[] {
  const out: Vector4[] = [];
  const ends: [number, number][] = [];
  for (const s of [...SPANS, FALLEN_BRIDGE]) { ends.push([s.x0, s.z0], [s.x1, s.z1]); }
  ends.push([UPDRAFT.x0, UPDRAFT.z0], [UPDRAFT.x1, UPDRAFT.z1]);
  for (const [x, z] of ends) {
    let best: Isle | null = null, bd = Infinity;
    for (const isle of isles) { const d = Math.hypot(x - isle.x, z - isle.z); if (d < bd) { bd = d; best = isle; } }
    if (best === null || bd > best.r + 2) continue;
    // a short worn apron in from each landing (E392: the mockups' meadow runs right up to the bridge)
    const k = Math.max(0, bd - 3.5) / Math.max(1e-3, bd);
    out.push(new Vector4(x, z, best.x + (x - best.x) * k, best.z + (z - best.z) * k));
  }
  return out;
}

function glslColor(hex: number): string { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; }

const FAMILY = new ShaderFamily({ meadowNoise: MEADOW_GLSL, knoll: KNOLL_GLSL }, MEADOW_PROGRAMS);

export interface Meadow { readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>; readonly atlas: Texture; update: (camera: Vector3, t: number) => void }

/** Build the meadow with `blades` blades per tile (a tier knob), seeded so every load grows the same field. */
/**
 * `rocks`: discs (x, z, radius) where the grass only grows short, round the foreground boulders (E399: the 0.5 m rocks
 * hid in 0.6 m grass; the mockups' rocks stand out of a lower sward round them).
 */
export function meadow(sunDir: Vector3, blades: number, isles: readonly Isle[] = ISLES, rocks: readonly (readonly [number, number, number])[] = []): Meadow {
  const atlas = swardAtlas();
  const g = tileFieldGeometry({ across: MEADOW.across, layers: MEADOW.layers, seed: MEADOW.seed, card: MEADOW_CARD }, blades);
  const isleU = isles.map((isle) => new Vector4(isle.x, isle.z, apothem(isle), isle.y));
  const holes = [...meadowHoles(), ...rocks.map(([x, z, r]) => new Vector4(x, z, r, 1))], paths = meadowPaths(isles);
  const paint = uniformsFrom({ uRootC: { rgb: SWARD.root }, uLowC: { rgb: SWARD.low }, uLawnC: { rgb: SWARD.lawn }, uBroadC: { rgb: SWARD.broad },
    uWildC: { rgb: SWARD.wild }, uTipC: { rgb: SWARD.tip }, uSunC: { rgb: SWARD.sun },
    uLight: { v4: [SWARD.light.floor, SWARD.light.gain, SWARD.light.through, SWARD.light.edge] }, uTop: SWARD.light.top });
  const uniforms = {
    uOrigin: { value: new Vector2() }, uCam: { value: new Vector3() }, uTime: { value: 0 }, uSun: { value: sunDir },
    uAtlas: { value: atlas }, uIsles: { value: isleU }, uIsleGrass: { value: isles.map((isle) => MEADOW.grass[isle.id] ?? 1) }, uIsleKeep: { value: isles.map((isle) => MEADOW.keep[isle.id] ?? 1) }, uHoles: { value: holes }, uPaths: { value: paths },
    // the paint as uniforms (constant: set once here; a capture sweep can read them back off the material)
    ...paint,
  };
  const heights = (h: readonly number[]): string => h.map((v) => v.toFixed(2)).join(', ');
  const material = FAMILY.material('meadow', {}, { uniforms, fragments: {
    tile: MEADOW.tile.toFixed(1), range: MEADOW.range.toFixed(1), near: MEADOW.near.toFixed(1),
    isles: String(isleU.length), holes: String(holes.length), paths: String(paths.length),
    share0: SWARD.share[0].toFixed(2), share1: SWARD.share[1].toFixed(2), lawn: heights(SWARD.height.lawn), broad: heights(SWARD.height.broad), wild: heights(SWARD.height.wild),
    perSpecies: SWARD_ATLAS.perSpecies.toFixed(1), variants: SWARD_ATLAS.variants.toFixed(1),
    strawBody: SWARD.straw.body.toFixed(2), strawTip: SWARD.straw.tip.toFixed(2), leaf: glslColor(SWARD.leaf),
    fogNear: FOG.near.toFixed(1), fogSpan: (FOG.far - FOG.near).toFixed(1), fogMax: FOG.max.toFixed(2), fog: glslColor(SKY.fog),
  } });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.name = 'far.meadow';
  return { mesh, atlas, update: (camera, t) => {
    uniforms.uCam.value.copy(camera); uniforms.uTime.value = t;
    tileOrigin(uniforms.uOrigin.value, camera, MEADOW.tile);
  } };
}
