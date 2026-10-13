import { KNOLL_GLSL } from '../runtime/looks/knollGlsl';
import { Color, type Texture, type InstancedBufferGeometry, Mesh, type ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { ShaderFamily, uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { tileFieldGeometry, tileOrigin } from '@wildshard/sdk/looks/tileField';
import { ISLES, type Isle } from '../data/layout';
import PLACEMENTS from '../data/placements.json' with { type: 'json' };
import { MEADOW, MEADOW_CARD, MEADOW_GLSL, MEADOW_PROGRAMS, SWARD } from '../data/meadowLook';
import { apothem } from '../layout';
import { FOG, SKY } from '../look/sun';
import { SWARD_ATLAS } from '../data/swardAtlas';
import { skySwardAtlas } from './baked';

/**
 * The near meadow (loop 4): a field of tuft cards and flowers that travels with the camera, drawn by data/meadowLook.ts's
 * program on an SDK tile field (one 8 m tile of blades as a grid of instances round the camera; nothing is uploaded per
 * frame). The lattice, the card outline, the sward's paint and the GLSL are data; this module adds what only the world
 * knows: the islands, the holes round the structures and the worn paths (both baked, generators/placements.ts), the rocks,
 * and the numbers the program splices.
 */

function glslColor(hex: number): string { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; }

const FAMILY = new ShaderFamily({ meadowNoise: MEADOW_GLSL, knoll: KNOLL_GLSL }, MEADOW_PROGRAMS);

export interface Meadow { readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>; readonly atlas: Texture; update: (camera: Vector3, t: number) => void }

/** Build the meadow with `blades` blades per tile (a tier knob), seeded so every load grows the same field. */
/**
 * `rocks`: discs (x, z, radius) where the grass only grows short, round the foreground boulders (E399: the 0.5 m rocks
 * hid in 0.6 m grass; the mockups' rocks stand out of a lower sward round them).
 */
export function meadow(sunDir: Vector3, blades: number, isles: readonly Isle[] = ISLES, rocks: readonly (readonly [number, number, number])[] = []): Meadow {
  const atlas = skySwardAtlas();
  const g = tileFieldGeometry({ across: MEADOW.across, layers: MEADOW.layers, seed: MEADOW.seed, card: MEADOW_CARD }, blades);
  const isleU = isles.map((isle) => new Vector4(isle.x, isle.z, apothem(isle), isle.y));
  // the holes round the structures and the worn paths in from the landings, placed offline (generators/placements.ts)
  const v4 = ([x = 0, y = 0, z = 0, w = 0]: readonly number[]): Vector4 => new Vector4(x, y, z, w);
  const holes = [...PLACEMENTS.meadow.holes.map(v4), ...rocks.map(([x, z, r]) => new Vector4(x, z, r, 1))], paths = PLACEMENTS.meadow.paths.map(v4);
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
