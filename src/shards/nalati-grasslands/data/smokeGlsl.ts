// SHARD-PLATFORM M3 (look-family rows): world/Smoke.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what world/Smoke.ts passes (another module's GLSL, a number from the layout).
export const SMOKE_GLSL = {
  vertexShader: /* glsl */`
        attribute vec3 emitter; attribute vec4 seed; attribute vec4 cfg;
        uniform float uTime; uniform vec3 uWind; uniform vec3 uSunDir;
        varying vec2 vUv; varying float vAge; varying float vLit; varying vec4 vSeed;
        #include <fog_pars_vertex>
        void main() {
          float life = cfg.w;
          float age = fract(uTime / life + seed.w);
          vAge = age; vSeed = seed; vUv = position.xy + 0.5;
          // a plume, not a string of puffs: every puff follows the same bent path (rise slowing, the wind taking it
          // more and more), with only a slow shared meander and a little per-puff spread that grows with age
          vec3 wind = vec3(uWind.x, 0.0, uWind.y) * (0.7 + 0.5 * uWind.z);
          vec3 transformed = emitter;
          transformed.y += cfg.x * (1.0 - pow(1.0 - age, 1.8));
          transformed += wind * pow(age, 1.6) * cfg.x * 0.42;
          float meander = sin(uTime * 0.35 + emitter.x * 0.7) * 0.6 + sin(uTime * 0.21 + emitter.z) * 0.4;
          transformed.x += meander * 0.5 * age * age + (seed.x - 0.5) * 1.1 * age;
          transformed.z += meander * 0.3 * age * age + (seed.y - 0.5) * 1.1 * age;
          float size = mix(cfg.y, cfg.z, pow(age, 0.6)) * (0.85 + 0.3 * seed.y);
          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          float rot = seed.x * 6.28 + age * (seed.y - 0.5) * 2.5;
          vec2 q = position.xy * size;
          mvPosition.xy += vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
          vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          vLit = dot(normalize(position.xy), sunV.xy);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
  fragmentShader: /* glsl */`
        uniform vec3 uSunCol; uniform vec3 uShade;
        varying vec2 vUv; varying float vAge; varying float vLit; varying vec4 vSeed;
        #include <fog_pars_fragment>
        void main() {
          vec2 d = vUv - 0.5;
          // three overlapping soft lobes → a painted cloud-puff silhouette
          // one soft gaussian lobe (no hard silhouette: overlapping puffs melt into a continuous plume)
          float r2 = dot(d, d) * 4.0;
          float m = exp(-r2 * 3.2) * (0.85 + 0.15 * sin(vSeed.z * 20.0 + d.x * 6.0));
          float fade = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.25, 1.0, vAge));
          float a = m * fade * 0.24;
          if (a < 0.004) discard;
          // painted light: a warm lit side, a cool sky-tinted shade side, two soft bands
          float lit = smoothstep(-0.2, 0.35, vLit * 0.5 + (m - 0.5) * 0.6);
          vec3 base = vec3(0.86, 0.85, 0.84);
          vec3 col = mix(base * (uShade * 2.2 + 0.45), base * uSunCol * 0.55 + 0.25, lit);
          gl_FragColor = vec4(col * (0.9 + 0.2 * (1.0 - vAge)), a);
          #include <fog_fragment>
        }`,
};
