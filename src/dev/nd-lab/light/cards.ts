// Lab P6 "light" (E169), the comparison method B: ground LIGHT CARDS — one instanced quad per light lying 2 cm over the
// square's flagstones, drawn additively after the opaque world (one draw). Each card paints the light's pool as the
// wet stone would show it: k·colour / (1 + (ρ² + h²) / r²) with a smooth edge, × a view term (a wet film reflects
// more at grazing angles), fogged like the ground. Kept for the A/B against the light volume (lightvol.ts), which won:
// see round-9-lab-light/README.md. Alpha is kept (the composite reads inverse depth from it).
import {
  AddEquation, CustomBlending, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, OneFactor, PlaneGeometry, ShaderMaterial,
  type IUniform, ZeroFactor,
} from 'three';
import type { PoolLight } from './lightvol';

const VS = /* glsl */ `
attribute vec4 aLight;   // xyz = the light, w = its radius r
attribute vec4 aCol;     // rgb = colour × k, a = the card's half size (m)
uniform float uGroundY;
varying vec3 vWorld;
varying vec4 vLight;
varying vec3 vCol;
varying float vViewZ;
void main() {
  vec3 p = vec3(aLight.x + position.x * aCol.a * 2.0, uGroundY + 0.02, aLight.z - position.y * aCol.a * 2.0);
  vWorld = p;
  vLight = aLight;
  vCol = aCol.rgb;
  vec4 vp = viewMatrix * vec4(p, 1.0);
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

export function cardsFragment(fogGlsl: string): string {
  return /* glsl */ `
uniform float uCardGain;
uniform float uGroundY;
varying vec3 vWorld;
varying vec4 vLight;
varying vec3 vCol;
varying float vViewZ;
${fogGlsl}
void main() {
  vec2 dp = vWorld.xz - vLight.xz;
  float h = vLight.y - uGroundY;
  float r2 = vLight.w * vLight.w;
  float rho2 = dot(dp, dp);
  float reach = vLight.w * 3.0;
  float edge = 1.0 - clamp(rho2 / (reach * reach), 0.0, 1.0);
  vec3 E = vCol / (1.0 + (rho2 + h * h) / r2) * edge * edge;
  vec3 V = normalize(uCam - vWorld);
  float film = 0.35 + 0.65 * pow(clamp(1.0 - V.y, 0.0, 1.0), 2.0);
  vec4 fg = silkFog(vWorld, 1.0);
  gl_FragColor = vec4(E * film * uCardGain * fg.a, 0.0);
}
`;
}

/** the cards for every light within `maxH` m over the ground and inside the square's bounds */
export function buildCards(lights: readonly PoolLight[], uniforms: Record<string, IUniform>, fogGlsl: string, groundY: number,
  keep: (l: PoolLight) => boolean, maxH = 7): { mesh: Mesh; gain: { value: number } } {
  const sel = lights.filter((l) => l.at.y > groundY && l.at.y - groundY < maxH && keep(l));
  const base = new PlaneGeometry(1, 1);
  const g = new InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.getAttribute('position'));
  const L = new Float32Array(sel.length * 4), C = new Float32Array(sel.length * 4);
  sel.forEach((l, i) => {
    L.set([l.at.x, l.at.y, l.at.z, l.r], i * 4);
    C.set([l.color.r * l.k, l.color.g * l.k, l.color.b * l.k, l.r * 3], i * 4);
  });
  g.setAttribute('aLight', new InstancedBufferAttribute(L, 4));
  g.setAttribute('aCol', new InstancedBufferAttribute(C, 4));
  g.instanceCount = sel.length;
  const gain = { value: 1 };
  const m = new ShaderMaterial({
    uniforms: { ...uniforms, uCardGain: gain, uGroundY: { value: groundY } },
    vertexShader: VS, fragmentShader: cardsFragment(fogGlsl),
    transparent: true, depthWrite: false,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
    blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
  });
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return { mesh, gain };
}
