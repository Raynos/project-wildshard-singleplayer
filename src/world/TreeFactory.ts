import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadTexture, loadPBR } from '../core/assets';
import { Rng } from '../core/rng';
import { attachFogUniforms } from './Atmosphere';
import { TIER_CONFIG } from '../core/tier';
import { getActiveChunk } from '../chunks/registry';
import { loadBakedCards, exportCardTextures } from './BakedCards';
import { macrotask } from '../boot/plan';
import { markGpuOnly } from '../core/gpuOnly';
import { TREE_SPECS } from './placement';

/**
 * Pine trees built from a runtime-baked "branch card".
 *
 * The Poly Haven pine_tree_01 scan is ~1 GB of raw geometry — unusable in real time — but
 * its twig atlas is a photoreal needle cluster. We assemble a full branch out of ~30 of those
 * twigs, render it top-down into albedo / normal / ARM textures once at load, and then build
 * each tree from ~60 of those branch cards around a bark-textured trunk. Same technique AAA
 * vegetation pipelines (SpeedTree) use; it gives real photographic needle detail at ~400 tris.
 */

export interface TreeVariant {
  trunk: THREE.BufferGeometry;
  cardsHi: THREE.BufferGeometry;
  cardsLo: THREE.BufferGeometry;
  /** near-field detail: individual photoscan twig quads along the branches (drawn within ~35 m) */
  twigs: THREE.BufferGeometry;
  /** far LOD: two crossed quads with the whole tree (cards + trunk) baked into `farMaterial`'s atlas — 4 tris */
  far: THREE.BufferGeometry;
  height: number;
  trunkRadius: number;
}

/** Texture ids from the shard's `ChunkTrees` (defaults are Pine Hollow's). */
export interface TreeFactoryOptions { bark?: string; twigAtlas?: string }

export const windUniforms = { uTime: { value: 0 }, uWindStrength: { value: 1.0 } };

const _v = new THREE.Vector3(), _nm = new THREE.Matrix3();

/**
 * `mergeGeometries(matrices.map((m) => template.clone().applyMatrix4(m)))` without a geometry per copy: each
 * copy's positions / normals go through the same Vector3 math BufferGeometry.applyMatrix4 runs and land in
 * one growing float32 array; uv is copied; the index is merged as mergeGeometries merges it — byte-identical
 * output (the tree step built ~2 k card / twig geometries per variant only to concatenate them).
 */
class MatrixMerge {
  private readonly pos: Float32Array; private readonly nor: Float32Array; private readonly uv: Float32Array; private readonly idx: ArrayLike<number>;
  private outPos = new Float32Array(0); private outNor = new Float32Array(0); private outUv = new Float32Array(0);
  private readonly index: number[] = [];
  private n = 0; // vertices written
  constructor(template: THREE.BufferGeometry) {
    const a = (name: string): Float32Array => { const attr = template.getAttribute(name); if (!(attr.array instanceof Float32Array)) throw new Error(`MatrixMerge: ${name} is not float32`); return attr.array; };
    this.pos = a('position'); this.nor = a('normal'); this.uv = a('uv');
    if (!template.index) throw new Error('MatrixMerge: template is not indexed');
    this.idx = template.index.array;
  }
  get count(): number { return this.n; }
  add(m: THREE.Matrix4): void {
    const count = this.pos.length / 3, base = this.n;
    if ((base + count) * 3 > this.outPos.length) {
      const cap = Math.max(1024, (base + count) * 2);
      const grow = (src: Float32Array, k: number) => { const d = new Float32Array(cap * k); d.set(src); return d; };
      this.outPos = grow(this.outPos, 3); this.outNor = grow(this.outNor, 3); this.outUv = grow(this.outUv, 2);
    }
    const nm = _nm.getNormalMatrix(m);
    const P = this.pos, N = this.nor, op = this.outPos, on = this.outNor;
    for (let i = 0; i < count; i++) {
      const o = (base + i) * 3;
      _v.set(P[i * 3] ?? 0, P[i * 3 + 1] ?? 0, P[i * 3 + 2] ?? 0).applyMatrix4(m);
      op[o] = _v.x; op[o + 1] = _v.y; op[o + 2] = _v.z;
      _v.set(N[i * 3] ?? 0, N[i * 3 + 1] ?? 0, N[i * 3 + 2] ?? 0).applyNormalMatrix(nm);
      on[o] = _v.x; on[o + 1] = _v.y; on[o + 2] = _v.z;
    }
    this.outUv.set(this.uv, base * 2);
    for (let j = 0; j < this.idx.length; j++) this.index.push((this.idx[j] ?? 0) + base);
    this.n += count;
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setIndex(this.index);
    g.setAttribute('position', new THREE.BufferAttribute(this.outPos.slice(0, this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.outNor.slice(0, this.n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.outUv.slice(0, this.n * 2), 2));
    return g;
  }
}

export class TreeFactory {
  barkMaterial!: THREE.MeshStandardMaterial;
  needleMaterial!: THREE.MeshStandardMaterial;
  needleDepth!: THREE.MeshDepthMaterial;
  twigMaterial!: THREE.MeshStandardMaterial;
  twigDepth!: THREE.MeshDepthMaterial;
  /** far-tree impostor: albedo + normal atlas, one column per variant (baked from the hi tree at load) */
  farMaterial!: THREE.MeshStandardMaterial;
  variants: TreeVariant[] = [];

  private opts: Required<TreeFactoryOptions>;
  /** WEBGL_multi_draw present → Forest draws every tree LOD of a material as one BatchedMesh (else InstancedMesh per variant) */
  readonly multiDraw: boolean;
  constructor(private renderer: THREE.WebGLRenderer, opts: TreeFactoryOptions = {}) {
    this.opts = { bark: 'pine_bark', twigAtlas: 'pine_tree_01', ...opts };
    this.multiDraw = renderer.extensions.has('WEBGL_multi_draw') && !new URLSearchParams(location.search).has('nobatch');
  }

  /**
   * A factory with no tree variants (ChunkTrees.factory `'none'`): untextured stand-in materials that are
   * never drawn, nothing fetched, no geometry, no branch-card bake. Forest plants nothing with it.
   */
  buildEmpty(): this {
    this.barkMaterial = new THREE.MeshStandardMaterial();
    this.needleMaterial = new THREE.MeshStandardMaterial();
    this.twigMaterial = new THREE.MeshStandardMaterial();
    this.farMaterial = new THREE.MeshStandardMaterial();
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this.twigDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    return this;
  }

  async build(): Promise<this> {
    const atlas = `/assets/tex/${this.opts.twigAtlas}`;
    const [twigDiff, twigNor, twigArm, bark] = await Promise.all([
      loadTexture(`${atlas}/twig_rgba.png`, true),
      loadTexture(`${atlas}/twig_nor_gl.jpg`),
      loadTexture(`${atlas}/twig_arm.jpg`),
      loadPBR(this.opts.bark, 1),
    ]);
    // baked cards (public/assets/baked/<slug>/card-*.{png,jpg}, scripts/bake-cards.mjs) when the build has them;
    // the runtime bake below is the fallback and the source of the bake (?bakecards=1 exports it)
    const params = new URLSearchParams(location.search);
    const baked = await loadBakedCards(getActiveChunk().slug);
    const card = baked ?? this.bakeBranchCard(twigDiff, twigNor, twigArm);
    if (!baked) await macrotask(); // the runtime bake (a shard without baked cards) is a task of its own
    if (params.has('bakecards')) exportCardTextures(this.renderer, baked ? this.bakeBranchCard(twigDiff, twigNor, twigArm) : card);

    this.barkMaterial = new THREE.MeshStandardMaterial({
      map: bark.map, normalMap: bark.normalMap, roughnessMap: bark.armMap, aoMap: bark.armMap,
      roughness: 1, metalness: 0, color: new THREE.Color(0.85, 0.8, 0.75),
    });
    this.barkMaterial.onBeforeCompile = (shader) => {
      attachFogUniforms(shader); patchWind(shader);
      // Scots pine: dark plated bark low on the trunk, papery orange bark high up
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vTrunkT;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrunkT = windWeight / 0.35;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTrunkT;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            float up = smoothstep(0.3, 0.8, vTrunkT);
            vec3 low = vec3(0.62, 0.55, 0.5);
            vec3 high = vec3(1.25, 0.78, 0.52);
            diffuseColor.rgb *= mix(low, high, up);
          }`);
    };
    this.barkMaterial.customProgramCacheKey = () => 'bark';
    this.needleMaterial = new THREE.MeshStandardMaterial({
      map: card.albedo, normalMap: card.normal, aoMap: card.arm,
      alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.96, metalness: 0, envMapIntensity: 0.45,
      color: new THREE.Color(0.55, 0.78, 0.45), normalScale: new THREE.Vector2(0.8, 0.8),
    });
    this.needleMaterial.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      patchWind(shader);
      // Foliage shading: bend the card normal toward "up" so the crown lights like a volume
      // instead of a stack of flat planes, and darken cards toward the trunk / lower crown.
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vCrownAO;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrownAO = mix(0.5, 1.0, uv.x) * mix(0.72, 1.0, windWeight);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCrownAO;')
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
            // seen from below (geometric normal flipped away from up) → the shaded underside of the branch
            float underside = smoothstep( 0.35, -0.5, dot( nonPerturbedNormal, upV ) );
            diffuseColor.rgb *= mix( 1.0, 0.45, underside );
          }
          #include <normal_fragment_maps>
          {
            vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
            normal = normalize( mix( normal, upV, 0.45 ) );
          }`)
        .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
          {
            // needle translucency: sun shining through the crown toward the viewer glows gold
            #if NUM_DIR_LIGHTS > 0
              vec3 Lv = directionalLights[0].direction;
              vec3 Vv = normalize( vViewPosition );
              float vdotl = saturate( dot( -Vv, Lv ) );
              float trans = pow( vdotl, 5.0 ) * 0.55 + 0.08;
              reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * trans * 0.35;
            #endif
            reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.04;
          }`)
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vCrownAO;');
    };
    this.needleMaterial.customProgramCacheKey = () => 'needles';
    this.twigMaterial = new THREE.MeshStandardMaterial({
      map: twigDiff, normalMap: twigNor, aoMap: twigArm, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, envMapIntensity: 0.45,
      color: new THREE.Color(0.6, 0.8, 0.5), normalScale: new THREE.Vector2(0.7, 0.7),
    });
    this.twigMaterial.onBeforeCompile = (shader) => {
      attachFogUniforms(shader); patchWind(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_maps>', `
          { vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ); diffuseColor.rgb *= mix( 1.0, 0.5, smoothstep( 0.35, -0.5, dot( nonPerturbedNormal, upV ) ) ); }
          #include <normal_fragment_maps>
          { vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ); normal = normalize( mix( normal, upV, 0.35 ) ); }`)
        .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
          reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.05;`);
    };
    this.twigMaterial.customProgramCacheKey = () => 'twigs';
    this.twigDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: twigDiff, alphaTest: 0.5, side: THREE.DoubleSide });
    this.twigDepth.onBeforeCompile = (shader) => patchWind(shader);
    this.twigDepth.customProgramCacheKey = () => 'tree-depth'; // same wind patch as the needles' depth material: one program
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: card.albedo, alphaTest: 0.45, side: THREE.DoubleSide });
    this.needleDepth.onBeforeCompile = (shader) => patchWind(shader);
    this.needleDepth.customProgramCacheKey = () => 'tree-depth';

    const rng = new Rng(4242);
    for (const [i, s] of TREE_SPECS.entries()) { // src/world/placement.ts: the forest plants by the same heights / trunk radii
      if (i > 0) await macrotask(); // a variant per task (all four + the impostor bake: one ~150 ms task at 4x CPU)
      const hi = this.buildTree(s.height, s.trunk, new Rng(s.seed * 77 + 1), 1.0);
      const lo = this.buildTree(s.height, s.trunk, new Rng(s.seed * 77 + 1), 0.45);
      this.variants.push({ trunk: hi.trunk, cardsHi: hi.cards, cardsLo: lo.cards, twigs: hi.twigs, far: new THREE.BufferGeometry(), height: s.height, trunkRadius: s.trunk });
    }
    void rng;
    await macrotask();
    this.bakeImpostors(card.albedo, bark.map);
    return this;
  }

  // ---------------------------------------------------------------- far-tree impostor bake
  /**
   * Render each variant's hi tree (cards + trunk) from the side into one atlas column of albedo and
   * of view-space normals (bent toward up like the needle shader), then build the 2-quad cross that
   * wears it. Beyond `treeLoDist` a tree is 4 triangles instead of ~1 300.
   */
  private bakeImpostors(cardAlbedo: THREE.Texture, barkMap: THREE.Texture) {
    markGpuOnly('pine impostors'); // render targets only: a lost context cannot bring them back in place (E54)
    const n = this.variants.length;
    const COL = TIER_CONFIG.maxTexture >= 2048 ? 512 : 256, W = COL * n, H = COL * 2;
    const rt = (colorSpace: THREE.ColorSpace) => new THREE.WebGLRenderTarget(W, H, { colorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const albedoRT = rt(THREE.SRGBColorSpace), normalRT = rt(THREE.LinearSRGBColorSpace);
    const needleColor = this.needleMaterial.color, barkColor = this.barkMaterial.color;
    const mk = (map: THREE.Texture, tint: THREE.Color, mode: number, isBark: boolean, height: number) => new THREE.ShaderMaterial({
      uniforms: { tMap: { value: map }, uTint: { value: tint }, uMode: { value: mode }, uCrown: { value: isBark ? 0 : 1 }, uHeight: { value: height } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        uniform float uHeight;
        varying vec2 vUv; varying vec3 vN; varying float vAO;
        void main() {
          vUv = uv; vN = normalize( normalMatrix * normal );
          vAO = mix( 0.5, 1.0, uv.x ) * mix( 0.72, 1.0, position.y / uHeight );
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMap; uniform vec3 uTint; uniform int uMode; uniform float uCrown;
        varying vec2 vUv; varying vec3 vN; varying float vAO;
        void main() {
          vec4 d = texture2D( tMap, vUv );
          if ( d.a < 0.45 ) discard;
          if ( uMode == 0 ) { gl_FragColor = vec4( d.rgb * uTint * mix( 1.0, vAO, uCrown ), 1.0 ); return; }
          vec3 nn = normalize( vN ); if ( !gl_FrontFacing ) nn = -nn; if ( nn.z < 0.0 ) nn.z = -nn.z;
          nn = normalize( mix( nn, vec3( 0.0, 1.0, 0.0 ), 0.45 * uCrown ) );
          gl_FragColor = vec4( nn * 0.5 + 0.5, 1.0 );
        }`,
    });
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, 0, 0.1, 400);
    const prev = this.renderer.getRenderTarget();
    const prevClear = this.renderer.getClearColor(new THREE.Color()); const prevAlpha = this.renderer.getClearAlpha();
    const prevTone = this.renderer.toneMapping; this.renderer.toneMapping = THREE.NoToneMapping;
    this.variants.forEach((v, i) => {
      v.cardsHi.computeBoundingBox(); const bb = v.cardsHi.boundingBox;
      if (!bb) throw new Error('[trees] no bounding box');
      const halfW = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.z), Math.abs(bb.max.z)) * 1.02;
      // column aspect is 1:2 → frame = 2·halfW wide, 4·halfW tall (the tree is always taller than wide)
      const frameH = Math.max(v.height * 1.02, halfW * 4), frameW = frameH / 2;
      cam.left = -frameW / 2; cam.right = frameW / 2; cam.top = frameH; cam.bottom = 0; cam.updateProjectionMatrix();
      cam.position.set(0, 0, 200); cam.lookAt(0, 0, 0);
      for (let mode = 0; mode < 2; mode++) {
        scene.clear();
        scene.add(new THREE.Mesh(v.cardsHi, mk(cardAlbedo, needleColor, mode, false, v.height)), new THREE.Mesh(v.trunk, mk(barkMap, new THREE.Color().copy(barkColor).multiplyScalar(0.7), mode, true, v.height)));
        const target = mode === 0 ? albedoRT : normalRT;
        // column i of the atlas: the target's own viewport / scissor (renderer.setViewport would clobber the canvas viewport)
        target.viewport.set(i * COL, 0, COL, H); target.scissor.set(i * COL, 0, COL, H); target.scissorTest = true;
        this.renderer.setRenderTarget(target);
        this.renderer.setClearColor(mode === 0 ? new THREE.Color(0.1, 0.16, 0.07) : new THREE.Color(0.5, 0.5, 1.0), mode === 0 ? 0 : 1);
        this.renderer.clear();
        this.renderer.render(scene, cam);
      }
      // the cross: two vertical quads, pivot at the base, UVs into column i
      const geos: THREE.BufferGeometry[] = [];
      for (const yaw of [0, Math.PI / 2]) {
        const q = new THREE.PlaneGeometry(frameW, frameH);
        q.translate(0, frameH / 2, 0);
        q.rotateY(yaw);
        const uv = q.getAttribute('uv');
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / n, uv.getY(k));
        geos.push(q);
      }
      const far = mergeGeometries(geos, false);
      const fp = far.getAttribute('position');
      const wind = new Float32Array(fp.count);
      for (let k = 0; k < fp.count; k++) wind[k] = fp.getY(k) / v.height;
      far.setAttribute('windWeight', new THREE.BufferAttribute(wind, 1));
      far.computeBoundingSphere();
      v.far = far;
    });
    for (const t of [albedoRT, normalRT]) { t.viewport.set(0, 0, W, H); t.scissor.set(0, 0, W, H); t.scissorTest = false; }
    this.renderer.setRenderTarget(prev); this.renderer.setClearColor(prevClear, prevAlpha); this.renderer.toneMapping = prevTone;
    for (const t of [albedoRT.texture, normalRT.texture]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; }
    this.farMaterial = new THREE.MeshStandardMaterial({
      map: albedoRT.texture, normalMap: normalRT.texture, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.96, metalness: 0, envMapIntensity: 0.45,
      color: new THREE.Color(1, 1, 1), normalScale: new THREE.Vector2(1, 1),
    });
    this.farMaterial.onBeforeCompile = (shader) => {
      attachFogUniforms(shader); patchWind(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <alphatest_fragment>', /* glsl */`
          diffuseColor.a = clamp( ( diffuseColor.a - alphaTest ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );
          if ( diffuseColor.a < 0.5 ) discard;`)
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
        .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
          reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.06;`);
    };
    this.farMaterial.customProgramCacheKey = () => 'tree-far';
  }

  // ---------------------------------------------------------------- branch card bake
  private bakeBranchCard(diff: THREE.Texture, nor: THREE.Texture, arm: THREE.Texture) {
    markGpuOnly('branch cards');
    // twig region in the atlas (vertical twig, base at the bottom)
    const u0 = 30 / 1024, u1 = 230 / 1024, v0 = 1 - 448 / 1024, v1 = 1 - 40 / 1024;
    const twigGeo = new THREE.PlaneGeometry(1, 1);
    const uv = twigGeo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    twigGeo.translate(0, 0.5, 0); // pivot at the base

    const scene = new THREE.Scene();
    const rng = new Rng(99);
    const group = new THREE.Group();
    const aspect = 200 / 408; // twig width / height
    // main stem from (-1,0) to (1,0) in the XY plane; twigs alternate along it, angled toward the tip
    const N = 22;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      for (const side of [1, -1]) {
        for (let layer = 0; layer < 2; layer++) {
          const x = -0.98 + t * 1.9 + rng.range(-0.04, 0.04);
          const len = (0.66 - t * 0.34) * rng.range(0.75, 1.2);
          const m = new THREE.Mesh(twigGeo);
          m.position.set(x, side * rng.range(0.0, 0.08), layer * 0.04 + rng.range(-0.02, 0.02));
          // twig +Y points away from the stem and forward (+x); -1.05 rad ≈ 60° forward-up, mirrored below
          const base = side > 0 ? -1.0 : -2.14;
          m.rotation.z = base + rng.range(-0.25, 0.25) + layer * (side > 0 ? -0.2 : 0.2);
          m.rotation.x = rng.range(-0.4, 0.4);
          m.scale.set(len * aspect * (rng.next() < 0.5 ? 1 : -1), len, 1);
          group.add(m);
        }
      }
    }
    // tip twigs pointing along +x
    for (let i = 0; i < 3; i++) {
      const tip = new THREE.Mesh(twigGeo); tip.position.set(0.9 + i * 0.03, (i - 1) * 0.05, 0.02 * i);
      tip.rotation.z = -Math.PI / 2 + (i - 1) * 0.25; tip.scale.set(0.42 * aspect, 0.5, 1); group.add(tip);
    }
    // stem: a thin dark strip so the branch reads as connected
    const stemShape = new THREE.Shape([new THREE.Vector2(-1, -0.03), new THREE.Vector2(0.95, -0.006), new THREE.Vector2(0.95, 0.006), new THREE.Vector2(-1, 0.03)]);
    const stem = new THREE.Mesh(new THREE.ShapeGeometry(stemShape), new THREE.MeshBasicMaterial({ color: 0x2a1d12 }));
    stem.position.set(0, 0, -0.02); group.add(stem);
    // fit the whole branch inside the card frame so no twig gets clipped into a straight edge
    {
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3(); box.getSize(size);
      const centre = new THREE.Vector3(); box.getCenter(centre);
      const fit = Math.min(1.96 / size.x, 0.96 / size.y);
      group.scale.setScalar(fit);
      group.position.set(-centre.x * fit, -centre.y * fit, 0);
    }
    scene.add(group);

    const cam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.01, 10);
    cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);
    const W = 2048, H = 1024;
    const rt = (colorSpace: THREE.ColorSpace) => new THREE.WebGLRenderTarget(W, H, { colorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });

    const stemMats = [new THREE.MeshBasicMaterial({ color: 0x1a120b }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, 1.0) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.95, 0) })] as const;
    const render = (mode: 0 | 1 | 2, mat: THREE.Material, target: THREE.WebGLRenderTarget, clear: THREE.Color, clearAlpha: number) => {
      group.traverse((o) => { if (o instanceof THREE.Mesh && o !== stem) o.material = mat; });
      stem.material = stemMats[mode];
      const prev = this.renderer.getRenderTarget();
      const prevClear = this.renderer.getClearColor(new THREE.Color()); const prevAlpha = this.renderer.getClearAlpha();
      const prevTone = this.renderer.toneMapping; this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.setRenderTarget(target); this.renderer.setClearColor(clear, clearAlpha); this.renderer.clear();
      this.renderer.render(scene, cam);
      this.renderer.setRenderTarget(prev); this.renderer.setClearColor(prevClear, prevAlpha); this.renderer.toneMapping = prevTone;
    };

    const bakeMat = (mode: number) => new THREE.ShaderMaterial({
      uniforms: { tDiff: { value: diff }, tNor: { value: nor }, tArm: { value: arm }, uMode: { value: mode } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vB;
        void main() {
          vUv = uv;
          vN = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
          vT = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
          vB = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiff; uniform sampler2D tNor; uniform sampler2D tArm; uniform int uMode;
        varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vB;
        void main() {
          vec4 d = texture2D(tDiff, vUv);
          if (d.a < 0.5) discard;
          if (uMode == 0) { gl_FragColor = vec4(d.rgb, 1.0); return; }
          if (uMode == 2) { gl_FragColor = vec4(texture2D(tArm, vUv).rgb, 1.0); return; }
          vec3 mapN = texture2D(tNor, vUv).xyz * 2.0 - 1.0;
          mapN.xy *= 0.7;
          vec3 n = normalize(vT * mapN.x + vB * mapN.y + vN * mapN.z);
          if (!gl_FrontFacing) n = -n;
          if (n.z < 0.0) n.z = -n.z;
          gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
        }`,
    });

    const albedoRT = rt(THREE.SRGBColorSpace);
    render(0, bakeMat(0), albedoRT, new THREE.Color(0.1, 0.16, 0.07), 0);
    const normalRT = rt(THREE.LinearSRGBColorSpace);
    render(1, bakeMat(1), normalRT, new THREE.Color(0.5, 0.5, 1.0), 1);
    const armRT = rt(THREE.LinearSRGBColorSpace);
    render(2, bakeMat(2), armRT, new THREE.Color(1, 0.85, 0), 1);

    for (const target of [albedoRT, normalRT, armRT]) { const t = target.texture; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; (t as THREE.Texture & { __rt?: THREE.WebGLRenderTarget }).__rt = target; }
    twigGeo.dispose();
    return { albedo: albedoRT.texture, normal: normalRT.texture, arm: armRT.texture };
  }

  // ---------------------------------------------------------------- tree geometry
  private buildTree(height: number, trunkR: number, rng: Rng, detail: number): { trunk: THREE.BufferGeometry; cards: THREE.BufferGeometry; twigs: THREE.BufferGeometry } {
    // trunk: tapered, slightly bent cylinder
    const segsY = 10;
    const trunk = new THREE.CylinderGeometry(1, 1, 1, 9, segsY, true);
    const tp = trunk.getAttribute('position');
    const tuv = trunk.getAttribute('uv');
    const bendX = rng.range(-0.6, 0.6), bendZ = rng.range(-0.6, 0.6);
    for (let i = 0; i < tp.count; i++) {
      const y01 = tp.getY(i) + 0.5;
      const r = trunkR * (1 - y01) + 0.05 + (y01 < 0.08 ? (0.08 - y01) * 2.5 * trunkR : 0); // root flare
      const dirX = tp.getX(i), dirZ = tp.getZ(i);
      tp.setXYZ(i, dirX * r + bendX * y01 * y01, y01 * height, dirZ * r + bendZ * y01 * y01);
      tuv.setXY(i, tuv.getX(i) * 1.6, y01 * height * 0.35);
    }
    trunk.computeVertexNormals();

    // branch cards
    const card = new THREE.PlaneGeometry(2, 1, 4, 1);  // matches the bake: x ∈ [-1,1], y ∈ [-0.5,0.5]
    card.translate(1, 0, 0);                           // pivot at the base of the branch
    {
      // droop the tip: real pine branches sag then curl up at the end
      const cp = card.getAttribute('position');
      for (let i = 0; i < cp.count; i++) { const x = cp.getX(i) / 2; cp.setZ(i, cp.getZ(i) + (-0.12 * x * x + 0.06 * x * x * x)); }
      card.computeVertexNormals();
    }
    // near-field twigs: the raw atlas twig (same crop as the bake), pivot at its base
    const twig = new THREE.PlaneGeometry(1, 1);
    {
      const uv = twig.getAttribute('uv');
      const u0 = 30 / 1024, u1 = 230 / 1024, v0 = 1 - 448 / 1024, v1 = 1 - 40 / 1024;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      twig.translate(0, 0.5, 0);
    }
    // every card / twig is a transformed copy of its template, merged into one geometry
    const cards = new MatrixMerge(card), twigs = new MatrixMerge(twig);
    const twigAspect = 200 / 408;
    const crownStart = height * (height < 15 ? rng.range(0.12, 0.2) : rng.range(0.3, 0.42));
    const whorlStep = 0.5 + height * 0.011;
    let y = crownStart;
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    while (y < height * 0.96) {
      const t = (y - crownStart) / (height - crownStart);
      const count = Math.max(2, Math.round((9 - t * 4.5) * detail + rng.range(0, 1)));
      const baseLen = (3.9 - t * 3.1) * (height / 20) * rng.range(0.85, 1.15);
      const yawOff = rng.range(0, Math.PI * 2);
      for (let b = 0; b < count; b++) {
        if (rng.next() < 0.12) continue;                       // gaps make the silhouette read as organic
        const yaw = yawOff + (b / count) * Math.PI * 2 + rng.range(-0.45, 0.45);
        const droop = -0.4 + t * 0.32 + rng.range(-0.2, 0.2);
        const len = baseLen * rng.range(0.6, 1.25);
        const width = len * 0.5;
        const rTrunk = trunkR * (1 - y / height) + 0.02;
        const ox = Math.cos(yaw) * rTrunk, oz = -Math.sin(yaw) * rTrunk;
        const roll0 = rng.range(-0.5, 0.5);
        // three quads in a shallow fan give the branch volume from every angle
        for (const roll of [0.7, 0.0, -0.7]) {
          e.set(0, yaw, droop, 'YXZ');
          q.setFromEuler(e);
          const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll + roll0);
          q.multiply(qr);
          tmp.compose(new THREE.Vector3(ox + bendX * (y / height) ** 2, y, oz + bendZ * (y / height) ** 2), q, new THREE.Vector3(len, width, 1));
          cards.add(tmp);
        }
        // twigs hanging off the branch (near-field only): a few along the outer half, drooping
        if (detail > 0.6) {
          const n = 3 + Math.floor(rng.next() * 3);
          const dirX = Math.cos(yaw) * Math.cos(droop), dirY = Math.sin(droop), dirZ = -Math.sin(yaw) * Math.cos(droop);
          for (let k = 0; k < n; k++) {
            const along = len * rng.range(0.45, 1.0);
            const side = rng.next() < 0.5 ? 1 : -1;
            const tl = rng.range(0.55, 0.95) * Math.min(1.2, len * 0.3);
            e.set(rng.range(-0.5, 0.5), yaw + side * rng.range(0.5, 1.4), -Math.PI / 2 + rng.range(-0.6, 0.2), 'YXZ'); q.setFromEuler(e);
            tmp.compose(new THREE.Vector3(ox + bendX * (y / height) ** 2 + dirX * along + rng.range(-0.15, 0.15), y + dirY * along - 0.12 * (along / len) ** 2 * len, oz + bendZ * (y / height) ** 2 + dirZ * along + rng.range(-0.15, 0.15)), q, new THREE.Vector3(tl * twigAspect * (rng.next() < 0.5 ? 1 : -1), tl, 1));
            twigs.add(tmp);
          }
        }
        // a short inner card angled up fills the crown between whorls
        if (detail > 0.6 && rng.next() < 0.8) {
          e.set(0, yaw + rng.range(-0.5, 0.5), 0.25 + rng.range(0, 0.3), 'YXZ'); q.setFromEuler(e);
          const l2 = len * 0.45;
          tmp.compose(new THREE.Vector3(ox + bendX * (y / height) ** 2, y + rng.range(0, 0.4), oz + bendZ * (y / height) ** 2), q, new THREE.Vector3(l2, l2 * 0.5, 1));
          cards.add(tmp);
        }
      }
      y += whorlStep * rng.range(0.8, 1.2);
    }
    // leader: two crossed vertical cards at the top
    for (const yaw of [0, Math.PI / 2]) {
      e.set(0, yaw, Math.PI / 2 - 0.05, 'YXZ'); q.setFromEuler(e);
      const len = height * 0.09;
      tmp.compose(new THREE.Vector3(bendX, height * 0.95, bendZ), q, new THREE.Vector3(len, len * 0.5, 1));
      cards.add(tmp);
    }
    const cardGeo = cards.build();
    // store normalized height in uv2.x → wind weight
    const cp = cardGeo.getAttribute('position');
    const wind = new Float32Array(cp.count);
    for (let i = 0; i < cp.count; i++) wind[i] = cp.getY(i) / height;
    cardGeo.setAttribute('windWeight', new THREE.BufferAttribute(wind, 1));
    const tw = new Float32Array(tp.count);
    for (let i = 0; i < tp.count; i++) tw[i] = (tp.getY(i) / height) * 0.35;
    trunk.setAttribute('windWeight', new THREE.BufferAttribute(tw, 1));

    const twigGeo = twigs.count > 0 ? twigs.build() : new THREE.BufferGeometry();
    if (twigs.count > 0) {
      const tp2 = twigGeo.getAttribute('position');
      const w2 = new Float32Array(tp2.count);
      for (let i = 0; i < tp2.count; i++) w2[i] = tp2.getY(i) / height;
      twigGeo.setAttribute('windWeight', new THREE.BufferAttribute(w2, 1));
      twigGeo.computeBoundingSphere();
    }

    trunk.computeBoundingSphere();
    cardGeo.computeBoundingSphere();
    card.dispose(); twig.dispose();
    return { trunk, cards: cardGeo, twigs: twigGeo };
  }
}

/** Sway vertices in the wind; uses the shared windUniforms so every tree animates in step. */
export function patchWind(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }): void {
  shader.uniforms['uTime'] = windUniforms.uTime;
  shader.uniforms['uWindStrength'] = windUniforms.uWindStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uTime; uniform float uWindStrength;
      attribute float windWeight;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 wp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        #ifdef USE_BATCHING
          wp = batchingMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        float phase = wp.x * 0.07 + wp.z * 0.09;
        float w = windWeight * windWeight * uWindStrength;
        float gust = sin( uTime * 0.9 + phase ) * 0.6 + sin( uTime * 2.3 + phase * 2.7 ) * 0.25 + sin( uTime * 5.1 + wp.y * 0.5 + phase * 4.0 ) * 0.08;
        transformed.x += gust * w * 0.9;
        transformed.z += cos( uTime * 0.7 + phase * 1.3 ) * w * 0.45;
        transformed.y -= abs( gust ) * w * 0.15;
      }`);
}
