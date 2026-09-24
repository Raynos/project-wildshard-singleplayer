import * as THREE from 'three';
import { POND, waterLevel, heightAt } from './Heightfield';
import { attachFogUniforms, fogUniforms } from './Atmosphere';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';

/** Mark a group/mesh so the pond's planar reflection skips it (grass, undergrowth, particles, twigs …). */
export function noReflect(o: THREE.Object3D): void { o.userData['noReflect'] = true; }

/**
 * Still forest pond with a real planar reflection (mirrored camera + oblique clip plane,
 * rendered at reduced resolution only while the pond is in range), rippled by two scrolling
 * procedural normal maps, Fresnel-blended over a dark green depth colour, soft shore edge.
 */
export class Water {
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
