import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, type Texture, type Vector3 } from 'three';

/**
 * Cumulus over the cloud sea (E392; the targets: the islands rise out of a sea of sunlit billowing cloud). A field of
 * camera-facing billboards, one draw, each showing one of eight painted golden-hour cumulus puffs from an atlas
 * (`public/assets/far-reach/tex/clouds.webp`, codex image_gen, `art/far-reach/round-17-mockup-loop/textures/`: puffs on
 * black, so the brightness is the alpha). They sit below the decks (the tops stay under the islands' rims, so a view
 * across the archipelago never looks through a cloud) and thin out with distance into the painted panorama's sea.
 * Without the atlas (offline, a test page) the field is not built. Seeded: every load grows the same sky.
 */
/** `spiral`: puffs laid on three log-spiral arms round the storm crown, under its deck (the H4 god-view targets). */
export const PUFFS = { spiral: { count: 0, x: 0, z: -190, y: [-12, 20], r: [24, 100] }, count: 380, ring: [10, 600], y: [-6, 18], size: [24, 62], fade: [520, 820], centre: [0, -100], cells: [4, 2], bankFade: 0.62 } as const;

/**
 * `keelPuffs`: [x, y, z, size] puffs hugging the islands' undersides (the targets' clouds wrap the keels). `banks`: the
 * cumulus between and beyond the sky isles at several depths (E407 top-10 row 5; look/render.ts cloudBanks).
 */
export function cumulus(sun: Vector3, atlas: Texture, keelPuffs: readonly (readonly [number, number, number, number])[] = [], banks: readonly (readonly [number, number, number, number])[] = []): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  let a = 9317 >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const base = new PlaneGeometry(2, 2), g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  const ns = PUFFS.spiral.count, nk = keelPuffs.length, nb = banks.length, n = PUFFS.count + ns + nk + nb, at = new Float32Array(n * 4), cell = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    let ang = rnd() * Math.PI * 2, r = PUFFS.ring[0] + (PUFFS.ring[1] - PUFFS.ring[0]) * Math.sqrt(rnd());
    // clear of the maelstrom (look/cloudSea.ts MAELSTROM) so its spiral reads from above: pushed out past its rim
    for (let tries = 0; tries < 6 && Math.hypot(PUFFS.centre[0] + Math.cos(ang) * r - PUFFS.spiral.x, PUFFS.centre[1] + Math.sin(ang) * r - PUFFS.spiral.z) < 150; tries++) { ang = rnd() * Math.PI * 2; r = PUFFS.ring[0] + (PUFFS.ring[1] - PUFFS.ring[0]) * Math.sqrt(rnd()); }
    const size = PUFFS.size[0] + (PUFFS.size[1] - PUFFS.size[0]) * rnd() ** 1.3;
    // the puff's top (its centre + its height) stays under the decks: a tall one sat in front of every first-person view
    const y = Math.min(PUFFS.y[0] + (PUFFS.y[1] - PUFFS.y[0]) * rnd(), 30 - size);
    at.set([PUFFS.centre[0] + Math.cos(ang) * r, y, PUFFS.centre[1] + Math.sin(ang) * r, size], i * 4);
    const k = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    cell.set([k % PUFFS.cells[0], Math.floor(k / PUFFS.cells[0])], i * 2);
  }
  for (let i = 0; i < ns; i++) {
    const k = PUFFS.count + i, f = i / ns, arm = i % 3, rr = PUFFS.spiral.r[0] + (PUFFS.spiral.r[1] - PUFFS.spiral.r[0]) * f;
    // on the disc's arms (look/cloudSea.ts maelstrom: 3 arms, wind = th + 2.6 log(r / eye + 1)), tight to them
    // (the disc lies in local x / y turned onto the ground, so its angle is the world angle mirrored: the log term's sign flips)
    const ang = arm * (Math.PI * 2 / 3) + 2.6 * Math.log(rr / 16 + 1) + (rnd() - 0.5) * 0.22;
    // a funnel: the eye sinks, the walls rise outward toward the crown's base (the H4 targets' maelstrom)
    at.set([PUFFS.spiral.x + Math.cos(ang) * rr, PUFFS.spiral.y[0] + (PUFFS.spiral.y[1] - PUFFS.spiral.y[0]) * Math.min(1, f * 1.4) ** 0.8 * (0.6 + 0.4 * rnd()), PUFFS.spiral.z + Math.sin(ang) * rr, 16 + rnd() * 18 + f * 20], k * 4);
    const c = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]); cell.set([c % PUFFS.cells[0], Math.floor(c / PUFFS.cells[0])], k * 2);
  }
  keelPuffs.forEach((k, i) => {
    const j = PUFFS.count + ns + i, c = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    at.set([k[0], k[1], k[2], k[3]], j * 4); cell.set([c % PUFFS.cells[0], Math.floor(c / PUFFS.cells[0])], j * 2);
  });
  banks.forEach((k, i) => {
    const j = PUFFS.count + ns + nk + i, c = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    at.set([k[0], k[1], k[2], k[3]], j * 4); cell.set([c % PUFFS.cells[0], Math.floor(c / PUFFS.cells[0])], j * 2);
  });
  // a bank's fade distance is stretched by its own reach (the far layers stay; the field thins out as before)
  const far = new Float32Array(n).fill(1); for (let i = 0; i < nb; i++) far[PUFFS.count + ns + nk + i] = PUFFS.bankFade;
  g.setAttribute('aFar', new InstancedBufferAttribute(far, 1));
  g.setAttribute('aAt', new InstancedBufferAttribute(at, 4)); g.setAttribute('aCell', new InstancedBufferAttribute(cell, 2)); g.instanceCount = n;
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sun }, uAtlas: { value: atlas } },
    vertexShader: /* glsl */`
      attribute vec4 aAt; attribute vec2 aCell; attribute float aFar; varying vec2 vUv; varying float vFade; varying float vToSun;
      uniform vec3 uSun;
      void main(){
        vec3 toCam = normalize(cameraPosition - aAt.xyz);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
        // an atlas cell is 3:4 (384 x 512 of the 4 x 2 sheet); row 0 is the sheet's top row
        vec3 world = aAt.xyz + (right * position.x * 0.75 + up * position.y) * aAt.w;
        vec2 inCell = position.xy * 0.5 + 0.5;
        vUv = vec2((aCell.x + inCell.x) / ${PUFFS.cells[0].toFixed(1)}, 1.0 - (aCell.y + 1.0 - inCell.y) / ${PUFFS.cells[1].toFixed(1)});
        float d = length(aAt.xz - cameraPosition.xz);
        vFade = 1.0 - smoothstep(${PUFFS.fade[0].toFixed(1)}, ${PUFFS.fade[1].toFixed(1)}, d * aFar);
        vToSun = max(dot(-toCam, uSun), 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; varying vec2 vUv; varying float vFade; varying float vToSun;
      void main(){
        vec3 t = texture2D(uAtlas, vUv).rgb;
        // the dark matte fringe is cut by alpha (no ink outline); the painted shading inside is kept
        float lum = dot(t, vec3(0.3, 0.59, 0.11)), body = smoothstep(0.24, 0.5, lum);
        float alpha = body * vFade;
        if (alpha < 0.01) discard;
        // contrast: lavender in the shaded bellies, the lit crowns warm (the targets' billows read one by one)
        float lit = smoothstep(0.35, 0.85, lum);
        vec3 c = mix(t * vec3(0.78, 0.76, 1.02), t * vec3(1.18, 1.12, 1.02), lit);
        // a touch of rim gold when the sun is behind the cloud
        c += vec3(1.0, 0.78, 0.45) * pow(vToSun, 6.0) * (1.0 - smoothstep(0.3, 0.7, lum)) * 0.5;
        gl_FragColor = vec4(c, alpha);
      }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = -5; mesh.name = 'far.cumulus';
  return mesh;
}
