import { Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, type Texture, type Vector3 } from 'three';

/**
 * Cumulus over the cloud sea (E392; the targets: the islands rise out of a sea of sunlit billowing cloud). A field of
 * camera-facing billboards, one draw, each showing one of eight volumetric cumulus from an atlas
 * (`public/assets/far-reach/tex/cumulus.webp`: E407 top-10 row 5, Cycles volumes rendered by
 * `scripts/blender/far-reach-clouds/clouds.py`, packed by its atlas.py; `art/far-reach/round-30-cumulus/`). Each cloud
 * is in the atlas twice, lit from behind the camera and from behind the cloud; a card blends the two by its view's angle
 * to the sun, so the clouds toward the low sun show the mockups' dark cores and silver rims, the rest their lit crowns.
 * The haze grows with distance (aerial perspective), so the layers separate. Most sit below the decks; `banks` are the
 * wide ones between and beyond the sky isles. Without the atlas (offline, a test page) the field is not built. Seeded:
 * every load grows the same sky.
 */
/** `spiral`: puffs laid on three log-spiral arms round the storm crown, under its deck (the H4 god-view targets). */
export const PUFFS = { spiral: { count: 0, x: 0, z: -190, y: [-12, 20], r: [24, 100] }, count: 380, ring: [10, 600], y: [-6, 18], size: [24, 62], fade: [520, 820], centre: [0, -100], cells: [4, 4], haze: [140, 760, 0.62] } as const;

type Puff = readonly [number, number, number, number];
/** A cloud of the atlas: `cell` 0..7, its column and its front-lit row (the back-lit one is the row under it). */
const cellOf = (cell: number): [number, number] => [cell % 4, Math.floor(cell / 4) * 2];

/**
 * `keelPuffs`: [x, y, z, size] puffs hugging the islands' undersides (the targets' clouds wrap the keels). `banks`: wide
 * low cumulus (the atlas' first four, the banks) between and beyond the sky isles. `haze`: the colour the far ones melt into.
 */
export function cumulus(sun: Vector3, atlas: Texture, keelPuffs: readonly Puff[] = [], banks: readonly Puff[] = [], haze: Color = new Color(0xf0c9b6)): Mesh<InstancedBufferGeometry, ShaderMaterial> {
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
    cell.set(cellOf(Math.floor(rnd() * 8)), i * 2);
  }
  for (let i = 0; i < ns; i++) {
    const k = PUFFS.count + i, f = i / ns, arm = i % 3, rr = PUFFS.spiral.r[0] + (PUFFS.spiral.r[1] - PUFFS.spiral.r[0]) * f;
    // on the disc's arms (look/cloudSea.ts maelstrom: 3 arms, wind = th + 2.6 log(r / eye + 1)), tight to them
    // (the disc lies in local x / y turned onto the ground, so its angle is the world angle mirrored: the log term's sign flips)
    const ang = arm * (Math.PI * 2 / 3) + 2.6 * Math.log(rr / 16 + 1) + (rnd() - 0.5) * 0.22;
    // a funnel: the eye sinks, the walls rise outward toward the crown's base (the H4 targets' maelstrom)
    at.set([PUFFS.spiral.x + Math.cos(ang) * rr, PUFFS.spiral.y[0] + (PUFFS.spiral.y[1] - PUFFS.spiral.y[0]) * Math.min(1, f * 1.4) ** 0.8 * (0.6 + 0.4 * rnd()), PUFFS.spiral.z + Math.sin(ang) * rr, 16 + rnd() * 18 + f * 20], k * 4);
    cell.set(cellOf(Math.floor(rnd() * 8)), k * 2);
  }
  keelPuffs.forEach((k, i) => {
    const j = PUFFS.count + ns + i;
    at.set([k[0], k[1], k[2], k[3]], j * 4); cell.set(cellOf(Math.floor(rnd() * 8)), j * 2);
  });
  banks.forEach((k, i) => {
    const j = PUFFS.count + ns + nk + i;
    at.set([k[0], k[1], k[2], k[3]], j * 4); cell.set(cellOf(Math.floor(rnd() * 4)), j * 2);
  });
  g.setAttribute('aAt', new InstancedBufferAttribute(at, 4)); g.setAttribute('aCell', new InstancedBufferAttribute(cell, 2)); g.instanceCount = n;
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sun }, uAtlas: { value: atlas }, uHaze: { value: haze } },
    vertexShader: /* glsl */`
      attribute vec4 aAt; attribute vec2 aCell; varying vec2 vUv; varying vec2 vUvBack; varying float vFade; varying float vBack; varying float vHaze;
      uniform vec3 uSun;
      void main(){
        vec3 toCam = normalize(cameraPosition - aAt.xyz);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
        // an atlas cell is 2:1 (512 x 256 of the 4 x 4 sheet); row 0 is the sheet's top row; the cloud's base sits a
        // tenth up its cell, so the card stands on aAt
        vec3 world = aAt.xyz + (right * position.x + up * (position.y + 0.8) * 0.5) * aAt.w;
        vec2 inCell = position.xy * 0.5 + 0.5;
        float u = (aCell.x + inCell.x) / ${PUFFS.cells[0].toFixed(1)};
        vUv = vec2(u, 1.0 - (aCell.y + 1.0 - inCell.y) / ${PUFFS.cells[1].toFixed(1)});
        vUvBack = vUv - vec2(0.0, 1.0 / ${PUFFS.cells[1].toFixed(1)});
        float d = length(aAt.xz - cameraPosition.xz);
        vFade = 1.0 - smoothstep(${PUFFS.fade[0].toFixed(1)}, ${PUFFS.fade[1].toFixed(1)}, d);
        vHaze = smoothstep(${PUFFS.haze[0].toFixed(1)}, ${PUFFS.haze[1].toFixed(1)}, d) * ${PUFFS.haze[2].toFixed(2)};
        // the back-lit render toward the sun, the front-lit one away from it
        vBack = smoothstep(-0.1, 0.85, dot(-toCam, uSun));
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; uniform vec3 uHaze; varying vec2 vUv; varying vec2 vUvBack; varying float vFade; varying float vBack; varying float vHaze;
      void main(){
        vec4 f = texture2D(uAtlas, vUv), b = texture2D(uAtlas, vUvBack);
        vec4 t = mix(f, b, vBack);
        float alpha = t.a * vFade;
        if (alpha < 0.01) discard;
        // the render's grey light to the golden hour: lavender in the shaded bellies, the lit crowns and the rims warm
        float lum = dot(t.rgb, vec3(0.2126, 0.7152, 0.0722)), lit = smoothstep(0.2, 0.75, lum);
        vec3 c = mix(vec3(0.74, 0.6, 0.74) * (0.5 + 0.6 * lum), vec3(1.0, 0.86, 0.68) * (0.7 + 0.42 * lum), lit);
        // toward the low sun the whole cloud glows warm through (the mockups' cumulus by the sun outshine the sky behind)
        c += vec3(1.0, 0.72, 0.4) * vBack * vBack * 0.3 * (1.0 - 0.5 * lit);
        // aerial perspective: the far banks melt into the haze, so the layers separate
        c = mix(c, uHaze, vHaze);
        gl_FragColor = vec4(c, alpha);
      }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = -5; mesh.name = 'far.cumulus';
  return mesh;
}
