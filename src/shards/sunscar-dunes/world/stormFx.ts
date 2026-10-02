import { BackSide, ShaderMaterial, type Color } from 'three';
import { WIND } from './dunes';

/**
 * The sand storm's blown-sand sheets (review R5 / TOP-15 #11, style bible FX): a shell around the player whose shader
 * draws long streaks racing downwind (`WIND`), denser near the horizon and the ground, pulsing in gusts, over a dusty
 * veil. `fine` shells (the near one) streak faster and thinner. Opacity is the storm's strength × the shell's share.
 */
export function stormMaterial(color: Color, fine: boolean): ShaderMaterial {
  return new ShaderMaterial({
    // depth-tested (round 1, R1B-17): what stands nearer than the shell (the Matriarch diving at you) draws in front of
    // it, the distance stays veiled; with depthTest off the shells hid her even at 10 m
    side: BackSide, transparent: true, depthWrite: false, depthTest: true, fog: false,
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec3 vDir;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vDir);
  // Azimuth measured from the downwind direction: streaks run along it and race that way.
  vec2 w = normalize(vec2(${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}));
  float az = atan(d.x * w.y - d.z * w.x, d.x * w.x + d.z * w.y);
  float el = d.y;
  float speed = ${fine ? '2.4' : '1.1'}, rows = ${fine ? '260.0' : '120.0'}, len = ${fine ? '7.0' : '4.0'};
  float s1 = sNoise(vec2(az * len - uTime * speed, el * rows));
  float s2 = sNoise(vec2(az * len * 2.3 - uTime * speed * 1.7 + 3.1, el * rows * 1.9));
  float streak = smoothstep(0.55, 0.95, s1 * 0.6 + s2 * 0.4);
  float gust = 0.7 + 0.3 * sin(uTime * 1.3) * sin(uTime * 0.37 + 1.0);
  float low = 1.0 - smoothstep(-0.1, 0.55, el);
  float veil = 0.55 + 0.45 * sNoise(vec2(az * 1.5 - uTime * 0.3, el * 4.0));
  float a = uOpacity * gust * (veil * (0.45 + 0.55 * low) + streak * 0.7 * (0.35 + 0.65 * low));
  vec3 c = uColor * (0.85 + 0.5 * streak);
  gl_FragColor = vec4(c, clamp(a, 0.0, 0.95));
}`,
  });
}
