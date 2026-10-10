import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The island dressing's material edits (SHARD-PLATFORM M3: shader edit rows; world/dressing.ts applies them with
 * `editShader` in its `patchShader` callbacks). The clumps carry the meadow beyond the near field and shrink away inside it
 * (between 15 and 22 m from the camera: world/meadow.ts's blades own the foreground); the flowers grow in past 9-13 m, a
 * little larger far off; the boulders wear the islands' painted rock with cracks, lichen flecks and a moss cap at a
 * boulder's own scale.
 */

/** The grass clumps' (and the rim's lip clumps') hand-off to the near meadow. */
export const CLUMP_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <begin_vertex>', put: `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 farAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        transformed *= smoothstep(15.0, 22.0, distance(farAt.xz, cameraPosition.xz)); }
      #endif` },
];

/** The far flowers' hand-off: grown in past the near meadow's flowers, up to 2.2 × far off. */
export const FLOWER_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <begin_vertex>', put: `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 farAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float farD = distance(farAt.xz, cameraPosition.xz);
        transformed *= smoothstep(9.0, 13.0, farD) * clamp(farD / 12.0, 1.0, 2.2); }
      #endif` },
];

/** The boulders' near detail over the islands' paint (E392 foreground, E407 row 4: grey rocks with pale lichen). */
export const BOULDER_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <roughnessmap_fragment>', put: `{
      vec3 bw = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
      vec3 bn = normalize(cross(dFdx(bw), dFdy(bw)));
      vec3 bq = bw * 2.6;
      float n1 = sin(bq.x * 1.7 + bq.z * 2.9) * sin(bq.y * 3.3 - bq.x * 1.1) * 0.5 + 0.5;
      float n2 = sin(bw.x * 7.3 + bw.y * 5.1) * sin(bw.z * 6.7 - bw.y * 4.3) * 0.5 + 0.5;
      float n3 = sin(bw.x * 19.0 - bw.z * 13.0 + bw.y * 7.0) * sin(bw.z * 17.0 + bw.x * 11.0) * 0.5 + 0.5;
      float crack = 1.0 - smoothstep(0.0, 0.07, abs(sin(bw.x * 3.1 + bw.z * 2.3 + sin(bw.y * 4.0) * 1.5)));
      // grey stone from the paint's light and dark (its tint dropped: the paint's moss covers every up face), darker below
      float bl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      // (linear values: a mid grey is 0.2, not 0.5)
      vec3 rockC = vec3(0.2, 0.195, 0.185) * (0.55 + 0.9 * bl) * (0.75 + 0.4 * n2) * (0.92 + 0.16 * n1) * (1.0 - 0.5 * crack);
#ifdef FAR_ROCK_TEX
      // the painted cliff rock again, triplanar at a boulder's scale (a 1.4 m tile, not the cliffs' 8 m)
      vec3 btw = pow(abs(bn), vec3(4.0)); btw /= (btw.x + btw.y + btw.z);
      vec3 bt = texture2D(farRock, bw.zy * 0.7).rgb * btw.x + texture2D(farRock, bw.xz * 0.7).rgb * btw.y + texture2D(farRock, bw.xy * 0.7).rgb * btw.z;
      rockC = vec3(dot(bt, vec3(0.3, 0.59, 0.11))) * vec3(1.0, 0.98, 0.94) * (0.8 + 0.4 * n2) * (1.0 - 0.5 * crack);
#endif
      rockC *= 1.0 - 0.35 * smoothstep(0.0, -0.6, bn.y);
      // pale lichen flecks (round 6, seat A: 'lichened rocks'; the mockups' boulders are grey with pale lichen, little moss)
      // (E407 row 4: grey rocks with pale lichen patches standing out of the green; a dark moss cap read as more grass)
      rockC = mix(rockC, vec3(0.42, 0.4, 0.3), smoothstep(0.8, 0.93, n3 * (0.7 + 0.6 * n1)) * 0.4);
      // a moss cap on the flattest tops, its edge broken by noise
      float mossK = smoothstep(0.88, 0.99, bn.y + 0.35 * (n2 - 0.5) + 0.2 * (n1 - 0.5)) * 0.3;
      vec3 mossC = vec3(0.1, 0.12, 0.05) * (0.75 + 0.5 * n3);
      diffuseColor.rgb = mix(rockC, mossC, mossK);
    }
    #include <roughnessmap_fragment>` },
];
