// SHARD-PLATFORM M3 (look-family rows): world/Gulls.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what that module passes (another module's GLSL, a number from its layout).
export const GULLS_GLSL = {
  vertexCommon: /* glsl */`#include <common>
          attribute float aPart; attribute vec4 aAnim;
          mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }`,
  vertexBegin: /* glsl */`
          vec3 transformed = vec3( position );
          {
            float part = aPart;
            float flap = aAnim.x, headYaw = aAnim.y, fold = aAnim.z, tuck = aAnim.w;
            if (part == 1.0 || part == 2.0) {
              // wing: shorten + sweep back along the flank when perched (tuck 0), fold the hand about the elbow,
              // swing the whole wing about the shoulder (flap, about +z), then sweep about the shoulder (about +y)
              float side = part == 1.0 ? -1.0 : 1.0;
              bool hand = abs(position.x) > @{ELBOW_X} - 0.001;
              vec2 e = vec2(@{ELBOW_X} * side, @{SHOULDER_Y_LIFT});
              vec2 s = vec2(@{SHOULDER_X} * side, @{SHOULDER_Y});
              vec2 xy = transformed.xy;
              float k = 1.0 - 0.45 * (1.0 - tuck);
              xy.x = (xy.x - s.x) * k + s.x; e.x = (e.x - s.x) * k + s.x;
              if (hand) xy = rot2(-fold * side) * (xy - e) + e;
              xy = rot2(flap * side) * (xy - s) + s;
              transformed.xy = xy;
              float sw = (1.0 - tuck) * 1.25;
              vec2 sz = vec2(s.x, 0.02);
              transformed.xz = rot2(-sw * side) * (transformed.xz - sz) + sz;
            } else if (part == 3.0) {
              // head: turn about the neck (y axis)
              vec2 n = vec2(@{NECK_X}, @{NECK_Z});
              transformed.xz = rot2(headYaw) * (transformed.xz - n) + n;
            } else if (part >= 4.0) {
              // legs: tuck back under the tail in flight (about the hip, x axis)
              vec2 h = vec2(@{HIP_Y}, @{HIP_Z});
              transformed.yz = rot2(-tuck * 1.35) * (transformed.yz - h) + h;
            }
          }`,
};
