// SHARD-PLATFORM M3 (look-family rows): look/cloudSea.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/cloudSea.ts passes (another module's GLSL, a number from the layout).
export const CLOUD_SEA_GLSL = {
  seaFragment: /* glsl */`
      @{V2_GRADE_GLSL}
      @{V2_TINT_GLSL}
      uniform sampler2D tNoise; uniform float uTime; uniform sampler2D tFogLut; uniform vec3 uSunView;
      varying vec3 vW;
      float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
        return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
      // cumulus heaps: big soft mounds (two octaves, billowed) for the shape and the light, finer puffs only in the tone
      float heap(vec2 p) { float a = vn(p), b = vn(p * 2.1 + 7.1); return a * 0.62 + (1.0 - abs(b * 2.0 - 1.0)) * 0.38; }
      void main() {
        vec2 p = vW.xz * 0.011 + vec2(uTime * 0.006, uTime * 0.0025);
        float d = heap(p);
        float fine = vn(p * 5.3 - 3.7) * 0.6 + vn(p * 12.1 + 1.3) * 0.4;
        // the mound's surface normal (a height field) lit from the painted sun's side, wrapped soft
        float e = 0.08;
        vec3 n = normalize(vec3(d - heap(p + vec2(e, 0.0)), 0.16, d - heap(p + vec2(0.0, e))));
        vec3 sunH = normalize(vec3(uSunView.x, max(uSunView.y, 0.3), uSunView.z));
        float lit = clamp(dot(n, sunH) * 0.75 + 0.3, 0.0, 1.0);
        // tops catch the light, the folds between the heaps sink into blue shade
        float crown = smoothstep(0.34, 0.7, d + (fine - 0.5) * 0.25);
        vec3 ray = vW - cameraPosition;
        float dist = length(ray);
        vec3 vd = ray / dist;
        float az = atan(-vd.x, vd.z) * 0.15915494;
        vec3 haze = texture2D(tFogLut, vec2(az, 0.5)).rgb;                         // scene-linear already
        float toSun = pow(max(dot(normalize(vec3(vd.x, 0.0, vd.z)), normalize(vec3(uSunView.x, 0.0, uSunView.z))), 0.0), 3.0);
        // painted cloud colours (display-linear): lavender-white sunlit tops, gold toward the sun, blue-grey hollows
        vec3 top = mix(vec3(0.97, 0.9, 0.86), vec3(1.0, 0.8, 0.5), toSun * 0.8 + 0.15);
        vec3 shade = mix(vec3(0.46, 0.5, 0.66), vec3(0.66, 0.52, 0.5), toSun * 0.5);
        vec3 c = mix(shade, top, lit * (0.55 + 0.45 * crown));
        c = mix(shade * 0.7, c, 0.25 + 0.75 * crown);
        c = v2Ungrade(c);
        // far off the deck melts into the painted haze, then thins so the far ranges stand over it
        // N19 (the user's pick: blend): the deck sits mostly in the haze from the slab's lip out, so the slab edge's haze
        // (fog.ts fogEdgeV2), the deck and the painting's hazed land (sky.ts: land) read as one soft band
        c = mix(c, haze, max(smoothstep(300.0, 2600.0, dist) * 0.85, 0.76 + 0.2 * smoothstep(80.0, 1400.0, dist)));
        c = v2Regrade(c);
        float alpha = 1.0 - smoothstep(2800.0, 5200.0, dist);
        gl_FragColor = vec4(c, alpha);
      }`,
};
