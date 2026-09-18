import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';
import { Uniform, Vector3, Matrix4, Color, PerspectiveCamera, Texture, DataTexture, RepeatWrapping, NearestFilter } from 'three';
import { fogUniforms } from '../world/Atmosphere';

/**
 * Screen-space volumetric light: for every pixel, march the view ray (up to the depth buffer)
 * through the same height-fog field the materials use, accumulating sun in-scatter that is
 * shadowed by a cheap screen-space occlusion test against the depth buffer projected toward
 * the sun. Produces warm light shafts through the canopy and thicker haze in the hollows,
 * with real depth occlusion — the "volumetrics" line in docs/AAA-PLAN.md.
 */
export class VolumetricsEffect extends Effect {
  constructor(camera: PerspectiveCamera, private readonly blueNoise: Texture, steps = 14) {
    super('VolumetricsEffect', /* glsl */`
      uniform mat4 uInvView; uniform mat4 uInvProj; uniform mat4 uViewProj;
      uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uFogColor;
      uniform float uHeight; uniform float uFalloff; uniform float uDensity; uniform float uStrength;
      uniform sampler2D uNoise; uniform float uFrame;

      float fogAt(vec3 p) { return uDensity * exp(-uFalloff * (p.y - uHeight)); }

      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        float viewZ = getViewZ(depth);
        vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 vp = uInvProj * clip; vp /= vp.w;
        vec3 worldEnd = (uInvView * vec4(vp.xyz, 1.0)).xyz;
        vec3 ray = worldEnd - uCamPos;
        float len = min(length(ray), 120.0);
        vec3 dir = ray / max(length(ray), 1e-3);
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        float phase = 0.15 + 0.85 * pow(sunAmt, 6.0);         // forward-scattering lobe

        const int N = ${steps};
        float jitter = texture2D(uNoise, gl_FragCoord.xy / 64.0 + fract(uFrame * 0.618) ).r;
        float stepLen = len / float(N);
        float t = stepLen * (0.25 + 0.5 * jitter);
        float scatter = 0.0, trans = 1.0;
        for (int i = 0; i < N; i++) {
          vec3 p = uCamPos + dir * t;
          float dens = fogAt(p);
          // shadow test: is the point lit by the sun? project a point 6 m toward the sun and compare depth
          vec4 sp = uViewProj * vec4(p + uSunDir * 6.0, 1.0);
          vec3 sn = sp.xyz / sp.w;
          float lit = 1.0;
          if (abs(sn.x) < 1.0 && abs(sn.y) < 1.0 && sp.w > 0.0) {
            float sceneDepth = readDepth(sn.xy * 0.5 + 0.5);
            float sceneZ = -getViewZ(sceneDepth);
            lit = sceneZ < sp.w - 0.5 ? 0.15 : 1.0;
          }
          float a = dens * stepLen;
          scatter += trans * a * lit;
          trans *= exp(-a);
          t += stepLen;
        }
        // stay subtle away from the sun; the geometry fog already carries the base haze
        vec3 inscatter = mix(uFogColor * 0.5, uSunColor, phase) * scatter * uStrength * (0.25 + 0.75 * phase);
        outputColor = vec4(inputColor.rgb + inscatter, inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uInvView', new Uniform(new Matrix4())],
        ['uInvProj', new Uniform(new Matrix4())],
        ['uViewProj', new Uniform(new Matrix4())],
        ['uCamPos', new Uniform(new Vector3())],
        ['uSunDir', new Uniform(new Vector3(0, 1, 0))],
        ['uSunColor', new Uniform(new Color(1, 0.7, 0.4))],
        ['uFogColor', new Uniform(new Color(0.6, 0.65, 0.75))],
        ['uHeight', new Uniform(-8)],
        ['uFalloff', new Uniform(0.12)],
        ['uDensity', new Uniform(0.0045)],
        ['uStrength', new Uniform(0.55)],
        ['uNoise', new Uniform(blueNoise)],
        ['uFrame', new Uniform(0)],
      ]),
    });
    this.camera = camera;
  }
  private camera: PerspectiveCamera;
  private frame = 0;
  private viewProj = new Matrix4();

  setSun(dir: Vector3, color: Color) { this.uniforms.get('uSunDir')!.value.copy(dir); this.uniforms.get('uSunColor')!.value.copy(color); }
  setFogColor(c: Color) { this.uniforms.get('uFogColor')!.value.copy(c); }

  override update() {
    const cam = this.camera;
    this.uniforms.get('uInvView')!.value.copy(cam.matrixWorld);
    this.uniforms.get('uInvProj')!.value.copy(cam.projectionMatrixInverse);
    this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.uniforms.get('uViewProj')!.value.copy(this.viewProj);
    this.uniforms.get('uCamPos')!.value.copy(cam.position);
    this.uniforms.get('uHeight')!.value = fogUniforms.fogHeight.value;
    this.uniforms.get('uFalloff')!.value = fogUniforms.fogHeightFalloff.value;
    this.uniforms.get('uFrame')!.value = (this.frame++ % 64);
  }
}

/** 64×64 interleaved-gradient noise: cheap, tileable, good enough to hide 14-step banding. */
export function makeNoiseTexture(): Texture {
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = (52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1)) % 1;
    const i = (y * N + x) * 4; data[i] = data[i + 1] = data[i + 2] = v * 255; data[i + 3] = 255;
  }
  const t = new DataTexture(data, N, N);
  t.wrapS = t.wrapT = RepeatWrapping; t.magFilter = t.minFilter = NearestFilter; t.needsUpdate = true;
  return t;
}
