// SHARD-PLATFORM M3 (look-family rows): world/Ocean.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what that module passes (another module's GLSL, a number from its layout).
export const OCEAN_GLSL = {
  vertexCommon: /* glsl */`#include <common>
          attribute float depth; attribute float seed;
          uniform float uTime;
          varying float vCrest; varying vec3 vOceanW; varying vec2 vRest; varying float vDamp;
          @{WAVES_GLSL}`,
  vertexBegin: /* glsl */`
          vec3 transformed = vec3( position );
          float damp = 0.35 + 0.65 * smoothstep(0.0, 1.5, depth);   // waves.ts seaDamp()
          vec3 g = gerstner(position.xz, uTime, damp);
          transformed += g;
          // a little lateral wobble per vertex keeps the triangles from reading as a regular grid
          transformed.x += sin(uTime * 0.7 + seed * 6.2831) * 0.3;
          transformed.z += cos(uTime * 0.6 + seed * 6.2831 + 1.7) * 0.3;
          vCrest = g.y / max(damp, 0.35); vOceanW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vRest = (modelMatrix * vec4(position, 1.0)).xz; vDamp = damp;   // E151: the rest point the fragment's normal is taken at`,
  fragmentCommon: /* glsl */`#include <common>
          uniform vec3 uShallow; uniform vec3 uDeep; uniform float uDeepDepth; uniform float uTime; uniform float uLevel;
          uniform sampler2D tSea; uniform float uChunkHalf; uniform float uSeaEnd; uniform float uWaterHalf;@{DRY_UNIFORMS}
          varying float vCrest; varying vec3 vOceanW; varying vec2 vRest; varying float vDamp;
          @{WAVES_NORMAL_GLSL}
          vec3 seaN;
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y); }
          float waterA; vec3 waterAdd;`,
  fragmentColor: /* glsl */`
          {
            // the sea floor under this pixel: height (R) and obstacle proximity (G). Off the chunk the edge's floor carries on and
            // sinks smoothly over 260 m — no straight-edged dark wedge along the chunk border
            vec2 suv = (vOceanW.xz + uChunkHalf) / (2.0 * uChunkHalf);
            float outD = length(max(abs(vOceanW.xz) - uChunkHalf, 0.0));
            float inC = step(outD, 0.0);
            vec2 cuv = clamp(suv, 0.001, 0.999);
            vec2 sea = texture2D(tSea, cuv).rg;
            float floorY = mix(sea.r, uLevel - 30.0, smoothstep(0.0, 260.0, outD));
            float still = uLevel - floorY;                          // depth below the still level
            float col = max(vOceanW.y - floorY, 0.0);               // the water column under the wave
            // metres to the water line: the depth over the local floor slope (two more fetches one texel over)
            float tx = 2.0 * uChunkHalf / 512.0;
            float hx = texture2D(tSea, cuv + vec2(1.0 / 512.0, 0.0)).r, hz = texture2D(tSea, cuv + vec2(0.0, 1.0 / 512.0)).r;
            float slope = length(vec2(hx - sea.r, hz - sea.r)) / tx;
            float shoreD = still / max(slope, 0.012);
            vec3 V = normalize(cameraPosition - vOceanW);
            // E151: the waves' own normal at this pixel's rest point, not the grid facet's — no 4 m light / dark triangles
            vec3 fn = gerstnerNormal(vRest, uTime, vDamp);
            seaN = fn;
            // Beer–Lambert: opacity from the path through the water (steeper view = clearer)
            float path = col / max(abs(V.y), 0.22);
            float opac = 1.0 - exp(-path * 0.85);
            float t = smoothstep(0.0, 1.0, pow(clamp(still / uDeepDepth, 0.0, 1.0), 0.9));   // turquoise lagoon → cobalt, one smooth ramp
            vec3 water = mix(uShallow, uDeep, t);
            // the swell's grade from the smooth normal; banded, it steps in a few hard-edged tones (the toon look in colour,
            // not in the grid's triangles), 10 % a step. The smooth normal tilts far less than a 4 m facet did, so the grade is
            // 2.6× the old one (picked from 1.0 / 1.4 / 1.8 / 2.6 on the phone). fwidth keeps each step's edge one pixel wide
            float gr = (fn.x * 4.2 + fn.z * 2.6) * 2.6 / 0.1;
            float gw = clamp(fwidth(gr), 0.02, 0.5);
            gr = floor(gr) + smoothstep(0.5 - gw, 0.5 + gw, fract(gr));
            water *= clamp(1.0 + gr * 0.1, 0.58, 1.48);
            water = mix(water, water * vec3(0.12, 0.3, 0.75), uToonNight);   // a moonlit sea is deep teal-blue, not lagoon cyan
            // ── foam (W2): 2–3 thin broken lace lines along the shore, rings round what stands in the water, caps out deep ──
            float n = vnoise(vOceanW.xz * 0.55 + uTime * 0.15);
            float d0 = shoreD + sin(uTime * 1.1 + dot(vOceanW.xz, vec2(0.07, 0.05))) * 0.3 - vCrest * 0.8;   // the line breathes with the swell
            float l1 = smoothstep(-0.05, 0.05, d0) * (1.0 - smoothstep(0.22, 0.36, d0)) * step(0.34, vnoise(vOceanW.xz * 1.7 + vec2(uTime * 0.3, 0.0)));   // a thin broken lace, not a ribbon
            float ph = fract(uTime * 0.16 + n * 0.15);
            float p2 = mix(3.0, 0.9, ph);
            float l2 = (1.0 - smoothstep(0.1, 0.28, abs(d0 - p2))) * step(0.42, vnoise(vOceanW.xz * 0.9 + 7.0)) * (1.0 - ph * 0.6);
            float p3 = mix(5.0, 2.2, fract(ph + 0.5));
            float l3 = (1.0 - smoothstep(0.08, 0.22, abs(d0 - p3))) * step(0.55, vnoise(vOceanW.xz * 0.7 + 13.0)) * 0.8;
            float lace = max(l1, max(l2, l3)) * inC * (1.0 - smoothstep(6.0, 9.0, shoreD)) * step(0.0, still);   // never where a crest pokes over the sand
            // rings round what stands in the water (E125): a broken lace collar hugging it + a thin ripple walking outward.
            // G is a ~1 m-texel proximity field, so any iso-line of it is the texel polygon (it drew as solid white hexagons):
            // turn it back into metres, wobble that by noise wider than a texel, and draw only thin broken bands of it
            float od = (1.0 - sea.g) * 3.0 + (n - 0.5) * 0.5 + (vnoise(vOceanW.xz * 1.3 - uTime * 0.2) - 0.5) * 0.35;
            float rn = vnoise(vOceanW.xz * 2.4 + vec2(uTime * 0.35, -uTime * 0.25));
            float r1 = (1.0 - smoothstep(0.22, 0.3, od - vCrest * 0.4)) * step(0.42, rn);
            float rp = fract(uTime * 0.3 + n * 0.25);
            float r2 = (1.0 - smoothstep(0.05, 0.14, abs(od - mix(0.45, 1.9, rp)))) * step(0.5, rn) * (1.0 - rp) * 0.9;
            float ring = max(r1, r2) * smoothstep(0.0, 0.12, sea.g) * inC;
            float cap = smoothstep(0.2, 0.26, vCrest) * step(0.62, vnoise(vOceanW.xz * 0.2 + 3.1)) * smoothstep(2.5, 8.0, still) * 0.85;
            float foam = clamp(max(max(lace, ring), cap), 0.0, 1.0);
            diffuseColor.rgb = mix(water, vec3(1.0), foam);
            waterA = max(opac, foam);
            // ── reflection + glint, added after lighting ──
            vec3 R = reflect(-V, fn);
            float e = max(R.y, 0.0);
            vec3 skyR = mix(fogColor, uFogZenith, pow(smoothstep(0.0, 0.75, e), 0.62) * 0.6 + 0.4); // biased to the saturated zenith: no white wash
            float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(fn, V), 0.0, 1.0), 5.0);
            float sd = max(dot(R, fogSunDir), 0.0);
            // glints break up facet by facet into sparkles (a flat patch facing the sun would be one blinding blob)
            float sparkle = step(0.92, hash21(floor(vOceanW.xz * 1.3) + floor(uTime * 3.0)));
            float glint = smoothstep(0.994, 0.998, sd) * 1.0 * sparkle + pow(sd, 60.0) * 0.08;
            waterAdd = (skyR * fres * 0.14 + fogSunColor * glint) * (1.0 - foam) + fogSunColor * foam * 0.5; // foam reads white, not lavender
            waterA = max(waterA, fres * 0.3);
            if (!gl_FrontFacing) {
              // from below (W4): Snell's window — inside ~49° of straight up the sky shows through, bright; outside it the
              // surface is a mirror of the deep water (total internal reflection)
              float up = abs(dot(fn, V));
              float win = smoothstep(0.6, 0.7, up);
              vec3 skyU = mix(fogColor, uFogZenith, 0.5) * 1.4;
              waterA = 1.0;
              waterAdd = mix(uDeep * 1.6 + uShallow * 0.15, skyU, win);
              diffuseColor.rgb = vec3(0.0);
            }
          }`,
  fragmentNormal: /* glsl */`#include <normal_fragment_begin>
          normal = normalize((viewMatrix * vec4(seaN * faceDirection, 0.0)).xyz);   // E151: the toon lighting reads the smooth wave too
          nonPerturbedNormal = normal;`,
  fragmentOpaque: /* glsl */`
          if (max(abs(vRest.x), abs(vRest.y)) > uWaterHalf@{EDGE_INSET}) discard;   // the sea stays inside its level's square@{EDGE_NOTE}@{DRY_DISCARD}
          {
            // fade out over the last 300 m before the painted horizon, so the islands' feet stand on the sea's own far edge
            float seaEnd = 1.0 - smoothstep(uSeaEnd - 300.0, uSeaEnd, length(vOceanW.xz - cameraPosition.xz));
            float a = clamp(waterA, 0.0, 1.0) * seaEnd;
            vec3 premul = outgoingLight * a + waterAdd * seaEnd;
            gl_FragColor = vec4(premul / max(a, 1e-3), a);       // PREMULTIPLIED_ALPHA multiplies it back
          }`,
};
