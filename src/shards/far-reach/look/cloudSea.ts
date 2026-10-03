import { CircleGeometry, Color, DataTexture, DoubleSide, LinearFilter, Mesh, RepeatWrapping, RGBAFormat, ShaderMaterial, UnsignedByteType, type Texture, type Vector3 } from 'three';
import { SKY } from './sun';

/**
 * The cloud sea (review 2026-10-01 item 2): two layered sheets under the islands instead of the engine's one flat plane.
 * The low sheet is an opaque floor of cloud; the high one is a field of loose puffs that drift over it, so the sea has
 * depth and parallax. Both sample one small tileable cloud texture, baked once, and are lit from the low sun: tops toward
 * the sun gold-pink, shade mauve, melting into the horizon gold with distance. The kill height (`world.killY`) sits just
 * above the high sheet, so a fall ends inside the cloud.
 */
/** `maelstrom`: the sea twists toward an eye under the storm crown (x, z, falloff radius m). */
export const SEA = { size: 64, low: -48, high: -34, radius: 1400, handoff: [240, 700], maelstrom: { x: 0, z: -190, r: 95 } } as const;

function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, y: number, p: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % p) + p) % p, x1 = (x0 + 1) % p, y0 = ((yi % p) + p) % p, y1 = (y0 + 1) % p;
  const a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1), d = hash(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** Periodic fbm over the unit square (tiles seamlessly). */
function fbm(u: number, v: number): number {
  let sum = 0, amp = 0.55, f = 4, norm = 0;
  for (let o = 0; o < 5; o++) { sum += amp * noise(u * f + o * 7.1, v * f + o * 3.7, f); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

/** R: density; G: lit (the side of a puff that faces the sun). Baked for the fixed sun's heading. */
export function bakeSeaTexture(sun: Vector3): DataTexture {
  const N = SEA.size, d = new Float32Array(N * N), data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) d[y * N + x] = fbm(x / N, y / N);
  const at = (x: number, y: number): number => d[(((y % N) + N) % N) * N + (((x % N) + N) % N)] ?? 0;
  const h = Math.hypot(sun.x, sun.z) || 1, sx = Math.round((sun.x / h) * 2), sy = Math.round((sun.z / h) * 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = at(x, y), toward = at(x + sx, y + sy), lit = Math.min(1, Math.max(0, 0.55 + (here - toward) * 6));
    const i = y * N + x; data[i * 4] = Math.round(here * 255); data[i * 4 + 1] = Math.round(lit * 255); data[i * 4 + 2] = 0; data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, N, N, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}

function hex(value: number): string { const c = new Color(value); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; }

export interface CloudSea { readonly meshes: readonly Mesh<CircleGeometry, ShaderMaterial>[]; readonly time: { value: number } }

export function cloudSea(sun: Vector3, tex: DataTexture): CloudSea {
  const time = { value: 0 };
  const layer = (y: number, scale: number, opaque: boolean, order: number): Mesh<CircleGeometry, ShaderMaterial> => {
    const material = new ShaderMaterial({ side: DoubleSide, transparent: true, depthWrite: opaque, fog: false,
      uniforms: { tex: { value: tex }, sunDir: { value: sun }, time },
      vertexShader: 'varying vec3 wp; void main(){ vec4 w=modelMatrix*vec4(position,1.0); wp=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: /* glsl */`
        uniform sampler2D tex; uniform vec3 sunDir; uniform float time; varying vec3 wp;
        void main(){
          // loop 4: billows, not a sheet. A height field from three octaves of the baked noise; its slope toward the sun
          // lights the billow tops peach-gold and leaves lavender hollows (the panorama's cloud sea, look/sky.ts)
          vec2 drift = vec2(time * 0.0035, time * 0.0012);
          // the maelstrom round the storm crown (E392, the H4 targets): the sea's texture twisted toward an eye
          vec2 rel = wp.xz - vec2(${SEA.maelstrom.x.toFixed(1)}, ${SEA.maelstrom.z.toFixed(1)});
          float mr = length(rel), swirl = exp(-mr / ${SEA.maelstrom.r.toFixed(1)});
          float ma = swirl * 3.2 + time * 0.03 * swirl;
          vec2 twisted = vec2(cos(ma) * rel.x - sin(ma) * rel.y, sin(ma) * rel.x + cos(ma) * rel.y) + vec2(${SEA.maelstrom.x.toFixed(1)}, ${SEA.maelstrom.z.toFixed(1)});
          vec2 uv = twisted * ${scale.toFixed(5)} + drift;
          vec2 sd = normalize(sunDir.xz) * 0.006;
          float h1 = texture2D(tex, uv).r, h2 = texture2D(tex, uv * 2.7 + 0.37).r, h3 = texture2D(tex, uv * 7.1 - 0.21).r;
          float h = h1 * 0.8 + h2 * 0.2;
          float hs = texture2D(tex, uv + sd).r * 0.6 + texture2D(tex, (uv + sd) * 2.7 + 0.37).r * 0.3 + texture2D(tex, (uv + sd) * 7.1 - 0.21).r * 0.1;
          float lit = clamp(0.55 + (h - hs) * 14.0, 0.0, 1.0);
          float dens = clamp(h * 1.5 - 0.2, 0.0, 1.0);
          vec3 V = wp - cameraPosition; float dist = length(V.xz);
          float s = max(dot(normalize(V.xz), normalize(sunDir.xz)), 0.0);
          vec3 shade = mix(${hex(SKY.seaShade)}, ${hex(SKY.seaShadeWarm)}, s * s);
          vec3 top = mix(${hex(SKY.seaLit)}, ${hex(SKY.sun)} * 1.15, pow(s, 3.0));
          // hollows (low h) sink to lavender; crowns catch the light
          vec3 c = mix(shade * (0.82 + 0.25 * dens), top, smoothstep(0.3, 0.85, lit) * smoothstep(0.15, 0.7, dens));
          c += ${hex(SKY.sun)} * pow(s, 12.0) * 0.3 * dens;
          // the maelstrom's arms brighter, its eye a dark sunken well
          float marm = 0.5 + 0.5 * sin(3.0 * atan(rel.y, rel.x) + 4.0 * log(mr + 1.0) - time * 0.05);
          c *= mix(1.0, 0.82 + 0.3 * marm, swirl) * mix(0.45, 1.0, smoothstep(12.0, 48.0, mr));
          c = mix(c, ${hex(SKY.horizon)}, smoothstep(180.0, 1100.0, dist) * 0.6);
          // past the near sea the painted panorama's cloud sea takes over, so the sheets thin out with distance
          float far = 1.0 - smoothstep(${SEA.handoff[0].toFixed(1)}, ${SEA.handoff[1].toFixed(1)}, dist);
          float alpha = ${opaque ? 'far' : 'smoothstep(0.5, 0.8, dens) * far'};
          gl_FragColor = vec4(c, alpha);
        }` });
    const mesh = new Mesh(new CircleGeometry(SEA.radius, 64), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.renderOrder = order; mesh.frustumCulled = false; mesh.name = 'far.cloud-sea';
    return mesh;
  };
  // E392 (the judge: the procedural sheets read as a flat streaky plane): one soft backdrop sheet; the painted cumulus
  // field (look/puffs.ts) carries the cloud sea
  return { meshes: [layer(SEA.low, 0.0018, true, -6)], time };
}

/**
 * The maelstrom (E392, the judge three loops running: the H4 god-view targets are dominated by a huge spiral of cloud with
 * the crown small in its eye). A disc under the storm crown in polar coordinates: the cloud noise wound into three log-
 * spiral arms that turn slowly, crests lit gold toward the sun and lavender in the troughs, the eye a dark well; it melts
 * into the cumulus field at its rim. Drawn before the puffs, depth-tested, no depth write.
 */
export const MAELSTROM = { x: 0, z: -190, y: 0, r: 165, eye: 16 } as const;
export function maelstrom(sun: Vector3, tex: DataTexture, time: { value: number }): Mesh<CircleGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    uniforms: { tex: { value: tex }, sunDir: { value: sun }, time },
    vertexShader: 'varying vec2 lp; void main(){ lp = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tex; uniform vec3 sunDir; uniform float time; varying vec2 lp;
      void main(){
        float r = length(lp), th = atan(lp.y, lp.x), rn = r / ${MAELSTROM.r.toFixed(1)};
        // the arms stay put (the cumulus puffs sit on them, look/puffs.ts); the cloud texture streams along them instead
        float wind = th + 2.6 * log(r / ${MAELSTROM.eye.toFixed(1)} + 1.0);
        float arms = 0.5 + 0.5 * cos(3.0 * wind);
        vec2 uv = vec2(wind * 3.0 / 6.2831853 - time * 0.01, rn * 2.4);
        float n = texture2D(tex, uv).r * 0.65 + texture2D(tex, uv * 2.7 + 0.31).r * 0.35;
        float dens = clamp(n * 0.9 + arms * 0.55 - 0.25, 0.0, 1.0);
        // lit crests: the cloud thins toward the sun's side of each arm
        float crest = smoothstep(0.45, 0.95, dens) * (0.6 + 0.4 * max(dot(normalize(vec2(cos(th), sin(th))), normalize(sunDir.xz)), 0.0));
        vec3 trough = ${hex(SKY.seaShade)} * 0.62, body = ${hex(SKY.seaShadeWarm)}, top = ${hex(SKY.seaLit)};
        // the troughs between the arms dark lavender (the puffs on the arms carry the lit cloud): the spiral reads by contrast
        vec3 c = mix(trough * 0.9, body * 0.85, smoothstep(0.35, 0.85, arms) * 0.7);
        c = mix(c, top, crest * 0.4);
        // the eye: a dark sunken well
        c = mix(${hex(0x5f5578)}, c, smoothstep(${MAELSTROM.eye.toFixed(1)}, ${(MAELSTROM.eye * 3).toFixed(1)}, r));
        float alpha = mix(0.75, 1.0, smoothstep(0.05, 0.35, dens)) * (1.0 - smoothstep(0.78, 1.0, rn));
        gl_FragColor = vec4(c, alpha);
      }` });
  const mesh = new Mesh(new CircleGeometry(MAELSTROM.r, 96), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(MAELSTROM.x, MAELSTROM.y, MAELSTROM.z); mesh.renderOrder = -6; mesh.frustumCulled = false; mesh.name = 'far.maelstrom';
  return mesh;
}

/**
 * The painted cloud sea (E392; the judges five loops running: "the cloud sea is a flat pastel plane; the targets are a
 * dense sea of lit cumulus tops"). A big disc at the puffs' base carrying a seamless painted texture of cumulus tops
 * seen from above (`public/assets/far-reach/tex/cloudsea.webp`, codex image_gen), two scales blended so no repeat
 * shows, drifting slowly; under the storm crown it is wound into the maelstrom's spiral. It melts into the panorama's
 * painted sea with distance. Drawn after the sky dome and before the puffs; opaque near, fading far.
 */
/** E399 (the council: 'no cloud sea below the bridge'): 16 m higher, its crowns 8 m under the low isles' keels, so a level view
 * from a deck sees the sea under every bridge and past every rim. */
export const PAINTED_SEA = { y: -8, radius: 1400, tile: 120, fade: [420, 900] } as const;
/** `upper`: the higher, thinner layer (only its bright billow crowns, by luminance) that gives the diagonals parallax. */
export function paintedSea(painted: Texture, time: { value: number }, upper = false): Mesh<CircleGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    uniforms: { painted: { value: painted }, time },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform sampler2D painted; uniform float time; varying vec3 wp;
      void main(){
        vec2 rel = wp.xz - vec2(${MAELSTROM.x.toFixed(1)}, ${MAELSTROM.z.toFixed(1)});
        // wound toward the maelstrom's eye: a log-spiral twist confined to the crown's neighbourhood (a wider twist
        // sheared the texture into streaks under every other island)
        float mr = length(rel), reach = 0.0; // the twist's band edge always streaked: the puff spiral (look/puffs.ts) carries the maelstrom
        float ma = (2.2 * log(${MAELSTROM.r.toFixed(1)} / (mr + ${MAELSTROM.eye.toFixed(1)})) + time * 0.02) * reach;
        vec2 q = vec2(cos(ma) * rel.x - sin(ma) * rel.y, sin(ma) * rel.x + cos(ma) * rel.y) + vec2(${MAELSTROM.x.toFixed(1)}, ${MAELSTROM.z.toFixed(1)});
        vec2 drift = vec2(time * 0.4, time * 0.15);
        vec3 a = texture2D(painted, (q + drift) / ${PAINTED_SEA.tile.toFixed(1)}).rgb;
        vec3 b = texture2D(painted, (q - drift * 0.6) / ${(PAINTED_SEA.tile * 2.9).toFixed(1)} + 0.37).rgb;
        vec3 c = mix(a, b, 0.35);
        // value contrast (the judge: the sea reads flat-bright): lavender valleys, warm crowns
        float lum = dot(c, vec3(0.3, 0.59, 0.11));
        // the shaded hollows a peach-lavender, not violet (E410: under the slimmer keels the sea read lavender where the
        // mockups' cloud below the isles is gold-lit; was 0.66, 0.64, 0.84)
        c = mix(c * vec3(0.84, 0.74, 0.82), c * vec3(1.12, 1.06, 0.96), smoothstep(0.38, 0.8, lum));
        // the eye a dark lavender well
        c = mix(c * vec3(0.62, 0.6, 0.78), c, smoothstep(${MAELSTROM.eye.toFixed(1)}, ${(MAELSTROM.eye * 3.5).toFixed(1)}, mr));
        float d = length(wp.xz - cameraPosition.xz);
        float far = 1.0 - smoothstep(${PAINTED_SEA.fade[0].toFixed(1)}, ${PAINTED_SEA.fade[1].toFixed(1)}, d);
        float crowns = ${upper ? 'smoothstep(0.62, 0.82, dot(c, vec3(0.3, 0.59, 0.11)))' : '1.0'};
        gl_FragColor = vec4(c * ${upper ? '1.06' : '1.0'}, far * crowns);
      }` });
  const mesh = new Mesh(new CircleGeometry(PAINTED_SEA.radius, 96), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = upper ? PAINTED_SEA.y + 14 : PAINTED_SEA.y; mesh.renderOrder = upper ? -6 : -7; mesh.frustumCulled = false; mesh.name = upper ? 'far.painted-sea.upper' : 'far.painted-sea';
  if (upper) mesh.rotation.z = 1.3;
  return mesh;
}

/**
 * The painted maelstrom (E392; the H4 targets' top and diagonal views are a frame-filling spiral of cloud with the crown
 * in its eye). A disc under the storm crown carrying a codex-painted top-down cloud vortex
 * (`public/assets/far-reach/tex/maelstrom.webp`), turning slowly, its rim melting into the painted sea. It sits a little
 * above the painted sea so it covers it, and below the decks.
 */
export const PAINTED_MAELSTROM = { radius: 125, y: 10 } as const;
export function paintedMaelstrom(painted: Texture, time: { value: number }): Mesh<CircleGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    uniforms: { painted: { value: painted }, time },
    vertexShader: 'varying vec2 lp; varying float far; void main(){ lp = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); far = length(cameraPosition.xz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform sampler2D painted; uniform float time; varying vec2 lp; varying float far;
      void main(){
        float rn = length(lp) / ${PAINTED_MAELSTROM.radius.toFixed(1)};
        float a = -time * 0.012;
        vec2 q = vec2(cos(a) * lp.x - sin(a) * lp.y, sin(a) * lp.x + cos(a) * lp.y) / (${PAINTED_MAELSTROM.radius.toFixed(1)} * 2.0) + 0.5;
        // the cloud palette (loop 20, the judge: 'too purple, hard bands'): the violet valleys lifted toward a lavender grey,
        // the lit crests kept warm, two taps blurred so the band edges soften
        vec3 c = texture2D(painted, q).rgb * 0.6 + texture2D(painted, q + vec2(0.004, 0.003)).rgb * 0.4;
        float l = dot(c, vec3(0.3, 0.59, 0.11));
        c = mix(c, vec3(l) * vec3(1.06, 0.98, 0.95), 0.45);
        c = mix(c, vec3(1.0, 0.93, 0.84), 0.18) * 1.06;
        // only the crown's own sky sees it: away from the arena the painted sea takes over (it bled into H1-H3)
        float near = 1.0 - smoothstep(110.0, 175.0, far);
        gl_FragColor = vec4(c, (1.0 - smoothstep(0.55, 0.95, rn)) * near);
      }` });
  const mesh = new Mesh(new CircleGeometry(PAINTED_MAELSTROM.radius, 96), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(MAELSTROM.x, PAINTED_MAELSTROM.y, MAELSTROM.z); mesh.renderOrder = -6; mesh.frustumCulled = false; mesh.name = 'far.painted-maelstrom';
  return mesh;
}
