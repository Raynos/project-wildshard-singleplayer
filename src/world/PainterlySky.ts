/**
 * The painterly sky's clouds (Nalati, style B — look pass lever 3; look-director).
 *
 * The mockups live on their skies: big cel-shaded cumulus heaped round the horizon behind the snow range (warm lit
 * tops, flat blue-grey bellies, a silver edge toward the sun), small fair-weather puffs higher up, deep clean blue at
 * the zenith. Two transparent layers, both centred on the camera (Game.ts keeps `sky.clouds` there), both past the
 * far horizon ring (radius `CLOUD_R`) so the mountains always stand in front of them:
 *
 *   · the cumulus BANK — a sphere band from just under the horizon to `EL_MAX` elevation, textured with a cumulus
 *     atlas made at boot: clusters of spheres ("billows", bigger low, smaller stacked up the tower, a flat base)
 *     rasterised as a height-field union → RG = the billow normal, B = occlusion (bellies darker), A = coverage.
 *     The shader lights that normal with the sun through soft cel bands, so the clouds re-light with the day clock.
 *   · the high PUFFS — the old planar cloud layer (a tileable fbm), thresholded into sparse puffs, cel-lit from the
 *     density gradient.
 *
 *   const clouds = buildPainterlyClouds(cloudUniforms, hazeColor);   // → THREE.Group (Sky.clouds for a painted sky)
 *
 * `cloudUniforms` is Sky's shared set (uTime, uSunDir, uSunColor, uLight — the day/night rig drives them through
 * `sky.setCloudLight`), plus `uDrift` (xy, the wind drift in uv, advanced by Sky.update).
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';

/** the cloud layers' radius: past the far horizon ring (2450 m) and inside the camera's far plane (2600 m) */
export const CLOUD_R = 2520;
/** the bank's top elevation, degrees */
const EL_MAX = 30;

export interface CloudUniforms {
  uTime: THREE.IUniform<number>;
  uSunDir: THREE.IUniform<THREE.Vector3>;
  uSunColor: THREE.IUniform<THREE.Color>;
  uLight: THREE.IUniform<THREE.Color>;
  uDrift: THREE.IUniform<THREE.Vector2>;
}

interface Cluster { x: number; base: number; w: number; h: number }

/**
 * Rasterise cumulus clusters into a W×H atlas: each cluster is a union of spheres ("billows") — most low and wide,
 * a few stacked up a narrowing tower, cut flat at the base — drawn as a height field (the front-most billow wins):
 * RG = its normal (x right, y up), B = occlusion (the belly darker than the crown), A = coverage (anti-aliased).
 * Sizes are in pixels. `wrapY` wraps rows too (a tileable sheet); x always wraps.
 */
function rasterCumulus(W: number, H: number, clusters: Cluster[], rng: Rng, wrapY: boolean, billowsPerPx: number, billowSize: number): THREE.DataTexture {
  const data = new Uint8Array(W * H * 4);
  const zbuf = new Float32Array(W * H).fill(-1e9);
  for (const c of clusters) {
    const n = Math.round(12 + c.w * billowsPerPx);
    for (let k = 0; k < n; k++) {
      const t = rng.next() ** 1.25;                                 // most billows low, a few up the tower
      const spread = (1 - t * 0.7) * 0.5;                           // the tower narrows as it climbs
      const x = c.x + (rng.next() * 2 - 1) * c.w * spread;
      const r = c.w * (billowSize - t * billowSize * 0.46) * (0.55 + rng.next() * 0.9); // cauliflower: many small billows
      const y = c.base + r * 0.35 + t * c.h;
      const zOff = (1 - t) * r * 0.4 + rng.next() * r * 0.3;        // lower billows sit a little in front
      stamp(x, y, r, zOff, c.base, c.h);
    }
  }
  function stamp(x: number, y: number, r: number, zOff: number, base: number, h: number): void {
    const x0 = Math.floor(x - r - 1), x1 = Math.ceil(x + r + 1);
    let y0 = Math.max(Math.floor(base), Math.floor(y - r - 1)), y1 = Math.ceil(y + r + 1);
    if (!wrapY) { y0 = Math.max(0, y0); y1 = Math.min(H - 1, y1); }
    for (let pyi = y0; pyi <= y1; pyi++) {
      const dy = pyi + 0.5 - y;
      const py = ((pyi % H) + H) % H;
      for (let pxi = x0; pxi <= x1; pxi++) {
        const dx = pxi + 0.5 - x;
        const d2 = dx * dx + dy * dy;
        const edge = r - Math.sqrt(d2);
        if (edge <= -1) continue;
        const px = ((pxi % W) + W) % W;
        const i = py * W + px;
        const hgt = Math.sqrt(Math.max(0, r * r - d2)) + zOff;
        const a = Math.min(1, edge + 1) * Math.min(1, pyi + 0.5 - base + 0.5); // anti-aliased rim and flat base
        const o = i * 4;
        if (hgt > (zbuf[i] ?? 0)) {
          zbuf[i] = hgt;
          data[o] = Math.round((dx / r * 0.5 + 0.5) * 255);
          data[o + 1] = Math.round((dy / r * 0.5 + 0.5) * 255);
          data[o + 2] = Math.round(Math.min(1, 0.45 + 0.55 * Math.max(0, (pyi - base) / Math.max(1, h * 0.8))) * 255); // bellies darker
        }
        data[o + 3] = Math.max(data[o + 3] ?? 0, Math.round(a * 255));
      }
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = wrapY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The horizon bank's atlas: u = compass azimuth 0..360° (0 = north = +z, 90 = east = −x), v = elevation 0..EL_MAX
 * (row 0 at the horizon). Clusters are denser toward the south (the snow range, the planet) where the mockups heap them.
 */
function makeCumulusAtlas(seed: number): THREE.DataTexture {
  const W = 4096, H = 340, pxDeg = W / 360; // ≈ 11.4 px per degree, both axes (H covers EL_MAX)
  const rng = new Rng(seed);
  const clusters: Cluster[] = [];
  for (let i = 0; i < 26; i++) {
    const south = i < 13;
    const az = south ? 100 + rng.next() * 180 : rng.next() * 360;
    clusters.push({ x: az * pxDeg, base: (3 + rng.next() * (south ? 6 : 9)) * pxDeg, w: ((south ? 7 : 4) + rng.next() * (south ? 12 : 8)) * pxDeg, h: ((south ? 5 : 3) + rng.next() * (south ? 11 : 5)) * pxDeg });
  }
  return rasterCumulus(W, H, clusters, rng, false, 3 / pxDeg, 0.13);
}

/** the high puffs' sheet: a tileable scatter of small fair-weather cumulus (planar-projected on the upper sky) */
function makePuffSheet(seed: number): THREE.DataTexture {
  const N = 1024;
  const rng = new Rng(seed ^ 0x9e37);
  const clusters: Cluster[] = [];
  for (let i = 0; i < 22; i++) clusters.push({ x: rng.next() * N, base: rng.next() * N, w: 30 + rng.next() * 70, h: 10 + rng.next() * 30 });
  return rasterCumulus(N, N, clusters, rng, true, 0.35, 0.16);
}

/** the soft three-band cloud ramp + colours shared by both layers (GLSL) */
const CLOUD_LIGHT = /* glsl */`
  uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uLight; uniform vec3 uHaze;
  vec3 cloudLight( vec3 N, vec3 d, float occ ) {
    float l = dot( N, uSunDir ) * 0.5 + 0.5;                                  // wrapped: clouds scatter
    float band = 0.4 * smoothstep( 0.4, 0.46, l ) + 0.6 * smoothstep( 0.6, 0.66, l );
    vec3 shade = vec3( 0.46, 0.55, 0.76 );                                   // blue-grey bellies
    vec3 lit = vec3( 1.32, 1.26, 1.14 ) * mix( vec3( 1.0 ), uSunColor, 0.5 ); // warm white tops
    vec3 c = mix( shade, lit, band ) * ( 0.66 + 0.34 * occ );
    // the silver lining: toward the sun the thin edges glow
    float toward = pow( max( dot( d, uSunDir ), 0.0 ), 6.0 );
    c += uSunColor * toward * 0.5;
    return c * uLight;
  }
`;

export function buildPainterlyClouds(u: CloudUniforms, haze: THREE.Color, seed = 0x5c1d): THREE.Group {
  const group = new THREE.Group();
  group.name = 'painterly-clouds';
  const hazeU = { value: haze.clone() };

  // ── the cumulus bank ──
  const atlas = makeCumulusAtlas(seed);
  const d2r = Math.PI / 180;
  // polar angle from +y: EL_MAX … −2° elevation
  const bankGeo = new THREE.SphereGeometry(CLOUD_R, 96, 10, 0, Math.PI * 2, (90 - EL_MAX - 1) * d2r, (EL_MAX + 3) * d2r);
  const bank = new THREE.Mesh(bankGeo, new THREE.ShaderMaterial({
    uniforms: { ...u, tAtlas: { value: atlas }, uHaze: hazeU, uElMax: { value: EL_MAX * d2r } },
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tAtlas; uniform float uElMax; uniform vec2 uDrift;
      ${CLOUD_LIGHT}
      varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        float el = asin( clamp( d.y, -1.0, 1.0 ) );
        float az = atan( -d.x, d.z ) / 6.2831853;
        vec4 a = texture2D( tAtlas, vec2( az + uDrift.x * 0.02, el / uElMax ) );
        float alpha = a.a * smoothstep( -0.012, 0.03, el );
        if ( alpha < 0.004 ) discard;
        vec2 nxy = a.rg * 2.0 - 1.0;
        float nz = sqrt( max( 0.0, 1.0 - dot( nxy, nxy ) ) );
        vec3 T = normalize( cross( d, vec3( 0.0, 1.0, 0.0 ) ) );
        vec3 U = cross( T, d );
        vec3 N = normalize( T * nxy.x + U * nxy.y - d * nz );
        vec3 c = cloudLight( N, d, a.b );
        // the low bank sinks into the horizon haze (aerial perspective of the sky)
        c = mix( c, uHaze * uLight, smoothstep( 0.16, 0.0, el ) * 0.55 );
        gl_FragColor = vec4( c, alpha );
      }`,
  }));
  bank.renderOrder = -9;
  bank.frustumCulled = false;
  bank.name = 'cumulus-bank';

  // ── the high puffs ──
  const sheet = makePuffSheet(seed);
  const domeGeo = new THREE.SphereGeometry(CLOUD_R, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const dome = new THREE.Mesh(domeGeo, new THREE.ShaderMaterial({
    uniforms: { ...u, tSheet: { value: sheet }, uHaze: hazeU },
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tSheet; uniform float uTime; uniform vec2 uDrift;
      ${CLOUD_LIGHT}
      varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        if ( d.y < 0.2 ) discard;                                   // the low sky belongs to the bank
        vec2 p = d.xz / ( d.y + 0.25 ) * 0.42 + uDrift;
        vec4 a = texture2D( tSheet, p );
        float alpha = a.a * smoothstep( 0.2, 0.36, d.y );
        if ( alpha < 0.004 ) discard;
        vec2 nxy = a.rg * 2.0 - 1.0;
        float nz = sqrt( max( 0.0, 1.0 - dot( nxy, nxy ) ) );
        vec3 T = normalize( cross( d, vec3( 0.0, 1.0, 0.0 ) ) );
        vec3 U = cross( T, d );
        vec3 N = normalize( T * nxy.x + U * nxy.y - d * nz );
        gl_FragColor = vec4( cloudLight( N, d, a.b ), alpha );
      }`,
  }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.name = 'cloud-puffs';

  group.add(dome, bank);
  group.userData['haze'] = hazeU;
  return group;
}
