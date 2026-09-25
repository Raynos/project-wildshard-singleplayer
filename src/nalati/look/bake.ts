/**
 * Look v2 — the baked shadows + contact darkening (port-v2.md step 6; the prototype's "baked once, zero runtime cost").
 *
 * Two orthographic renders of the STATIC casters only (the POIs, the dressing, the outcrops, the spruce — every mesh
 * in the groups handed to `add()`, tagged with a layer of their own; creatures, the player and the grass are not in
 * it), made once and again only when the key light has swung more than ~1.5° (the clock) or the casters changed:
 *
 *   shadow  a 2048² (phone 1024²) depth map from the key direction over the whole slab — the grass and the flowers
 *           read it per vertex (`bakedShadow(worldPos)`, 4-tap PCF), so the yurts, the rocks and the spruce throw
 *           their long golden-hour shadows across the meadow. The terrain keeps its CSM (desktop and phone).
 *   contact a top-down map of how high the casters stand above the ground (half float, mipmapped): a blurred read of
 *           it (`bakedContact(worldPos)`) darkens the ground and the grass round every yurt, rock and trunk foot —
 *           the painted contact shade the mockups carry, without SSAO.
 *
 * `LOOK_BAKE_GLSL` holds the uniforms + both functions; `bakeUniforms` are shared by every receiver.
 */
import * as THREE from 'three';
import { TIER } from '../../core/tier';
import { onGpuRestored } from '../../core/gpuOnly';
import { stateSlot } from '../../core/shardState';

const LAYER = 7;
const SIZE = TIER === 'phone' ? 1024 : 2048;
const AO_SIZE = 1024;
const HALF = 262;          // the slab (±250) and a margin
const REBAKE_COS = Math.cos(1.5 * Math.PI / 180);
/** phone: the static casters cast only into the bake, not the realtime shadow map (see `add`) */
export const PHONE_STATIC_OFF_CSM = TIER === 'phone';

export const bakeUniforms = {
  tBakeShadow: { value: null as THREE.Texture | null },
  uBakeMatrix: { value: new THREE.Matrix4() },
  /** x = on (0 until the first bake), y = depth bias (0..1 depth units), z = texel (uv) */
  uBakeInfo: { value: new THREE.Vector3(0, 0.0004, 1 / SIZE) },
  tBakeContact: { value: null as THREE.Texture | null },
  /** xz origin (m), 1 / size (1/m), strength */
  uContactXf: { value: new THREE.Vector4(-HALF, -HALF, 1 / (HALF * 2), 0) },
};

export const LOOK_BAKE_GLSL = /* glsl */`
uniform sampler2D tBakeShadow;
uniform mat4 uBakeMatrix;
uniform vec3 uBakeInfo;
uniform sampler2D tBakeContact;
uniform vec4 uContactXf;
// 1 = lit, 0 = in a static caster's shadow (the key light's direction at the last bake)
float bakedShadow(vec3 wp) {
  if (uBakeInfo.x < 0.5) return 1.0;
  vec4 c = uBakeMatrix * vec4(wp, 1.0);
  vec3 p = c.xyz / c.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float z = p.z - uBakeInfo.y, t = uBakeInfo.z * 0.75;
  float s = step(z, texture(tBakeShadow, p.xy + vec2(-t, -t)).r) + step(z, texture(tBakeShadow, p.xy + vec2(t, -t)).r)
          + step(z, texture(tBakeShadow, p.xy + vec2(-t, t)).r) + step(z, texture(tBakeShadow, p.xy + vec2(t, t)).r);
  return s * 0.25;
}
// 1 = open ground … darker where something stands close by (the blurred height of the casters above the ground)
float bakedContact(vec3 wp) {
  if (uContactXf.w <= 0.0) return 1.0;
  vec2 uv = vec2((wp.x - uContactXf.x) * uContactXf.z, 1.0 - (wp.z - uContactXf.y) * uContactXf.z);   // the top-down camera's image: right = +x, up = −z
  float near = textureLod(tBakeContact, uv, 2.0).r, wide = textureLod(tBakeContact, uv, 3.5).r;
  float occ = smoothstep(0.05, 1.4, near) * 0.55 + smoothstep(0.05, 1.6, wide) * 0.45;
  return 1.0 - uContactXf.w * occ;
}
`;

/** the casters' material for the depth pass: position only (instancing / batching kept), no colour work */
function depthMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      #include <common>
      #include <batching_pars_vertex>
      void main() {
        #include <batching_vertex>
        #include <begin_vertex>
        #include <project_vertex>
      }`,
    fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
  });
}

/** the casters' material for the contact pass: how far above the ground this fragment stands (m) */
function contactMaterial(tHeight: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { tHeight: { value: tHeight }, uHXf: { value: new THREE.Vector4(-256, -256, 1 / 512, 512) } },
    vertexShader: /* glsl */`
      #include <common>
      #include <batching_pars_vertex>
      varying vec3 vWP;
      void main() {
        #include <batching_vertex>
        #include <begin_vertex>
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          wp = batchingMatrix * wp;
        #endif
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tHeight; uniform vec4 uHXf;
      varying vec3 vWP;
      void main() {
        float g = texture2D(tHeight, (vWP.xz - uHXf.xy) * uHXf.z).r;
        gl_FragColor = vec4(clamp(vWP.y - g, 0.0, 8.0), 0.0, 0.0, 1.0);
      }`,
  });
}

export class StaticBake {
  private readonly shadowRT: THREE.WebGLRenderTarget;
  private readonly contactRT: THREE.WebGLRenderTarget;
  private readonly shadowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1400);
  private readonly contactCam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 1, 600);
  private readonly depthMat = depthMaterial();
  private readonly contactMat: THREE.ShaderMaterial;
  private readonly lastDir = new THREE.Vector3(0, -1, 0);
  private dirty = true;
  /** contact darkening strength (0 = off) */
  contact = 0.45;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene, tHeight: THREE.Texture) {
    const depthTexture = new THREE.DepthTexture(SIZE, SIZE, THREE.UnsignedIntType);
    this.shadowRT = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthTexture, depthBuffer: true, type: THREE.UnsignedByteType });
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    this.contactRT = new THREE.WebGLRenderTarget(AO_SIZE, AO_SIZE, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
    });
    this.contactMat = contactMaterial(tHeight);
    this.shadowCam.layers.set(LAYER);
    this.contactCam.layers.set(LAYER);
    // straight down over the slab: image right = +x, image up = −z (bakedContact's uv follows)
    this.contactCam.position.set(0, 300, 0);
    this.contactCam.up.set(0, 0, -1);
    this.contactCam.lookAt(0, 0, 0);
    this.contactCam.updateMatrixWorld();
    bakeUniforms.tBakeShadow.value = depthTexture;
    bakeUniforms.tBakeContact.value = this.contactRT.texture;
    if (typeof window !== 'undefined') Object.assign(window, { __bake: this });
    onGpuRestored(() => { this.invalidate(); }); // the maps live only on the GPU: an in-place WebGL restore bakes them again (E54)
  }

  private readonly roots: THREE.Object3D[] = [];
  private seen = 0;

  /**
   * put every mesh under `root` into the bake (static things only). On the phone they also leave the realtime
   * shadow map: the bake is their shadow there (the terrain and the grass read it), so the CSM pass draws only what
   * moves — every static caster drawn a second time each frame was ~20 calls and ~0.4 M triangles.
   */
  add(root: THREE.Object3D): void {
    this.roots.push(root);
    this.sweep();
    this.dirty = true;
  }

  /** the groups stream in (the dressing, the GLB props): pick up meshes added since — cheap, call it every second or two */
  sweep(): void {
    let n = 0;
    for (const root of this.roots) root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      n++;
      o.layers.enable(LAYER);
      if (PHONE_STATIC_OFF_CSM) o.castShadow = false;
    });
    if (n !== this.seen) { this.seen = n; this.dirty = true; }
  }

  /** the casters changed (the dressing landed, a model streamed in) */
  invalidate(): void { this.dirty = true; }

  /** each frame: re-bake when the key light has swung past the threshold (or the casters changed) */
  update(keyDir: THREE.Vector3): void {
    if (!this.dirty && keyDir.dot(this.lastDir) > REBAKE_COS) return;
    this.lastDir.copy(keyDir);
    this.dirty = false;
    this.bake(keyDir);
  }

  private bake(keyDir: THREE.Vector3): void {
    const { renderer, scene } = this;
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = scene.overrideMaterial;
    const prevAuto = renderer.shadowMap.autoUpdate;
    const prevAutoClear = renderer.autoClear;
    const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    const prevBg = scene.background;
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = true;
    scene.background = null;
    try {
      // the key's view of the slab: an orthographic box turned to the light, wide enough for the diagonal
      const cam = this.shadowCam;
      const d = keyDir.clone().normalize();
      cam.position.copy(d).multiplyScalar(650).add(new THREE.Vector3(0, 10, 0));
      cam.up.set(0, 1, 0);
      if (Math.abs(d.y) > 0.99) cam.up.set(0, 0, -1);
      cam.lookAt(0, 10, 0);
      const r = HALF * 1.42;
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 300; cam.far = 1000;
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      scene.overrideMaterial = this.depthMat;
      renderer.setRenderTarget(this.shadowRT);
      renderer.setClearColor(0xffffff, 1);
      renderer.render(scene, cam);
      bakeUniforms.uBakeMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      // depth bias: ~0.25 m in the camera's depth range
      bakeUniforms.uBakeInfo.value.set(1, 0.25 / (cam.far - cam.near), 1 / SIZE);
      // the contact map: the casters' height above the ground, straight down
      scene.overrideMaterial = this.contactMat;
      renderer.setRenderTarget(this.contactRT);
      renderer.setClearColor(0x000000, 1);
      renderer.render(scene, this.contactCam);
      bakeUniforms.uContactXf.value.w = this.contact;
    } finally {
      scene.overrideMaterial = prevOverride;
      scene.background = prevBg;
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevClear, prevAlpha);
      renderer.autoClear = prevAutoClear;
      renderer.shadowMap.autoUpdate = prevAuto;
    }
  }
}

// E155 (src/core/shardState.ts): a rebuilt Nalati starts with no bake (its targets were the evicted renderer's)
stateSlot('nalati.bake', bakeUniforms);
