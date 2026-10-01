import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, type Vector3 } from 'three';

/** The dusk palette (sRGB hex): indigo zenith, violet mid sky, a narrow orange band, the haze the fog and ridges take. */
export const DUSK = { zenith: 0x0e1430, mid: 0x2b2f5e, rose: 0x5c3a5c, band: 0xc9602e, glow: 0xf3a052, below: 0x24120c, haze: 0x7a4a3c };

/** The sky dome: a gradient that warms toward the set sun, and a few hundred faint stars above the band. Drawn first, no fog. */
export function duskDome(sunDir: Vector3): Mesh<SphereGeometry, ShaderMaterial> {
  const c = (hex: number): Color => new Color(hex);
  const material = new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone() }, uZenith: { value: c(DUSK.zenith) }, uMid: { value: c(DUSK.mid) }, uRose: { value: c(DUSK.rose) },
      uBand: { value: c(DUSK.band) }, uGlow: { value: c(DUSK.glow) }, uBelow: { value: c(DUSK.below) }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun, uZenith, uMid, uRose, uBand, uGlow, uBelow; uniform float uTime; varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec2 flat2 = normalize(d.xz + 1e-5), sun2 = normalize(uSun.xz + 1e-5);
        float toward = 0.5 + 0.5 * dot(flat2, sun2), warm = pow(toward, 3.0);
        vec3 col = mix(uMid, uZenith, smoothstep(0.25, 0.85, h));
        col = mix(uRose, col, smoothstep(0.04, 0.3 - 0.08 * warm, h));
        col = mix(uBand, col, smoothstep(0.0, 0.09 + 0.06 * warm, h));
        col = mix(col, uGlow, warm * (1.0 - smoothstep(0.0, 0.07, h)) * 0.85);
        col = mix(uBelow, col, smoothstep(-0.06, 0.0, h));
        vec3 cell = floor(d * 260.0); float star = step(0.9965, hash(cell));
        float twinkle = 0.6 + 0.4 * sin(uTime * 1.7 + hash(cell + 3.0) * 40.0);
        col += star * twinkle * smoothstep(0.18, 0.5, h) * (1.0 - 0.7 * warm) * vec3(0.75, 0.8, 1.0) * 0.55;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` });
  const dome = new Mesh(new SphereGeometry(400, 48, 24), material);
  dome.renderOrder = -1000; dome.frustumCulled = false;
  return dome;
}
