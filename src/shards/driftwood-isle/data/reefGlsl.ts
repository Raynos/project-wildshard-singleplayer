// SHARD-PLATFORM M3 (look-family rows): models/reef.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what that module passes (another module's GLSL, a number from its layout).
export const REEF_GLSL = {
  swayBegin: /* glsl */`
          vec3 transformed = vec3( position );
          {
            // the current: a slow surge with a faster ripple on top; the tips of the fronds travel, the roots stay put
            float w = sway.x, ph = sway.y;
            float g = sin(uTime * 0.8 + ph) * 0.7 + sin(uTime * 1.9 + ph * 1.7) * 0.3;
            transformed.x += g * w * 0.35;
            transformed.z += cos(uTime * 0.65 + ph * 1.3) * w * 0.28;
            transformed.y -= abs(g) * w * 0.08;
          }`,
};
