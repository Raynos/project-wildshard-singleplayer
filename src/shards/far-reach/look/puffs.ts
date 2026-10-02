import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, type Texture, type Vector3 } from 'three';

/**
 * Cumulus over the cloud sea (E392; the targets: the islands rise out of a sea of sunlit billowing cloud). A field of
 * camera-facing billboards, one draw, each showing one of eight painted golden-hour cumulus puffs from an atlas
 * (`public/assets/far-reach/tex/clouds.webp`, codex image_gen, `art/far-reach/round-17-mockup-loop/textures/`: puffs on
 * black, so the brightness is the alpha). They sit below the decks (the tops stay under the islands' rims, so a view
 * across the archipelago never looks through a cloud) and thin out with distance into the painted panorama's sea.
 * Without the atlas (offline, a test page) the field is not built. Seeded: every load grows the same sky.
 */
export const PUFFS = { count: 420, ring: [15, 560], y: [-30, -6], size: [18, 46], fade: [520, 820], centre: [0, -100], cells: [4, 2] } as const;

export function cumulus(sun: Vector3, atlas: Texture): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  let a = 9317 >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const base = new PlaneGeometry(2, 2), g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  const n = PUFFS.count, at = new Float32Array(n * 4), cell = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2, r = PUFFS.ring[0] + (PUFFS.ring[1] - PUFFS.ring[0]) * Math.sqrt(rnd());
    const size = PUFFS.size[0] + (PUFFS.size[1] - PUFFS.size[0]) * rnd() ** 1.3;
    at.set([PUFFS.centre[0] + Math.cos(ang) * r, PUFFS.y[0] + (PUFFS.y[1] - PUFFS.y[0]) * rnd(), PUFFS.centre[1] + Math.sin(ang) * r, size], i * 4);
    const k = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    cell.set([k % PUFFS.cells[0], Math.floor(k / PUFFS.cells[0])], i * 2);
  }
  g.setAttribute('aAt', new InstancedBufferAttribute(at, 4)); g.setAttribute('aCell', new InstancedBufferAttribute(cell, 2)); g.instanceCount = n;
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sun }, uAtlas: { value: atlas } },
    vertexShader: /* glsl */`
      attribute vec4 aAt; attribute vec2 aCell; varying vec2 vUv; varying float vFade; varying float vToSun;
      uniform vec3 uSun;
      void main(){
        vec3 toCam = normalize(cameraPosition - aAt.xyz);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
        // an atlas cell is 3:4 (384 x 512 of the 4 x 2 sheet); row 0 is the sheet's top row
        vec3 world = aAt.xyz + (right * position.x * 0.75 + up * position.y) * aAt.w;
        vec2 inCell = position.xy * 0.5 + 0.5;
        vUv = vec2((aCell.x + inCell.x) / ${PUFFS.cells[0].toFixed(1)}, 1.0 - (aCell.y + 1.0 - inCell.y) / ${PUFFS.cells[1].toFixed(1)});
        float d = length(aAt.xz - cameraPosition.xz);
        vFade = 1.0 - smoothstep(${PUFFS.fade[0].toFixed(1)}, ${PUFFS.fade[1].toFixed(1)}, d);
        vToSun = max(dot(-toCam, uSun), 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; varying vec2 vUv; varying float vFade; varying float vToSun;
      void main(){
        vec3 t = texture2D(uAtlas, vUv).rgb;
        float lum = dot(t, vec3(0.3, 0.59, 0.11)), body = smoothstep(0.05, 0.32, lum);
        float alpha = body * vFade;
        if (alpha < 0.01) discard;
        // un-premultiply the black matte, then a touch of rim gold when the sun is behind the cloud
        vec3 c = t / max(body, 0.35);
        c += vec3(1.0, 0.78, 0.45) * pow(vToSun, 6.0) * (1.0 - smoothstep(0.3, 0.7, lum)) * 0.5;
        gl_FragColor = vec4(c, alpha);
      }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = -5; mesh.name = 'far.cumulus';
  return mesh;
}
