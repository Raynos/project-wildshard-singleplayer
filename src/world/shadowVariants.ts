/**
 * E174: cheaper shadow maps for Driftwood's phone rig (the user's pick "Build cheaper variants"; the user picks one).
 *
 * The rig (Sky.ts PHONE_SHADOW, E123 / E147) is 3 cascades at 2048² plus the sun fade's 2 ghosts (shadowFade.ts) at
 * 2048². three r186 gives every PCF shadow map a WebGLRenderTarget: an RGBA8 colour texture (16 MB at 2048²) that nothing
 * ever samples, plus the DEPTH_COMPONENT24 depth texture the lit shaders compare against (16 MB; 4 bytes a texel on the
 * GPU). 5 × 32 MB = 160 MB of the ~264 MB of GL textures the scorecard reads on Driftwood's phone tier.
 *
 * pause ▸ Settings ▸ Debug ▸ Shadows (Driftwood phone), live:
 *   a  Today        three's own maps: nothing changes (the default until the user picks)
 *   b  Depth only   the same maps without the colour texture: the same pixels, half the memory
 *   c  16-bit depth b with DEPTH_COMPONENT16 (0.9 cm depth steps over the light's 1–600 m range, under the 7 cm bias)
 *   d  Lean         c with the far cascade (22–80 m) and the two fade ghosts at 1024²
 *
 * The maps b–d are made here, in three's own shape (WebGLShadowMap: a render target with a compare-mode depth texture),
 * and set on `shadow.map` before three would make one; the colour texture is detached from the framebuffer and deleted
 * right after the target is initialised (a depth-only framebuffer is complete in WebGL 2; three only ever samples the
 * depth texture). A cascade whose map is smaller than the CSM's size is re-placed on its own texel grid after each
 * csm.update() (CSM snaps every cascade to `csm.shadowMapSize`: half-texel steps would make its edges crawl).
 */
import * as THREE from 'three';
import type { CSM } from 'three/examples/jsm/csm/CSM.js';
import { CSMFrustum } from 'three/examples/jsm/csm/CSMFrustum.js';

export const SHADOW_VARIANTS = ['a', 'b', 'c', 'd'] as const;
export type ShadowVariant = (typeof SHADOW_VARIANTS)[number];

interface VariantSpec {
  /** the menu's name */
  name: string;
  /** three's own maps (the RGBA8 colour texture kept) */
  colour: boolean;
  /** DEPTH_COMPONENT16, not 24 */
  depth16: boolean;
  /** the far cascade's and the ghosts' size as a fraction of the rig's */
  farScale: number;
  ghostScale: number;
}

export const VARIANT_SPECS: Record<ShadowVariant, VariantSpec> = {
  a: { name: 'Today', colour: true, depth16: false, farScale: 1, ghostScale: 1 },
  b: { name: 'Depth only', colour: false, depth16: false, farScale: 1, ghostScale: 1 },
  c: { name: '16-bit depth', colour: false, depth16: true, farScale: 1, ghostScale: 1 },
  d: { name: 'Lean', colour: false, depth16: true, farScale: 0.5, ghostScale: 0.5 },
};

/** a map's GPU bytes: the depth texture (4 or 2 bytes a texel) and, for three's own, the RGBA8 colour texture */
function mapBytes(size: number, spec: VariantSpec): number {
  return size * size * ((spec.depth16 ? 2 : 4) + (spec.colour ? 4 : 0));
}

/** the rig's shadow map bytes under `v`: `cascades` maps (the last is the far one) and `ghosts` fade ghosts at `size`² */
export function shadowBytes(v: ShadowVariant, size: number, cascades: number, ghosts: number): number {
  const s = VARIANT_SPECS[v], far = Math.round(size * s.farScale), ghost = Math.round(size * s.ghostScale);
  return Math.max(0, cascades - 1) * mapBytes(size, s) + (cascades > 0 ? mapBytes(far, s) : 0) + ghosts * mapBytes(ghost, s);
}

/** the phone rig's maps (Sky.ts PHONE_SHADOW: 3 cascades at 2048²; shadowFade.ts: a ghost for each but the last) */
export const PHONE_RIG_MAPS = { size: 2048, cascades: 3, ghosts: 2 } as const;

interface Made { size: number; depth16: boolean; colour: boolean }

const _origin = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _center = new THREE.Vector3();
const _lo = new THREE.Matrix4(), _loInv = new THREE.Matrix4(), _c2l = new THREE.Matrix4();
const _box = new THREE.Box3();
const _ls = new CSMFrustum();

export class ShadowMaps {
  /** the maps this module made, per light (a light missing here holds three's own map, or none yet) */
  private readonly made = new Map<THREE.DirectionalLight, Made>();
  variant: ShadowVariant = 'a';
  /** set by the owner: the fade ghosts' normal bias is their cascade's × this (a ghost at half size has twice the texel) */
  onGhostScale: ((scale: number) => void) | null = null;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly csm: CSM, private readonly camera: THREE.Camera, private readonly ghosts: readonly THREE.DirectionalLight[], readonly size: number) {}

  /** the GPU bytes of the rig's shadow maps under the current variant */
  get bytes(): number { return shadowBytes(this.variant, this.size, this.csm.lights.length, this.ghosts.length); }

  /**
   * Switch to `v` (live). `force` remakes every map this module owns (after an in-place WebGL restore: the targets came
   * back uninitialised and three would give them their colour texture again).
   */
  apply(v: ShadowVariant, force = false): void {
    this.variant = v;
    const spec = VARIANT_SPECS[v];
    const last = this.csm.lights.length - 1;
    const wants: [THREE.DirectionalLight, number][] = [
      ...this.csm.lights.map((l, i): [THREE.DirectionalLight, number] => [l, i === last && last > 0 ? Math.round(this.size * spec.farScale) : this.size]),
      ...this.ghosts.map((g): [THREE.DirectionalLight, number] => [g, Math.round(this.size * spec.ghostScale)]),
    ];
    for (const [light, size] of wants) {
      const had = this.made.get(light);
      if (spec.colour) {
        // today: three's own map at the rig's size (dropped only when this module made the current one)
        if (had === undefined) continue;
        this.drop(light);
        light.shadow.mapSize.set(size, size);
        light.shadow.needsUpdate = true;
        continue;
      }
      if (!force && had?.size === size && had.depth16 === spec.depth16) continue;
      this.drop(light, !force); // after a restore the old targets' GL objects went with the lost context: nothing to free
      light.shadow.mapSize.set(size, size);
      this.make(light, size, spec.depth16);
    }
    this.onGhostScale?.(spec.ghostScale === 1 ? 1 : 1 / spec.ghostScale);
  }

  /**
   * After csm.update(): a cascade whose map is smaller than the CSM's size, placed again on its own texel grid (CSM.update
   * snapped it to the CSM's finer one). The same maths as CSM.update, with this map's texel.
   */
  snap(): void {
    const csm = this.csm;
    for (const [i, light] of csm.lights.entries()) {
      const size = light.shadow.mapSize.x, frustum = csm.frustums[i];
      if (size === csm.shadowMapSize || frustum === undefined) continue;
      const cam = light.shadow.camera;
      const texelW = (cam.right - cam.left) / size, texelH = (cam.top - cam.bottom) / size;
      _lo.lookAt(_origin, csm.lightDirection, _up);
      _loInv.copy(_lo).invert();
      _c2l.multiplyMatrices(_loInv, this.camera.matrixWorld);
      frustum.toSpace(_c2l, _ls);
      _box.makeEmpty();
      for (const p of _ls.vertices.near) _box.expandByPoint(p);
      for (const p of _ls.vertices.far) _box.expandByPoint(p);
      _box.getCenter(_center);
      _center.z = _box.max.z + csm.lightMargin;
      _center.x = Math.floor(_center.x / texelW) * texelW;
      _center.y = Math.floor(_center.y / texelH) * texelH;
      _center.applyMatrix4(_lo);
      light.position.copy(_center);
      light.target.position.copy(_center).add(csm.lightDirection);
    }
  }

  private drop(light: THREE.DirectionalLight, free = true): void {
    const map = light.shadow.map;
    if (map !== null && free) { map.depthTexture?.dispose(); map.dispose(); }
    light.shadow.map = null;
    this.made.delete(light);
  }

  /** three's directional PCF map (WebGLShadowMap, r186), made now, initialised, and its colour texture let go */
  private make(light: THREE.DirectionalLight, size: number, depth16: boolean): void {
    const rt = new THREE.WebGLRenderTarget(size, size);
    const depth = new THREE.DepthTexture(size, size, depth16 ? THREE.UnsignedShortType : THREE.UnsignedIntType);
    depth.name = `${light.name}.shadowMap`;
    depth.format = THREE.DepthFormat;
    depth.compareFunction = this.renderer.state.buffers.depth.getReversed() ? THREE.GreaterEqualCompare : THREE.LessEqualCompare;
    depth.minFilter = THREE.LinearFilter;
    depth.magFilter = THREE.LinearFilter;
    rt.depthTexture = depth;
    light.shadow.map = rt;
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.needsUpdate = true; // a ghost's map renders only while a fade runs: draw it once now
    this.renderer.initRenderTarget(rt);
    this.dropColour(rt);
    this.made.set(light, { size, depth16, colour: false });
  }

  /** detach the render target's colour texture from its framebuffer and free it: the depth texture is all the shaders read */
  private dropColour(rt: THREE.WebGLRenderTarget): void {
    const gl = this.renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext)) return;
    const rtProps: unknown = this.renderer.properties.get(rt), texProps: unknown = this.renderer.properties.get(rt.texture);
    const fb: unknown = typeof rtProps === 'object' && rtProps !== null ? Reflect.get(rtProps, '__webglFramebuffer') : null;
    const tex: unknown = typeof texProps === 'object' && texProps !== null ? Reflect.get(texProps, '__webglTexture') : null;
    if (!(fb instanceof WebGLFramebuffer) || !(tex instanceof WebGLTexture)) return;
    const state = this.renderer.state;
    state.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!ok) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); // keep three's shape
    state.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (ok) gl.deleteTexture(tex);
    else console.warn('[sky] E174: a depth-only shadow framebuffer is incomplete here: the colour texture stays');
  }
}
