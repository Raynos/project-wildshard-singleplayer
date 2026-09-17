import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadTexture, loadPBR } from '../core/assets';
import { Rng } from '../core/rng';
import { attachFogUniforms } from './Atmosphere';

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
  height: number;
  trunkRadius: number;
}

export const windUniforms = { uTime: { value: 0 }, uWindStrength: { value: 1.0 } };

export class TreeFactory {
  barkMaterial!: THREE.MeshStandardMaterial;
  needleMaterial!: THREE.MeshStandardMaterial;
  needleDepth!: THREE.MeshDepthMaterial;
  variants: TreeVariant[] = [];

  constructor(private renderer: THREE.WebGLRenderer) {}

  async build() {
    const [twigDiff, twigNor, twigArm, bark] = await Promise.all([
      loadTexture('/assets/tex/pine_tree_01/twig_rgba.png', true),
      loadTexture('/assets/tex/pine_tree_01/twig_nor_gl.jpg'),
      loadTexture('/assets/tex/pine_tree_01/twig_arm.jpg'),
      loadPBR('pine_bark', 1),
    ]);
    const card = this.bakeBranchCard(twigDiff, twigNor, twigArm);

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
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
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
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: card.albedo, alphaTest: 0.45, side: THREE.DoubleSide });
    this.needleDepth.onBeforeCompile = (shader) => patchWind(shader);
    this.needleDepth.customProgramCacheKey = () => 'needles-depth';

    const rng = new Rng(4242);
    const specs = [
      { height: 22, trunk: 0.42, seed: 1 },
      { height: 17, trunk: 0.34, seed: 2 },
      { height: 26, trunk: 0.5, seed: 3 },
      { height: 13, trunk: 0.27, seed: 4 },
    ];
    for (const s of specs) {
      const hi = this.buildTree(s.height, s.trunk, new Rng(s.seed * 77 + 1), 1.0);
      const lo = this.buildTree(s.height, s.trunk, new Rng(s.seed * 77 + 1), 0.45);
      this.variants.push({ trunk: hi.trunk, cardsHi: hi.cards, cardsLo: lo.cards, height: s.height, trunkRadius: s.trunk });
    }
    void rng;
    return this;
  }

  // ---------------------------------------------------------------- branch card bake
  private bakeBranchCard(diff: THREE.Texture, nor: THREE.Texture, arm: THREE.Texture) {
    // twig region in the atlas (vertical twig, base at the bottom)
    const u0 = 30 / 1024, u1 = 230 / 1024, v0 = 1 - 448 / 1024, v1 = 1 - 40 / 1024;
    const twigGeo = new THREE.PlaneGeometry(1, 1);
    const uv = twigGeo.attributes.uv as THREE.BufferAttribute;
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

    const stemMats = [new THREE.MeshBasicMaterial({ color: 0x2a1d12 }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, 1.0) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0) })];
    const render = (mode: number, mat: THREE.Material, target: THREE.WebGLRenderTarget, clear: THREE.Color, clearAlpha: number) => {
      group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== stem) (o as THREE.Mesh).material = mat; });
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
    render(0, bakeMat(0), albedoRT, new THREE.Color(0.12, 0.2, 0.08), 0);
    const normalRT = rt(THREE.LinearSRGBColorSpace);
    render(1, bakeMat(1), normalRT, new THREE.Color(0.5, 0.5, 1.0), 1);
    const armRT = rt(THREE.LinearSRGBColorSpace);
    render(2, bakeMat(2), armRT, new THREE.Color(1, 0.85, 0), 1);

    for (const t of [albedoRT.texture, normalRT.texture, armRT.texture]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; }
    twigGeo.dispose();
    return { albedo: albedoRT.texture, normal: normalRT.texture, arm: armRT.texture };
  }

  // ---------------------------------------------------------------- tree geometry
  private buildTree(height: number, trunkR: number, rng: Rng, detail: number): { trunk: THREE.BufferGeometry; cards: THREE.BufferGeometry } {
    // trunk: tapered, slightly bent cylinder
    const segsY = 10;
    const trunk = new THREE.CylinderGeometry(1, 1, 1, 9, segsY, true);
    const tp = trunk.attributes.position as THREE.BufferAttribute;
    const tuv = trunk.attributes.uv as THREE.BufferAttribute;
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
    const cards: THREE.BufferGeometry[] = [];
    const card = new THREE.PlaneGeometry(2, 1);       // matches the bake: x ∈ [-1,1], y ∈ [-0.5,0.5]
    card.translate(1, 0, 0);                           // pivot at the base of the branch
    const crownStart = height * (height < 15 ? rng.range(0.12, 0.2) : rng.range(0.3, 0.42));
    const whorlStep = 0.5 + height * 0.011;
    let y = crownStart;
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    while (y < height * 0.96) {
      const t = (y - crownStart) / (height - crownStart);
      const count = Math.max(2, Math.round((7 - t * 3.5) * detail + rng.range(0, 1)));
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
        const roll0 = rng.range(-0.4, 0.4);
        // two quads in a shallow V give the branch volume from every angle
        for (const roll of [0.55, -0.55]) {
          const g = card.clone();
          e.set(0, yaw, droop, 'YXZ');
          q.setFromEuler(e);
          const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll + roll0);
          q.multiply(qr);
          tmp.compose(new THREE.Vector3(ox + bendX * (y / height) ** 2, y, oz + bendZ * (y / height) ** 2), q, new THREE.Vector3(len, width, 1));
          g.applyMatrix4(tmp);
          cards.push(g);
        }
        // a short inner card angled up fills the crown between whorls
        if (detail > 0.6 && rng.next() < 0.5) {
          const g = card.clone();
          e.set(0, yaw + rng.range(-0.5, 0.5), 0.25 + rng.range(0, 0.3), 'YXZ'); q.setFromEuler(e);
          const l2 = len * 0.45;
          tmp.compose(new THREE.Vector3(ox + bendX * (y / height) ** 2, y + rng.range(0, 0.4), oz + bendZ * (y / height) ** 2), q, new THREE.Vector3(l2, l2 * 0.5, 1));
          g.applyMatrix4(tmp); cards.push(g);
        }
      }
      y += whorlStep * rng.range(0.8, 1.2);
    }
    // leader: two crossed vertical cards at the top
    for (const yaw of [0, Math.PI / 2]) {
      const g = card.clone();
      e.set(0, yaw, Math.PI / 2 - 0.05, 'YXZ'); q.setFromEuler(e);
      const len = height * 0.09;
      tmp.compose(new THREE.Vector3(bendX, height * 0.95, bendZ), q, new THREE.Vector3(len, len * 0.5, 1));
      g.applyMatrix4(tmp); cards.push(g);
    }
    const cardGeo = mergeGeometries(cards, false)!;
    // store normalized height in uv2.x → wind weight
    const cp = cardGeo.attributes.position as THREE.BufferAttribute;
    const wind = new Float32Array(cp.count);
    for (let i = 0; i < cp.count; i++) wind[i] = cp.getY(i) / height;
    cardGeo.setAttribute('windWeight', new THREE.BufferAttribute(wind, 1));
    const tw = new Float32Array(tp.count);
    for (let i = 0; i < tp.count; i++) tw[i] = (tp.getY(i) / height) * 0.35;
    trunk.setAttribute('windWeight', new THREE.BufferAttribute(tw, 1));

    trunk.computeBoundingSphere();
    cardGeo.computeBoundingSphere();
    for (const c of cards) c.dispose();
    card.dispose();
    return { trunk, cards: cardGeo };
  }
}

/** Sway vertices in the wind; uses the shared windUniforms so every tree animates in step. */
export function patchWind(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }) {
  shader.uniforms.uTime = windUniforms.uTime;
  shader.uniforms.uWindStrength = windUniforms.uWindStrength;
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
        wp = modelMatrix * wp;
        float phase = wp.x * 0.07 + wp.z * 0.09;
        float w = windWeight * windWeight * uWindStrength;
        float gust = sin( uTime * 0.9 + phase ) * 0.6 + sin( uTime * 2.3 + phase * 2.7 ) * 0.25 + sin( uTime * 5.1 + wp.y * 0.5 + phase * 4.0 ) * 0.08;
        transformed.x += gust * w * 0.9;
        transformed.z += cos( uTime * 0.7 + phase * 1.3 ) * w * 0.45;
        transformed.y -= abs( gust ) * w * 0.15;
      }`);
}
