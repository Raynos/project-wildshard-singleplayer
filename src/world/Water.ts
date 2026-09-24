import * as THREE from 'three';
import { POND, waterLevel, heightAt } from './Heightfield';
import { attachFogUniforms, fogUniforms } from './Atmosphere';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { Rng } from '../core/rng';
import { Noise2D } from '../core/noise';
import { SEED } from '../core/config';
import { createWaterMaterial, buildSkyline } from './waterSurface';
import { patchWindField } from './wind';
import type { TreeInstance } from './placement';

/** Mark a group/mesh so the pond's planar reflection skips it (grass, undergrowth, particles, twigs …). */
export function noReflect(o: THREE.Object3D): void { o.userData['noReflect'] = true; }

/** how the pond reflects: 'probe' (PH-L9, default: the clock's sky + the skyline probe, no extra pass) or 'planar' (the
 *  pre-remaster mirrored second scene render, `?pond=planar` — kept as the before for Jake's board) */
export type PondMode = 'probe' | 'planar';
export function pondMode(): PondMode {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('pond') === 'planar' ? 'planar' : 'probe';
}

// ── the lily pads ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ~110 lily pads in clusters on the pond's shallows (0.3–1.6 m), a few white water lilies among them: one static mesh in
 * world space (one draw), each pad turning and bobbing about its own centre on the shared wind (`windGustAt`).
 */
function buildLilies(sky: Sky): THREE.Mesh | null {
  const wl = waterLevel(), rng = new Rng(SEED + 4411), cluster = new Noise2D(SEED + 4412);
  const outlet = { x: -122, z: 86 }, fallFoot = { x: -88.3, z: 140 };
  const pads: { x: number; z: number; r: number; rot: number; flower: boolean; hue: number }[] = [];
  for (let i = 0; i < 6000 && pads.length < 110; i++) {
    const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * (POND.r + 8);
    const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d, depth = wl - heightAt(x, z);
    if (depth < 0.3 || depth > 1.6) continue;
    if (cluster.fbm(x * 0.07, z * 0.07, 2) < 0.18) continue;
    if (Math.hypot(x - outlet.x, z - outlet.z) < 10 || Math.hypot(x - fallFoot.x, z - fallFoot.z) < 10) continue;
    const r = rng.range(0.12, 0.27);
    if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.03)) continue;
    pads.push({ x, z, r, rot: rng.range(0, Math.PI * 2), flower: false, hue: rng.next() });
  }
  if (pads.length === 0) return null;
  for (let i = 0; i < pads.length; i += 13) { const p = pads[i]; if (p) p.flower = true; }
  const pos: number[] = [], col: number[] = [], nrm: number[] = [], pad: number[] = [];
  const vert = (x: number, y: number, z: number, c: readonly [number, number, number], n: readonly [number, number, number], p: { x: number; z: number }, ph: number): void => {
    pos.push(x, y, z); col.push(c[0], c[1], c[2]); nrm.push(n[0], n[1], n[2]); pad.push(p.x, p.z, ph);
  };
  const up = [0, 1, 0] as const;
  for (const p of pads) {
    const y0 = wl + 0.012, ph = p.hue * 40, segs = 14, notch = 0.32;
    const aged = p.hue > 0.86;
    const inner: [number, number, number] = aged ? [0.16, 0.11, 0.035] : [0.035 + p.hue * 0.02, 0.075 + p.hue * 0.03, 0.02];
    const rim: [number, number, number] = aged ? [0.22, 0.12, 0.04] : [0.055 + p.hue * 0.03, 0.11 + p.hue * 0.04, 0.03];
    const curl = p.hue > 0.6 ? 0.012 : 0.004;
    for (let s = 0; s < segs; s++) {
      const a0 = p.rot + notch / 2 + (s / segs) * (Math.PI * 2 - notch), a1 = p.rot + notch / 2 + ((s + 1) / segs) * (Math.PI * 2 - notch);
      const stripe = s % 2 === 0 ? 1 : 0.9;
      const r0: [number, number, number] = [rim[0] * stripe, rim[1] * stripe, rim[2] * stripe];
      vert(p.x, y0 + 0.003, p.z, inner, up, p, ph);
      vert(p.x + Math.cos(a1) * p.r, y0 + curl, p.z + Math.sin(a1) * p.r, r0, up, p, ph);
      vert(p.x + Math.cos(a0) * p.r, y0 + curl, p.z + Math.sin(a0) * p.r, r0, up, p, ph);
    }
    if (!p.flower) continue;
    // a white water lily: two rings of eight petals cupped upward round a yellow heart
    const fx = p.x + Math.cos(p.rot + Math.PI) * p.r * 0.3, fz = p.z + Math.sin(p.rot + Math.PI) * p.r * 0.3, fy = y0 + 0.015;
    const fc = { x: p.x, z: p.z };
    for (const [ring, len, lift, off] of [[0, 0.085, 0.45, 0], [1, 0.065, 0.95, Math.PI / 8]] as const) {
      for (let k = 0; k < 8; k++) {
        const a = off + (k / 8) * Math.PI * 2, w = 0.022, ca = Math.cos(a), sa = Math.sin(a);
        const tipX = fx + ca * len * Math.cos(lift), tipZ = fz + sa * len * Math.cos(lift), tipY = fy + len * Math.sin(lift);
        const bx = -sa * w, bz = ca * w;
        const base: [number, number, number] = ring === 0 ? [0.78, 0.76, 0.7] : [0.9, 0.86, 0.82];
        const tip: [number, number, number] = [0.95, 0.82, 0.84];
        const n: [number, number, number] = [-ca * Math.sin(lift), Math.cos(lift), -sa * Math.sin(lift)];
        const mx = fx + ca * len * 0.5 * Math.cos(lift), mz = fz + sa * len * 0.5 * Math.cos(lift), my = fy + len * 0.5 * Math.sin(lift);
        vert(fx, fy, fz, base, n, fc, ph); vert(mx + bx, my, mz + bz, base, n, fc, ph); vert(tipX, tipY, tipZ, tip, n, fc, ph);
        vert(fx, fy, fz, base, n, fc, ph); vert(tipX, tipY, tipZ, tip, n, fc, ph); vert(mx - bx, my, mz - bz, base, n, fc, ph);
      }
    }
    const heart: [number, number, number] = [0.95, 0.72, 0.12];
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2, r = 0.02;
      vert(fx, fy + 0.03, fz, heart, up, fc, ph);
      vert(fx + Math.cos(a1) * r, fy + 0.012, fz + Math.sin(a1) * r, heart, up, fc, ph);
      vert(fx + Math.cos(a0) * r, fy + 0.012, fz + Math.sin(a0) * r, heart, up, fc, ph);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aPad', new THREE.Float32BufferAttribute(pad, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    patchWindField(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPad;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // each pad turns a little about its centre and bobs as the gusts cross the pond; the lot drifts downwind
          float g = windGustAt( aPad.xy );
          float ang = 0.07 * g * sin( uWindTime * 0.45 + aPad.z );
          vec2 rel = transformed.xz - aPad.xy;
          float c = cos( ang ), s = sin( ang );
          transformed.xz = aPad.xy + vec2( c * rel.x - s * rel.y, s * rel.x + c * rel.y ) + windDirXZ() * 0.04 * g * ( 0.6 + 0.4 * sin( uWindTime * 0.3 + aPad.z ) );
          transformed.y += 0.006 * g * sin( uWindTime * 1.7 + aPad.z * 1.3 + rel.x * 9.0 );
        }`);
  };
  mat.customProgramCacheKey = () => 'ph-lilies';
  sky.setupMaterial(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lily-pads';
  mesh.receiveShadow = true;
  return mesh;
}

// ── the planar pond (`?pond=planar`): the pre-remaster surface, unchanged ────────────────────────────────────────────

/**
 * Still forest pond with a real planar reflection (mirrored camera + oblique clip plane,
 * rendered at reduced resolution only while the pond is in range), rippled by two scrolling
 * procedural normal maps, Fresnel-blended over a dark green depth colour, soft shore edge.
 */
class PlanarPond {
  mesh!: THREE.Mesh;
  private mat!: THREE.MeshPhysicalMaterial;
  private uniforms = {
    uTime: { value: 0 },
    tReflection: { value: null as THREE.Texture | null },
    uTextureMatrix: { value: new THREE.Matrix4() },
    uReflectionOn: { value: 0 },
  };
  private rt = new THREE.WebGLRenderTarget(TIER_CONFIG.reflectionWidth, TIER_CONFIG.reflectionWidth / 2, { type: THREE.HalfFloatType, depthBuffer: true });
  private skipList: THREE.Object3D[] = [];
  private skipCount = -1;
  private hidden: THREE.Object3D[] = [];
  private mirrorCam = new THREE.PerspectiveCamera();
  private plane = new THREE.Plane();
  private clip = new THREE.Vector4();
  private q = new THREE.Vector4();
  private v = { view: new THREE.Vector3(), target: new THREE.Vector3(), look: new THREE.Vector3(), camPos: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), rot: new THREE.Matrix4() };

  constructor(private sky: Sky) {}

  build(): this {
    const size = POND.r * 2 + 30, segs = 64;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const depth = new Float32Array(pos.count);
    const wl = waterLevel();
    for (let i = 0; i < pos.count; i++) depth[i] = wl - heightAt(pos.getX(i) + POND.x, pos.getZ(i) + POND.z);
    geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));

    const normalTex = makeWaterNormal();
    this.uniforms.tReflection.value = this.rt.texture;
    this.mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.008, 0.028, 0.022), roughness: 0.05, metalness: 0.0, transparent: true,
      normalMap: normalTex, normalScale: new THREE.Vector2(0.09, 0.09), envMapIntensity: 0.2,
      clearcoat: 0.6, clearcoatRoughness: 0.05, depthWrite: false,
    });
    normalTex.repeat.set(size / 5, size / 5);
    this.mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float depth; varying float vDepth; varying vec4 vMirror; uniform float uTime; uniform mat4 uTextureMatrix;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = depth;\ntransformed.y += sin(uTime * 0.8 + position.x * 0.5) * 0.006 + sin(uTime * 1.1 + position.z * 0.7) * 0.005;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMirror = uTextureMatrix * modelMatrix * vec4(transformed, 1.0);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vDepth; varying vec4 vMirror; uniform float uTime; uniform sampler2D tReflection; uniform float uReflectionOn;')
        .replace('#include <normal_fragment_maps>', `
          vec2 uvA = vNormalMapUv + vec2(uTime * 0.010, uTime * 0.007);
          vec2 uvB = vNormalMapUv * 0.57 - vec2(uTime * 0.006, -uTime * 0.009);
          vec2 uvC = vNormalMapUv * 2.3 + vec2(-uTime * 0.02, uTime * 0.013);
          vec3 mapN = texture2D( normalMap, uvA ).xyz * 2.0 - 1.0;
          mapN += texture2D( normalMap, uvB ).xyz * 2.0 - 1.0;
          mapN += (texture2D( normalMap, uvC ).xyz * 2.0 - 1.0) * 0.4;
          mapN = normalize(mapN);
          mapN.xy *= normalScale;
          normal = normalize( tbn * mapN );
          vec3 rippleN = mapN;`)
        .replace('#include <opaque_fragment>', `
          float shore = smoothstep(0.0, 0.45, vDepth);
          #include <opaque_fragment>
          {
            vec3 V = normalize(vViewPosition);
            float NdotV = clamp(dot(normal, V), 0.0, 1.0);
            float F = 0.02 + 0.55 * pow(1.0 - NdotV, 3.5);
            vec2 muv = vMirror.xy / max(vMirror.w, 1e-4) + rippleN.xy * 0.06; // guarded: a w of 0 is an Inf / NaN pixel for bloom to smear (E67 / E91 class)
            vec3 refl = texture2D(tReflection, muv).rgb;
            // a real pond is darker than the sky it mirrors: compress bright (sky) reflections harder than dark (tree) ones
            refl = refl / (1.0 + refl * 1.6) * vec3(0.5, 0.58, 0.62);
            vec3 deep = gl_FragColor.rgb;
            // shallow water shows the bottom colour a little
            deep = mix(deep, deep + vec3(0.03, 0.05, 0.03), smoothstep(2.0, 0.0, vDepth));
            vec3 col = mix(deep, refl, F * uReflectionOn + (1.0 - uReflectionOn) * 0.0);
            col += reflectedLight.directSpecular * 0.25;   // keep the sun glint on top
            gl_FragColor.rgb = col;
          }
          gl_FragColor.a = shore;`)
        // fog the water surface less than the air: keep 65 % of the unfogged colour
        .replace('#include <fog_fragment>', `
          vec3 preFog = gl_FragColor.rgb;
          #include <fog_fragment>
          gl_FragColor.rgb = mix(preFog, gl_FragColor.rgb, 0.35);`);
    };
    this.mat.customProgramCacheKey = () => 'pond-water';
    this.sky.setupMaterial(this.mat);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(POND.x, wl, POND.z);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 5;
    this.mesh.onBeforeRender = (renderer, scene, camera) => this.renderReflection(renderer, scene, camera as THREE.PerspectiveCamera);
    return this;
  }

  update(dt: number): void { this.uniforms.uTime.value += dt; }

  private renderReflection(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const v = this.v;
    v.camPos.setFromMatrixPosition(camera.matrixWorld);
    const dist = Math.hypot(v.camPos.x - POND.x, v.camPos.z - POND.z);
    const wl = this.mesh.position.y;
    if (dist > 170 || v.camPos.y < wl) { this.uniforms.uReflectionOn.value = 0; return; }
    this.uniforms.uReflectionOn.value = 1;

    const cam = this.mirrorCam;
    const centre = this.mesh.position;
    // mirror camera position and orientation across the water plane (y = wl)
    v.view.copy(v.camPos); v.view.y = 2 * wl - v.camPos.y;
    v.rot.extractRotation(camera.matrixWorld);
    v.look.set(0, 0, -1).applyMatrix4(v.rot).add(v.camPos);
    v.target.copy(v.look); v.target.y = 2 * wl - v.look.y;
    cam.position.copy(v.view);
    cam.up.set(0, 1, 0).applyMatrix4(v.rot); cam.up.y *= -1;
    cam.lookAt(v.target);
    cam.near = camera.near; cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);

    this.uniforms.uTextureMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    // oblique near plane so nothing below the water line leaks into the reflection
    this.plane.setFromNormalAndCoplanarPoint(v.normal, centre).applyMatrix4(cam.matrixWorldInverse);
    const cp = this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const pm = cam.projectionMatrix, q = this.q;
    q.x = (Math.sign(cp.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(cp.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1; q.w = (1 + pm.elements[10]) / pm.elements[14];
    cp.multiplyScalar(2 / cp.dot(q));
    pm.elements[2] = cp.x; pm.elements[6] = cp.y; pm.elements[10] = cp.z + 1 - 0.003; pm.elements[14] = cp.w;

    this.mesh.visible = false;
    // the reflection is rippled and half-res: the carpet layers (grass, ferns, litter, twigs, motes) only cost
    if (this.skipCount !== scene.children.length) {
      this.skipCount = scene.children.length; this.skipList.length = 0;
      for (const o of scene.children) { if (o.userData['noReflect'] === true) this.skipList.push(o); else for (const c of o.children) if (c.userData['noReflect'] === true) this.skipList.push(c); }
    }
    this.hidden.length = 0;
    for (const o of this.skipList) if (o.visible) { o.visible = false; this.hidden.push(o); }
    const fd = fogUniforms.fogDistDensity.value, fh = fogUniforms.fogHeightDensity.value;
    fogUniforms.fogDistDensity.value = fd * 0.4; fogUniforms.fogHeightDensity.value = fh * 0.4;
    const prevRT = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setRenderTarget(prevRT);
    fogUniforms.fogDistDensity.value = fd; fogUniforms.fogHeightDensity.value = fh;
    for (const o of this.hidden) o.visible = true;
    this.mesh.visible = true;
  }
}

/**
 * The still pond (PH-L9). `group` holds the surface (`mesh`) and the lily pads.
 *
 * PROBE (the default): one draw, no extra render pass — the shared photoreal water (waterSurface.ts): the clock's sky from
 * the scene's PMREM environment with Fresnel, the treeline and the Ridge mirrored through a skyline probe baked from
 * `forest.trees` and the terrain, wind ripples and gust fronts from wind.ts, a peaty depth tint that lets the shallows show
 * the bed, a broken scum line at the shore and a wet film draped on the bank just above the water.
 * PLANAR (`?pond=planar`): the pre-remaster surface, unchanged — a mirrored camera renders the scene a second time.
 */
export class Water {
  readonly group = new THREE.Group();
  /** the pond's surface */
  mesh!: THREE.Mesh;
  /** the lily pads + a few flowers (one mesh, bobbing on the wind) */
  lilies: THREE.Mesh | null = null;
  readonly mode: PondMode = pondMode();
  private planar: PlanarPond | null = null;

  constructor(private sky: Sky, private trees: readonly TreeInstance[] = []) {}

  build(): this {
    if (this.mode === 'planar') {
      this.planar = new PlanarPond(this.sky).build();
      this.mesh = this.planar.mesh;
    } else this.mesh = this.buildProbe();
    this.group.add(this.mesh);
    this.lilies = buildLilies(this.sky);
    if (this.lilies) this.group.add(this.lilies);
    return this;
  }

  update(dt: number): void { this.planar?.update(dt); }

  private buildProbe(): THREE.Mesh {
    const wl = waterLevel(), half = POND.r + 15, segs = 128;
    const skyline = buildSkyline(POND.x, POND.z, wl, this.trees, heightAt);
    const { material } = createWaterMaterial(this.sky, { skyline: { tex: skyline, x: POND.x, z: POND.z, level: wl } });
    const n = segs + 1, pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), aw = new Float32Array(n * n * 4);
    const depth = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, x = POND.x - half + (i / segs) * half * 2, z = POND.z - half + (j / segs) * half * 2;
      const h = heightAt(x, z), d = wl - h;
      depth[k] = d;
      // just above the water line the surface drapes onto the bank: the wet film (depth < 0)
      const y = d < 0 && d > -0.45 ? h + 0.05 : wl;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = x; uv[k * 2 + 1] = z;
      aw[k * 4] = d; aw[k * 4 + 1] = 0; aw[k * 4 + 2] = 0; aw[k * 4 + 3] = 2.4; // peaty still water: 2.4 / m
    }
    const idx: number[] = [];
    const dry = (k: number): boolean => (depth[k] ?? 0) < -0.45;
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if (dry(a) && dry(b) && dry(c) && dry(d)) continue; // under the bank everywhere: never seen
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aWater', new THREE.BufferAttribute(aw, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'pond';
    mesh.receiveShadow = true;
    mesh.renderOrder = 5;
    return mesh;
  }
}

function makeWaterNormal() {
  const N = 256;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  if (!g) throw new Error('[water] no 2d canvas context');
  const img = g.createImageData(N, N);
  const h = (x: number, y: number) => {
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 7 - v * 5 + 1.3) * 0.25 + Math.sin(-u * 11 + v * 13 + 0.4) * 0.12
      + Math.sin(u * 17 + v * 3 + 2.1) * 0.08 + Math.sin(u * 5 + v * 23 + 0.9) * 0.06 + Math.sin(u * 2 - v * 9 + 4.0) * 0.2;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.0, dy = (h(x, y + 1) - h(x, y - 1)) * 2.0;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
