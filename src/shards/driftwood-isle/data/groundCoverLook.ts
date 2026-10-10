// SHARD-PLATFORM M3 (look-family rows): Driftwood's streamed ground cover as data (world/GroundCover.ts builds it through
// @wildshard/sdk/looks/streamedCover): its cells, reaches, caps, upload budget, slope reach, material, patch and the GLSL
// edits of its plants' program (`@{reachUp}` / `@{slopeLo}` / `@{slopeHi}` splice the slope reach the SDK formats to three
// decimals, `@{coverSeen}` the terrain tint's GLSL, data/coverGlsl.ts). The kinds' densities and tints stay code.
import type { StreamedCoverRow } from '@wildshard/sdk/looks/streamedCover';

/**
 * The cover's numbers. 16 m cells of 520 candidates, refilled every 4 m; the desktop reaches 1.25× further (E117) with
 * 3× the instance caps (the phone 1.8×); a plant grows over a quarter of its (far − near). The far set rebuilds every 8 m
 * with 16 m of slack within 1.5 ms (desktop 2 ms) a frame and grows in over 0.8 s where it lands somewhere new. E186: the
 * whole cover uploads at most 256 KB a frame and the near set starts 1 m early. E156 C: plants on sloping ground (slope
 * 0.01 ≈ 8° … 0.08 ≈ 23°) keep their reach × up to 1.7, fading out 5 … 14 m over the ground (Explore's height).
 *
 * The kinds (E43 the beach, E117 the far models of 3–8 triangles: the near model's silhouette from 25 m on, its flowers
 * as flat chips; for tufts only 60 % of them get one): tufts, ferns, hibiscus, daisies and pebbles on the grass, shells and
 * starfish on the sand, bushes along the sand → grass edge.
 */
export const GROUND_COVER: StreamedCoverRow = {
  cell: 16,
  refill: 4,
  candidates: 520,
  cacheMin: 96,
  reachK: { phone: 1, desktop: 1.25 },
  capK: { phone: 1.8, desktop: 3 },
  growShare: 0.25,
  farRefill: 8,
  farSlack: 16,
  farBudgetMs: { phone: 1.5, desktop: 2 },
  farIn: 0.8,
  eyeSlack: 2,
  uploadBytes: 262144,
  nearLag: 1,
  sink: 0.02,
  slopeReach: { up: 1.7, lo: 0.01, hi: 0.08, fadeFrom: 5, fadeTo: 14 },
  material: { flatShading: true, roughness: 0.9, metalness: 0, doubleSided: true },
  patchId: 'driftwood.ground-cover',
  patchKey: 'ground-cover',
  meshPrefix: 'ground-cover-',
  kinds: [
    { name: 'tuft', geometry: 'tuft', cap: 5200, reach: [14, 34], scale: [0.9, 1.5], far: { geometry: 'tuftFar', reach: [26, 60], cap: 16000, keep: 0.6 } },
    { name: 'fern', geometry: 'fern', cap: 1400, reach: [14, 34], scale: [0.7, 1.4], far: { geometry: 'fernFar', reach: [26, 60], cap: 4400, keep: 1 } },
    { name: 'hibiscus', geometry: 'hibiscus', cap: 900, reach: [14, 34], scale: [0.8, 1.3], far: { geometry: 'hibiscusFar', reach: [26, 64], cap: 3200, keep: 1 } },
    { name: 'daisy', geometry: 'daisy', cap: 800, reach: [9, 22], scale: [0.8, 1.4], far: { geometry: 'daisyFar', reach: [16, 40], cap: 1600, keep: 1 } },
    { name: 'pebble', geometry: 'pebble', cap: 400, reach: [9, 22], scale: [0.7, 1.5] },
    { name: 'shells', geometry: 'shells', cap: 1600, reach: [10, 26], scale: [1.3, 2.3] },
    { name: 'starfish', geometry: 'starfish', cap: 300, reach: [8, 20], scale: [1.1, 1.8] },
    { name: 'bush', geometry: 'bush', cap: 900, reach: [16, 38], scale: [0.8, 1.6], far: { geometry: 'bushFar', reach: [30, 76], cap: 4000, keep: 1 } },
  ],
  // Each plant at its own edge by distance (E117), bent away from the player's legs, swaying in the wind. uMode 0 takes on
  // the ground's colour and is gone at its edge; 1 swaps to its far model there, same size (a tuft past uKeep has none and
  // goes like 0); 2 is that far model: from the near edge to its own far edge, where it takes on the ground's colour
  // first. Nothing scales (E156: scaling read as the plants bouncing).
  edits: [
    { stage: 'vertex', find: '#include <common>', put: `#include <common>\nuniform vec3 uPlayer; uniform float uTime; uniform float uWind; uniform vec3 uReach; uniform vec3 uFarReach; uniform float uMode; uniform float uFarIn; uniform float uReachUp; uniform float uKeep;\nattribute vec3 aGround; attribute vec4 aCover; attribute vec4 aNrm; varying vec3 vGround; varying float vFar;@{coverSeen}` },
    { stage: 'vertex', find: '#include <begin_vertex>', put: `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 io = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 away = io.xz - uPlayer.xz;
          float dl = max(length(away), 1e-3);
          // this plant's edge in [near + grow, far], from its yaw (the refill's h = yaw / 2π)
          float h = fract(atan(-instanceMatrix[0].z, instanceMatrix[0].x) / 6.2831853 + 1.0);
          vec3 toC = cameraPosition - io;
          float dc = length(toC);
          // E156 C: plants on sloping ground keep their reach further out (GroundCover.ts reachMax — the same numbers)
          float facing = abs(dot(aNrm.xyz, toC / max(dc, 1e-3)));
          float rk = 1.0 + uReachUp * @{reachUp} * smoothstep(@{slopeLo}, @{slopeHi}, 1.0 - aNrm.y);
          vec3 reach = uReach * rk, farReach = uFarReach * rk;
          float edge = mix(reach.x + reach.z, reach.y, h);
          // E156 — no plant grows, shrinks or sinks any more (Jake: "bouncing like they're being reanimated"). A near plant
          // with a far model swaps to it at its edge at full size (the far model is its own leaves, E156 kites); one
          // without takes on the ground's colour and shade and is gone at its edge, once it is the ground's; a far model
          // does the same at its far edge. vis 0 collapses the instance (wind included).
          float vis = 1.0;
          if (uMode > 1.5) {
            float fEdge = mix(farReach.x + farReach.z, farReach.y, h);
            vis = step(edge, dc) * step(dc, fEdge);
            vFar = max(smoothstep(fEdge - max(2.5 * farReach.z, 6.0), fEdge, dc), 1.0 - uFarIn);
          } else {
            vis = step(dc, edge);
            bool swaps = uMode > 0.5 && (uKeep >= 1.0 || fract(h * 97.13) < uKeep); // the refill's keep test: has a far model
            vFar = swaps ? 0.0 : smoothstep(reach.x, edge, dc);
          }
          // E156 A: the ground it fades into wears the cover, as the terrain draws it from here (coverTint.ts)
          vGround = mix(aGround, aCover.rgb, coverSeen(aCover.a, aNrm.w, facing));
          float hgt = max(position.y, 0.0);
          vec2 push = (away / dl) * (1.0 - smoothstep(0.35, 1.5, dl)) * 1.1;
          float ph = io.x * 0.31 + io.z * 0.23;
          vec2 wind = vec2(sin(uTime * 1.7 + ph) + 0.5 * sin(uTime * 3.1 + ph * 1.7), 0.6 * cos(uTime * 1.3 + ph)) * (0.05 + 0.18 * uWind);
          vec2 off = (push + wind) * hgt;
          vec3 ax = instanceMatrix[0].xyz, az = instanceMatrix[2].xyz;
          float s2 = max(dot(ax, ax), 1e-4);
          transformed.x += dot(vec3(off.x, 0.0, off.y), ax) / s2;
          transformed.z += dot(vec3(off.x, 0.0, off.y), az) / s2;
          transformed.y -= length(off) * 0.4 * hgt;
          transformed *= vis;
        }
        #else
          vFar = 0.0; vGround = vec3(0.0);
        #endif` },
    { stage: 'fragment', find: '#include <common>', put: "#include <common>\nvarying vec3 vGround; varying float vFar;" },
    { stage: 'fragment', find: '#include <color_fragment>', put: "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vGround, vFar);" },
    { stage: 'fragment', find: '#include <normal_fragment_begin>', put: "#include <normal_fragment_begin>\nnormal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), vFar));" },
  ],
};
