// SHARD-PLATFORM M3 (look-family rows): world/Waterfall.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what that module passes (another module's GLSL, a number from its layout).
export const WATERFALL_GLSL = {
  HASH: /* glsl */`
  float wfH(float n) { return fract(sin(n * 127.1) * 43758.5453); }`,
  curtainVertex: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec2 aStep;
      varying vec2 vUv; varying vec2 vStep; varying vec3 vW;
      void main() {
        vUv = uv; vStep = aStep;
        vec3 transformed = position;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
  curtainFragment: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv; varying vec2 vStep; varying vec3 vW;
      @{HASH}
      // a hard edge, one screen pixel of anti-aliasing
      float edge(float e, float x) { float w = fwidth(x) * 0.75; return smoothstep(e - w, e + w, x); }
      void main() {
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        float lit = abs(dot(fn, fogSunDir));
        float facet = lit > 0.55 ? 1.0 : lit > 0.25 ? 0.86 : 0.74;          // three toon bands across the pleats
        float f = vStep.x, k = vStep.y;
        float d = clamp((f - @{SHELF}) / @{DROP}, 0.0, 1.0); // how far down this terrace's drop
        // the body: glassy cyan where it pours, deeper teal down the drop, in hard bands
        vec3 col = mix(vec3(0.50, 0.88, 0.94), vec3(0.24, 0.72, 0.84), edge(0.22, d));
        col = mix(col, vec3(0.15, 0.56, 0.72), edge(0.62, d));
        // streaks: a few lanes of bright dashes scrolling down, longer and more of them toward the foot of each drop
        float lanes = 7.0, x = vUv.x * lanes, lane = floor(x), h = wfH(lane + k * 13.0);
        float inLane = 1.0 - edge(0.09 + 0.08 * h, abs(fract(x) - 0.5 - (h - 0.5) * 0.3));
        float p = fract(vUv.y * 6.0 - uTime * (1.1 + 0.5 * h) + h * 7.0);
        float dash = 1.0 - edge(0.22 + 0.3 * d, p);
        float streak = inLane * dash * step(0.3, h + d * 0.4);
        col = mix(col, vec3(0.93, 0.99, 1.0), streak);
        // the brink: a crisp white roll where the shelf tips over, a pale band just below it
        float brink = 1.0 - edge(0.035, abs(f - @{SHELF} - 0.01));
        col = mix(col, vec3(0.80, 0.97, 1.0), (1.0 - edge(0.1, abs(f - @{BRINK}))) * 0.5);
        col = mix(col, vec3(1.0), brink);
        // where a drop lands on the next shelf: scalloped foam, bobbing
        float scallop = 0.16 + 0.05 * sin(vUv.x * 40.0 + k * 2.0 + uTime * 5.0) + 0.03 * sin(vUv.x * 17.0 - uTime * 3.0);
        float landing = k > 0.5 ? 1.0 - edge(scallop, f) : 0.0;
        col = mix(col, vec3(0.97, 1.0, 1.0), landing);
        // the last metre of the last drop churns white into the pool
        col = mix(col, vec3(0.95, 1.0, 1.0), edge(0.955 + 0.02 * sin(vUv.x * 30.0 + uTime * 6.0), vUv.y));
        // the sides: a hard cut with a thin white rim
        float e = abs(vUv.x - 0.5) * 2.0;
        col = mix(col, vec3(0.9, 0.98, 1.0), edge(0.88, e));
        float a = (1.0 - edge(0.985, e)) * mix(0.95, 1.0, max(streak, max(brink, landing)));
        gl_FragColor = vec4(col * facet * (0.35 + 0.75 * fogSunColor), a);
        #include <fog_fragment>
      }`,
  poolVertex: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vL;
      uniform vec3 uCentre;
      void main() {
        vec3 transformed = position;
        vL = position.xz - uCentre.xz;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
  poolFragment: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uR;
      varying vec2 vL;
      @{HASH}
      float edge(float e, float x) { float w = fwidth(x) * 0.75; return smoothstep(e - w, e + w, x); }
      void main() {
        float ang = atan(vL.y, vL.x), seg = 6.2831853 / 9.0;
        float r = length(vL) / uR;
        float rp = r * cos(mod(ang + 0.3, seg) - seg * 0.5);          // the distance to a 9-sided polygon: faceted rings
        float side = floor((ang + 3.1415927) / seg);
        // the churn at the core: a white disc with a scalloped rim
        float core = 1.0 - edge(0.3 + 0.05 * sin(ang * 7.0 + uTime * 4.0), rp);
        // three rings spreading out, thinning as they go, each broken into dashes on a few of the polygon's sides
        float ring = 0.0, pale = 0.0;
        for (int i = 0; i < 3; i++) {
          float ph = fract(uTime * 0.42 + float(i) / 3.0);
          float rad = mix(0.3, 0.95, ph), th = mix(0.055, 0.012, ph);
          float on = step(0.28, wfH(side + float(i) * 11.0 + floor(uTime * 0.42 + float(i) / 3.0) * 3.0));
          float band = (1.0 - edge(th, abs(rp - rad))) * on;
          ring = max(ring, band * step(ph, 0.6));
          pale = max(pale, band * step(0.6, ph));
        }
        float foam = max(core, ring);
        vec3 col = mix(vec3(0.75, 0.93, 0.98), vec3(0.97, 1.0, 1.0), foam);
        float a = max(foam, pale * 0.75) * (1.0 - edge(0.98, rp));
        gl_FragColor = vec4(col * (0.35 + 0.75 * fogSunColor), a);
        #include <fog_fragment>
      }`,
  puffVertex: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 aCentre;
      attribute vec4 aInfo;
      uniform float uTime;
      varying vec3 vW; varying float vA; varying float vMist;
      void main() {
        float r = aInfo.x, sd = aInfo.y, kind = aInfo.z;
        vec2 out2 = vec2(cos(aInfo.w), sin(aInfo.w));
        vec3 c = aCentre;
        float s; vA = 1.0; vMist = 0.0;
        if (kind > 1.5) {
          // spray: a chunk thrown up off the churn, shrinking away as it rises and drifts out, then again at the foot
          float life = fract(uTime * 0.35 + sd);
          c += vec3(out2.x * life * 0.8, sin(life * 2.2) * 1.2, out2.y * life * 0.8);
          s = r * (1.0 - life);
          vA = 0.9; vMist = 1.0;
        } else {
          // foam: each ball boils up from nothing, drifts a little outward and sinks back
          float life = fract(uTime * (kind > 0.5 ? 0.9 : 0.62) + sd);
          c += vec3(out2.x, 0.0, out2.y) * life * (kind > 0.5 ? 0.25 : 0.55);
          c.y += 0.12 * sin(life * 3.14159) * r;
          s = r * (0.12 + 0.95 * sin(life * 3.14159));
        }
        vec3 transformed = c + position * s;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
  puffFragment: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vW; varying float vA; varying float vMist;
      void main() {
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        float ndl = dot(fn, fogSunDir);
        // two toon bands: sunlit white, a pale-blue shade; the spray is paler
        vec3 col = ndl > 0.15 ? vec3(0.98, 1.0, 1.0) : vec3(0.64, 0.84, 0.93);
        col = mix(col, vec3(1.0), vMist * 0.7);
        gl_FragColor = vec4(col * (0.35 + 0.75 * fogSunColor), vA);
        #include <fog_fragment>
      }`,
};
