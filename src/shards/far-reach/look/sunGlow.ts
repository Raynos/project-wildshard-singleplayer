import { AdditiveBlending, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, type Vector3 } from 'three';

/**
 * The sun's glow and light shafts (E392; the judge every loop: "no visible sun, no god rays"). The panorama paints the
 * sun disc (look/sky.ts); this adds, at the same direction, a wide soft bloom and a fan of long light-shaft cards
 * radiating from it, additive, drawn after the dome and before the world, so islands and clouds in front occlude them.
 * Camera-facing in the shader; a shard-side stand-in until the engine's god-ray pass can take a shard's light source
 * (ENGINE REQUEST to the lead, 2026-10-02).
 */
export const SUN_GLOW = { distance: 820, bloom: 230, wide: 900, shafts: 11, shaftLength: 620, shaftWidth: 26 } as const;

const VERTEX = /* glsl */`
  uniform vec3 uSun; uniform float uDist; uniform vec2 uSize; uniform float uAngle;
  varying vec2 vUv;
  void main(){
    vec3 centre = cameraPosition + uSun * uDist;
    vec3 toCam = normalize(cameraPosition - centre);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)), up = cross(toCam, right);
    // a shaft card rotates in the view plane about the sun; the bloom card is centred on it
    float c = cos(uAngle), s = sin(uAngle);
    vec2 p = vec2(position.x * uSize.x, (position.y + (uSize.y > uSize.x ? 0.5 : 0.0)) * uSize.y);
    vec2 r = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    vUv = position.xy + 0.5;
    gl_Position = projectionMatrix * viewMatrix * vec4(centre + right * r.x + up * r.y, 1.0);
  }`;

export function sunGlow(sun: Vector3): { group: Group; geometry: PlaneGeometry; materials: ShaderMaterial[]; update: (t: number) => void } {
  const group = new Group(); group.name = 'far.sun-glow';
  const plane = new PlaneGeometry(1, 1);
  const bloom = new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending, fog: false, side: DoubleSide,
    uniforms: { uSun: { value: sun }, uDist: { value: SUN_GLOW.distance }, uSize: { value: [SUN_GLOW.bloom, SUN_GLOW.bloom] }, uAngle: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        // loop 20 (mockup A: a hot white disc with a wide bloom beside the windmill; the painted disc alone read faint
        // through the haze): the disc itself (about the painted one's 1.5 deg), a tight hot glow and a wide warm halo
        float disc = 1.0 - smoothstep(0.085, 0.115, d);
        float core = exp(-d * d * 60.0), halo = exp(-d * 3.2) * (1.0 - smoothstep(0.7, 1.0, d));
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.88) * disc * 1.6 + vec3(1.0, 0.86, 0.58) * (core * 2.6 + halo * 1.0), 1.0);
      }` });
  const bloomMesh = new Mesh(plane, bloom); bloomMesh.frustumCulled = false; bloomMesh.renderOrder = -9; group.add(bloomMesh);
  // a wide, faint gold over the sky round the sun (E399, the mockups' golden air toward the low sun)
  const wide = new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending, fog: false, side: DoubleSide,
    uniforms: { uSun: { value: sun }, uDist: { value: SUN_GLOW.distance }, uSize: { value: [SUN_GLOW.wide, SUN_GLOW.wide] }, uAngle: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * exp(-d * 2.4) * (1.0 - smoothstep(0.75, 1.0, d)) * 0.32, 1.0); }` });
  const wideMesh = new Mesh(plane, wide); wideMesh.frustumCulled = false; wideMesh.renderOrder = -9; group.add(wideMesh);
  const shafts: ShaderMaterial[] = [];
  for (let i = 0; i < SUN_GLOW.shafts; i++) {
    const angle = Math.PI * (0.62 + 0.76 * (i / (SUN_GLOW.shafts - 1))) + Math.sin(i * 7.3) * 0.08;   // fanned downward
    const m = new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending, fog: false, side: DoubleSide,
      uniforms: { uSun: { value: sun }, uDist: { value: SUN_GLOW.distance }, uSize: { value: [SUN_GLOW.shaftWidth * (0.6 + 0.8 * ((i * 0.37) % 1)), SUN_GLOW.shaftLength * (0.6 + 0.5 * ((i * 0.53) % 1))] }, uAngle: { value: angle }, uPulse: { value: 1 } },
      vertexShader: VERTEX,
      fragmentShader: /* glsl */`
        uniform float uPulse; varying vec2 vUv;
        void main(){
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0, along = vUv.y;
          float a = smoothstep(0.0, 1.0, across) * (1.0 - along) * smoothstep(0.0, 0.08, along) * 0.13 * uPulse;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a, 1.0);
        }` });
    const mesh = new Mesh(plane, m); mesh.frustumCulled = false; mesh.renderOrder = -9; group.add(mesh); shafts.push(m);
  }
  return { group, geometry: plane, materials: [bloom, wide, ...shafts], update: (t) => { shafts.forEach((m, i) => { const u = m.uniforms['uPulse']; if (u) u.value = 0.75 + 0.25 * Math.sin(t * 0.3 + i * 1.7); }); } };
}
