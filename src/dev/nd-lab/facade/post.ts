// The lab's frame: the world into an MSAA ×4 HDR target with its depth → a half-res dual-filter bloom (emissive only:
// lit windows, sign boxes) → one composite: the depth silhouette (ink), the bloom soaked into the silk, a soft
// shoulder, sRGB, grain. A trimmed copy of the clean room's pipeline so the facade is judged in the same light.
import {
  AdditiveBlending, BufferGeometry, type Camera, DepthTexture, Float32BufferAttribute, HalfFloatType, Mesh, NearestFilter,
  NoBlending, OrthographicCamera, type Scene, ShaderMaterial, type Texture, UnsignedIntType, Vector2, type WebGLRenderer,
  WebGLRenderTarget, Color,
} from 'three';

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FS_PRE = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThr;
varying vec2 vUv;
void main() {
  vec3 a = texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb, b = texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb, d = texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b))), wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b))), wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  float br = max(col.r, max(col.g, col.b));
  gl_FragColor = vec4(col * max(br - uThr, 0.0) / max(br, 1e-4), 1.0);
}
`;
const FS_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;
const FS_UP = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = (texture(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb
    + texture(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 12.0 * 0.9, 1.0);
}
`;
const FS_COMP = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D uSilk;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uBloom;
uniform float uLineScale;
uniform float uTime;
uniform vec3 uInk;
varying vec2 vUv;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float ld(float z) { return 2.0 * uNear * uFar / (uFar + uNear - (2.0 * z - 1.0) * (uFar - uNear)); }
float invD(vec2 uv) { return 1.0 / ld(texture(tDepth, uv).r); }
vec3 shoulder(vec3 x) { vec3 k = 0.74 + 0.26 * (1.0 - exp(-(x - 0.74) / 0.26)); return mix(x, k, step(0.74, x)); }
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float contour(vec2 uv, float wc, float r) {
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel, o3 = vec2(r, r) * uTexel * 0.7071, o4 = vec2(r, -r) * uTexel * 0.7071;
  float l1 = (invD(uv + o1) + invD(uv - o1) - 2.0 * wc) / wc;
  float l2 = (invD(uv + o2) + invD(uv - o2) - 2.0 * wc) / wc;
  float l3 = (invD(uv + o3) + invD(uv - o3) - 2.0 * wc) / wc;
  float l4 = (invD(uv + o4) + invD(uv - o4) - 2.0 * wc) / wc;
  return smoothstep(0.012, 0.06, -min(min(l1, l2), min(l3, l4)));
}
void main() {
  vec4 c4 = texture(tColor, vUv);
  vec3 c = c4.rgb;
  float zc = texture(tDepth, vUv).r;
  float dc = ld(zc);
  float r = uLineScale * mix(1.3, 0.8, smoothstep(3.0, 60.0, dc));
  float edge = zc >= 0.999999 ? 0.0 : max(contour(vUv, 1.0 / dc, r), contour(vUv, 1.0 / dc, r * 0.5) * 0.8);
  edge *= (1.0 - smoothstep(50.0, 190.0, dc)) * smoothstep(0.2, 0.75, c4.a);
  vec3 lineC = mix(uInk, c, smoothstep(12.0, 160.0, dc) * 0.85);
  c = mix(c, lineC, edge);
  float weave = texture(uSilk, gl_FragCoord.xy / 320.0).r;
  c += texture(tBloom, vUv).rgb * uBloom * (0.78 + 0.44 * weave);
  c = shoulder(c);
  c *= 1.0 + (weave - 0.5) * 0.04;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.28;
  vec3 o = toSRGB(c);
  o += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}
`;

function fullTri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export class Pipeline {
  private readonly quad = new Mesh(fullTri());
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rt: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private readonly uPre = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uThr: { value: 1.0 } };
  private readonly uDown = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly uUp = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  readonly uComp: {
    tColor: { value: Texture | null }; tDepth: { value: Texture | null }; tBloom: { value: Texture | null }; uSilk: { value: Texture };
    uTexel: { value: Vector2 }; uNear: { value: number }; uFar: { value: number }; uBloom: { value: number };
    uLineScale: { value: number }; uTime: { value: number }; uInk: { value: Color };
  };
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  private readonly mComp: ShaderMaterial;
  private w = 1;
  private h = 1;

  constructor(private readonly renderer: WebGLRenderer, silk: Texture) {
    this.quad.frustumCulled = false;
    this.rt = this.make(1, 1);
    const base = { vertexShader: VS, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPre = new ShaderMaterial({ ...base, fragmentShader: FS_PRE, uniforms: this.uPre });
    this.mDown = new ShaderMaterial({ ...base, fragmentShader: FS_DOWN, uniforms: this.uDown });
    this.mUp = new ShaderMaterial({ ...base, fragmentShader: FS_UP, blending: AdditiveBlending, uniforms: this.uUp });
    this.uComp = {
      tColor: { value: null }, tDepth: { value: null }, tBloom: { value: null }, uSilk: { value: silk },
      uTexel: { value: new Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1200 }, uBloom: { value: 0.8 },
      uLineScale: { value: 1.5 }, uTime: { value: 0 }, uInk: { value: new Color(0x14161c) },
    };
    this.mComp = new ShaderMaterial({ ...base, fragmentShader: FS_COMP, uniforms: this.uComp });
  }

  private make(w: number, h: number): WebGLRenderTarget {
    const depth = new DepthTexture(w, h, UnsignedIntType);
    depth.minFilter = NearestFilter;
    depth.magFilter = NearestFilter;
    return new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4, depthBuffer: true, depthTexture: depth });
  }

  setSize(w: number, h: number, lineScale: number): void {
    this.uComp.uLineScale.value = lineScale;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.rt.dispose();
    this.rt = this.make(w, h);
    for (const m of this.mips) m.dispose();
    this.mips = [];
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    for (let i = 0; i < 4; i++) {
      this.mips.push(new WebGLRenderTarget(mw, mh, { type: HalfFloatType, depthBuffer: false }));
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
    }
  }

  private pass(m: ShaderMaterial, target: WebGLRenderTarget | null, clear = true): void {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    if (clear) this.renderer.clear(true, false, false);
    this.renderer.render(this.quad, this.ortho);
  }

  /** the sky / clear colour (linear). Set it with the HDR target bound: three encodes a clear colour to the output
   *  colour space (sRGB) when no target is bound, which left the lab's sky ~40 levels brighter than its fog */
  readonly clearColor = new Color(0.4, 0.45, 0.55);

  render(scene: Scene, camera: Camera & { near: number; far: number }, time: number): void {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.setClearColor(this.clearColor, 1);
    r.clear(true, true, false);
    r.render(scene, camera);
    // bloom: prefilter into mip 0, down the chain, up additively
    const m0 = this.mips[0];
    if (m0 !== undefined) {
      this.uPre.tSrc.value = this.rt.texture;
      this.uPre.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mPre, m0);
      for (let i = 1; i < this.mips.length; i++) {
        const src = this.mips[i - 1], dst = this.mips[i];
        if (src === undefined || dst === undefined) continue;
        this.uDown.tSrc.value = src.texture;
        this.uDown.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.mDown, dst);
      }
      for (let i = this.mips.length - 1; i > 0; i--) {
        const src = this.mips[i], dst = this.mips[i - 1];
        if (src === undefined || dst === undefined) continue;
        this.uUp.tSrc.value = src.texture;
        this.uUp.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.mUp, dst, false);
      }
    }
    this.uComp.tColor.value = this.rt.texture;
    this.uComp.tDepth.value = this.rt.depthTexture;
    this.uComp.tBloom.value = m0?.texture ?? null;
    this.uComp.uTexel.value.set(1 / this.w, 1 / this.h);
    this.uComp.uNear.value = camera.near;
    this.uComp.uFar.value = camera.far;
    this.uComp.uTime.value = time;
    this.pass(this.mComp, null);
  }
}
