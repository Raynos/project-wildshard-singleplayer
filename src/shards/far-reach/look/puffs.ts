import { Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, type Vector3 } from 'three';
import { SKY } from './sun';

/**
 * Cumulus over the cloud sea (loop 5; the aerial targets: the islands rise out of billowing sunlit cloud, not a flat
 * sheet). A field of camera-facing billboards, one draw: each is shaded as a lumpy sphere lit from the low sun (gold-peach
 * crowns, lavender bellies, a bright rim toward the sun), its edge broken into cauliflower billows by noise; they thin out
 * with distance so the painted panorama's cloud sea takes over. Seeded, so every load grows the same sky.
 */
export const PUFFS = { count: 260, ring: [30, 440], y: [-4, 14], size: [20, 58], fade: [420, 680], centre: [0, -90] } as const;

function hex(value: number): string { const c = new Color(value); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; }

export function cumulus(sun: Vector3): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  let a = 9317 >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const base = new PlaneGeometry(2, 2), g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  const n = PUFFS.count, at = new Float32Array(n * 4), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2, r = PUFFS.ring[0] + (PUFFS.ring[1] - PUFFS.ring[0]) * Math.sqrt(rnd());
    const size = PUFFS.size[0] + (PUFFS.size[1] - PUFFS.size[0]) * rnd() ** 1.5;
    at.set([PUFFS.centre[0] + Math.cos(ang) * r, PUFFS.y[0] + (PUFFS.y[1] - PUFFS.y[0]) * rnd(), PUFFS.centre[1] + Math.sin(ang) * r, size], i * 4);
    seed[i] = rnd() * 100;
  }
  g.setAttribute('aAt', new InstancedBufferAttribute(at, 4)); g.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1)); g.instanceCount = n;
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sun } },
    vertexShader: /* glsl */`
      attribute vec4 aAt; attribute float aSeed; varying vec2 vUv; varying vec3 vRight; varying vec3 vUp; varying vec3 vToCam; varying float vSeed; varying float vFade;
      void main(){
        vec3 toCam = normalize(cameraPosition - aAt.xyz);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
        // a little flatter than round: cumulus spread wider than tall
        vec3 world = aAt.xyz + (right * position.x * 1.25 + up * position.y * 0.8) * aAt.w;
        vUv = position.xy; vRight = right; vUp = up; vToCam = toCam; vSeed = aSeed;
        float d = length(aAt.xz - cameraPosition.xz);
        vFade = 1.0 - smoothstep(${PUFFS.fade[0].toFixed(1)}, ${PUFFS.fade[1].toFixed(1)}, d);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun; varying vec2 vUv; varying vec3 vRight; varying vec3 vUp; varying vec3 vToCam; varying float vSeed; varying float vFade;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
      void main(){
        vec2 p = vUv;
        // billows: the edge pushed in and out by two octaves of noise round the rim, a flat-ish base
        float ang = atan(p.y, p.x);
        float bump = n2(vec2(ang * 2.2 + vSeed, vSeed)) * 0.28 + n2(vec2(ang * 5.0 - vSeed, vSeed * 1.7)) * 0.14;
        float r = length(vec2(p.x, p.y < 0.0 ? p.y * 1.6 : p.y));
        float edge = 0.78 + bump - 0.2;
        float body = 1.0 - smoothstep(edge - 0.22, edge, r);
        if (body < 0.01) discard;
        // a sphere normal, lumpy, in world space
        float z = sqrt(max(0.0, 1.0 - min(1.0, r * r)));
        vec3 nrm = normalize(vRight * p.x + vUp * p.y + vToCam * (z + 0.15) + (vRight * (n2(p * 3.0 + vSeed) - 0.5) + vUp * (n2(p * 3.0 - vSeed) - 0.5)) * 0.6);
        // painted cumulus: the crowns lit by the whole sky (bright peach-white), the bellies lavender, the sunward side gold
        float sky = smoothstep(-0.55, 0.65, nrm.y * 0.7 + p.y * 0.5 + (n2(p * 2.5 + vSeed) - 0.5) * 0.35);
        float sunward = clamp(dot(nrm, uSun) * 0.8 + 0.2, 0.0, 1.0);
        vec3 shade = ${hex(SKY.seaShade)}, warm = ${hex(SKY.seaShadeWarm)}, crown = ${hex(SKY.seaLit)};
        vec3 c = mix(shade, warm, smoothstep(0.1, 0.6, sky));
        c = mix(c, crown * 1.08, smoothstep(0.45, 1.0, sky));
        c = mix(c, ${hex(SKY.sun)} * 1.05, sunward * sky * 0.35);
        // the silver-gold rim when the sun is behind the cloud
        float behind = max(dot(-vToCam, uSun), 0.0);
        c += ${hex(SKY.sun)} * pow(behind, 3.0) * smoothstep(edge - 0.25, edge - 0.02, r) * 0.6;
        gl_FragColor = vec4(c, body * vFade);
      }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = -5; mesh.name = 'far.cumulus';
  return mesh;
}
