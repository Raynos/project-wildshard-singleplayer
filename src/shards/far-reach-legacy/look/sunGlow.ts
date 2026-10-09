import { AdditiveBlending, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, type Vector3 } from 'three';

/**
 * The sun's glow and light shafts (E392; the judge every loop: "no visible sun, no god rays"). The panorama paints the
 * sun disc (look/sky.ts); this adds, at the same direction, a wide soft bloom and a fan of long light-shaft cards
 * radiating from it, additive, drawn after the dome and before the world, so islands and clouds in front occlude them.
 * Camera-facing in the shader; a shard-side stand-in until the engine's god-ray pass can take a shard's light source
 * (ENGINE REQUEST to the lead, 2026-10-02).
 */
/**
 * `order`: drawn after the cumulus puffs (look/puffs.ts, -5; they write no depth), so the low sun burns through a cloud
 * bank as mockups A and D paint it, while the isles and the world (depth) still hide it (E399 round 6: from the spawn the
 * crown's cloud bank covered the whole disc).
 */
export const SUN_GLOW = { distance: 820, bloom: 230, wide: 900, shafts: 11, shaftLength: 620, shaftWidth: 26, order: -4 } as const;

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
        float halo = exp(-d * 3.2) * (1.0 - smoothstep(0.7, 1.0, d));
        // gold, not white (E399 seats: 'the sun white'): a warm disc in an amber-orange bloom
        // round 6 (the seats: 'a hollow pink ring in a soft wash', 66-76 % of the frame's over-230 pixels in the sun's blur
        // against the mockups' 46-62 %, D's halo 15 % of its middle band over 230 vs 5 %): one solid hot disc, a fainter halo
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.82) * disc * 6.0 + vec3(1.0, 0.62, 0.26) * (exp(-d * d * 140.0) * 1.2 + halo * 0.1), 1.0);
      }` });
  const bloomMesh = new Mesh(plane, bloom); bloomMesh.frustumCulled = false; bloomMesh.renderOrder = SUN_GLOW.order; group.add(bloomMesh);
  // a wide, faint gold over the sky round the sun (E399, the mockups' golden air toward the low sun)
  const wide = new ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending, fog: false, side: DoubleSide,
    uniforms: { uSun: { value: sun }, uDist: { value: SUN_GLOW.distance }, uSize: { value: [SUN_GLOW.wide, SUN_GLOW.wide] }, uAngle: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * exp(-d * 2.4) * (1.0 - smoothstep(0.75, 1.0, d)) * 0.06, 1.0); }` });
  const wideMesh = new Mesh(plane, wide); wideMesh.frustumCulled = false; wideMesh.renderOrder = SUN_GLOW.order; group.add(wideMesh);
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
    const mesh = new Mesh(plane, m); mesh.frustumCulled = false; mesh.renderOrder = SUN_GLOW.order; group.add(mesh); shafts.push(m);
  }
  return { group, geometry: plane, materials: [bloom, wide, ...shafts], update: (t) => { shafts.forEach((m, i) => { const u = m.uniforms['uPulse']; if (u) u.value = 0.75 + 0.25 * Math.sin(t * 0.3 + i * 1.7); }); } };
}
