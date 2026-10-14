// Pine Hollow's cabin looks as data (SHARD-PLATFORM M3, look-family rows): the door's SF59 material graph (worn over its
// rough_pine_door PBR set, world/homestead.ts), the moss overlay's edits of the standard material (applied through
// @wildshard/sdk/looks/shaderEdits inside its patches) and how the homestead moves and lights (CABIN_LIFE:
// @wildshard/sdk/props/buildingLife).
import type { GraphIr } from '@wildshard/format/materialGraph';
import type { BuildingLifeLook } from '../runtime/props/buildingLife';
import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/** the look.materials id the cabin doors wear */
export const CABIN_DOOR_LOOK = 'pine-cabin-door';

/**
 * The door leaf: the rough_pine_door scan (a saturated orange-red, its `meshMap` under the set's tint) pulled toward a
 * weathered grey-brown; its normal, roughness and AO maps are borrowed from the set's material (`bindMeshMap`), the
 * graph's roughness and occlusion of 1 leaving them as they are.
 */
export const CABIN_DOOR_GRAPHS: Readonly<Record<string, GraphIr>> = {
  [CABIN_DOOR_LOOK]: { version: 1, kind: 'material', model: 'standard',
    nodes: { mm: { op: 'meshMap' }, scan: { op: 'swizzle', in: ['mm'], mask: 'xyz' }, c: { op: 'mul', in: ['scan', [0.72, 0.68, 0.62]] },
      l: { op: 'dot', in: ['c', [0.333, 0.333, 0.333]] }, grey: { op: 'mix', in: ['l', 'c', 0.45] }, colour: { op: 'mul', in: ['grey', [0.9, 0.95, 1]] } },
    stages: { surface: { colour: 'colour', roughness: 1, metalness: 0, occlusion: 1 } } },
};

/**
 * Procedural moss / lichen overlay: value-noise patches in world space, denser where the `moss` vertex attribute is high
 * (eaves, foundation base) and on faces turned away from the sun (`uMossSun`), with a soft normal bump along the patch
 * edges; `uMossStrength` and `uMossUpOnly` are uniforms, so the roof and the stone share one program.
 */
export const CABIN_MOSS_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <common>', put: `#include <common>
        attribute float moss; varying float vMoss; varying vec3 vMossPos; varying vec3 vMossN;` },
  { stage: 'vertex', find: '#include <begin_vertex>', put: `#include <begin_vertex>
        vMoss = moss; vMossPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMossN = normalize(mat3(modelMatrix) * objectNormal);` },
  { stage: 'fragment', find: '#include <common>', put: `#include <common>
        uniform vec3 uMossSun; uniform float uMossStrength, uMossUpOnly;
        varying float vMoss; varying vec3 vMossPos; varying vec3 vMossN;
        float mossHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float mossNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          return mix(mix(mossHash(i), mossHash(i + vec2(1, 0)), f.x), mix(mossHash(i + vec2(0, 1)), mossHash(i + vec2(1, 1)), f.x), f.y); }
        float mossFbm(vec2 p) { mat2 r = mat2(0.8, 0.6, -0.6, 0.8); vec2 p2 = r * p * 2.13 + 3.7; vec2 p3 = r * p2 * 2.02 + 9.1;
          return mossNoise(p) * 0.5 + mossNoise(p2) * 0.3 + mossNoise(p3) * 0.2; }
        float mossMask;` },
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
        {
          #ifdef USE_MAP
            vec2 mp = vMapUv * vec2(1.6, 3.6) + vMossPos.xz * 0.2;       // patches stretched along the planks
          #else
            vec2 mp = vMossPos.xz * 2.0 + vMossPos.y * 0.35;
          #endif
          float n = mossFbm(mp) * 0.8 + mossFbm(mat2(0.6, 0.8, -0.8, 0.6) * mp * 2.7 + 11.0) * 0.2;
          float patchy = 0.55 + 0.9 * mossNoise(mp * 0.3 + 2.0);            // large-scale variation so some stretches stay bare
          float shade = 1.0 - smoothstep(-0.3, 0.5, dot(vMossN, uMossSun));
          float density = (0.2 + 0.75 * pow(vMoss, 1.6) + 0.18 * shade) * patchy * uMossStrength * mix(1.0, smoothstep(-0.05, 0.45, vMossN.y), uMossUpOnly);
          float th = 0.8 - density * 0.5;
          mossMask = smoothstep(th, th + 0.22, n);
          float lichen = smoothstep(0.74, 0.86, mossFbm(mat2(0.6, 0.8, -0.8, 0.6) * mp * 4.0 + 17.0)) * density * 0.35;
          vec3 mossCol = mix(vec3(0.02, 0.038, 0.009), vec3(0.075, 0.115, 0.03), mossFbm(mp * 2.0 + 5.0));
          mossCol *= clamp(0.6 + 3.0 * dot(diffuseColor.rgb, vec3(0.33)), 0.6, 1.25);   // let the plank grain show through the mat
          vec3 lichenCol = vec3(0.055, 0.07, 0.04);
          diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, mossMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, lichenCol, lichen * (1.0 - mossMask));
        }` },
  { stage: 'fragment', find: '#include <roughnessmap_fragment>', put: `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.97, mossMask);` },
  { stage: 'fragment', find: '#include <normal_fragment_maps>', put: `#include <normal_fragment_maps>
        {
          // bump along the moss patch edges (same maths as three's perturbNormalArb)
          float mh = mossMask * 0.35;
          vec2 dHdxy = vec2(dFdx(mh), dFdy(mh));
          vec3 sp = -vViewPosition;
          vec3 vSigmaX = dFdx(sp), vSigmaY = dFdy(sp);
          vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1) * faceDirection;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
          normal = normalize(abs(fDet) * normal - vGrad * 6.0);
        }` },
];

/**
 * The homestead as a living place (world/homestead.ts hands it to @wildshard/sdk/props/buildingLife): a door swings in
 * 0.6 s to 1.85 rad; fires and lamps flicker by 28 % on three waves; fires read 0.7 + 0.3 × night, lamps 0.1 + 0.9 ×
 * night, the window glass 0.2 + 0.8 × night; hung lanterns sway; indoors (over a room or within 3 m of the door) the room
 * lamp (rank 2) and the hearth (rank 3) take the phone's pooled pair first.
 */
export const CABIN_LIFE: BuildingLifeLook = {
  door: { seconds: 0.6, angle: 1.85 },
  flicker: { depth: 0.28, waves: [[11, 1, 0.5], [23.7, 2.3, 0.3], [3.1, 1, 0.2]] },
  fire: [0.7, 0.3],
  lamp: [0.1, 0.9],
  glass: [0.2, 0.8],
  swing: { z: [[1.35, 1, 0.05], [2.9, 1.7, 0.015]], x: [1.1, 0.03] },
  indoor: { doorRadius: 3, ranks: [2, 3] },
};
