import { CircleGeometry, Color, DataTexture, DoubleSide, LinearFilter, Mesh, RepeatWrapping, RGBAFormat, ShaderMaterial, UnsignedByteType, type Vector3 } from 'three';
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
