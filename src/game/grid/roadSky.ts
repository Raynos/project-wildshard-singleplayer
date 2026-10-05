/**
 * The road's own sky (SHARD-PLATFORM SF19a / SF19b, Jake's G165 pick "A, road light over everything",
 * `art/grid/round-17-road-view/board.jpg`): outside the cell you stand in, everything is under the neutral road look, sky
 * included; a shard's own sky shows only once you are inside it. The frame (`frame.ts`) hangs this on the road owner:
 * one camera-centred dome, a calm grey-blue gradient whose horizon is the frame's air (so far proxies haze into it), drawn
 * over the home look's sky pieces (its dome, clouds, planet and HDRI background: they write no depth and draw at render
 * order −20 … −10) and under every world transparent (render order ≥ 0), depth-tested so all geometry stays in front.
 * Its opacity is the road's frame weight: invisible (and not drawn) inside a cell, full on the road, blended across the
 * 16 m cell-edge band. Unlit, fogless, one draw while visible.
 */
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, type Object3D, type Vector3 } from 'three';
import { ROAD_SKY } from './frameModel';

/** the dome's radius (m): past every far proxy, inside the camera's far plane (2600 m) */
const RADIUS = 2300;
/** the render order: after the home look's sky pieces (−20 … −10), before the world's transparents (≥ 0) */
export const ROAD_SKY_ORDER = -9;

export class RoadSky {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly uniforms = { uHorizon: { value: new Color() }, uZenith: { value: new Color() }, uWeight: { value: 0 } };
  constructor() {
    this.material = new ShaderMaterial({
      uniforms: this.uniforms, side: BackSide, transparent: true, depthWrite: false, depthTest: true, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uHorizon; uniform vec3 uZenith; uniform float uWeight;
        varying vec3 vDir;
        void main() {
          float h = normalize(vDir).y;
          vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.8, h), 0.7));
          gl_FragColor = vec4(col, uWeight);
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(RADIUS, 32, 16), this.material);
    this.mesh.name = 'road-sky'; this.mesh.frustumCulled = false; this.mesh.renderOrder = ROAD_SKY_ORDER; this.mesh.visible = false;
  }

  /** Add to the scene (returns the removal). */
  attach(scene: Object3D): () => void { scene.add(this.mesh); return () => { scene.remove(this.mesh); }; }

  /** The road's weight (0..1): the dome's opacity; at 0 it is not drawn. */
  weight(w: number): void { this.uniforms.uWeight.value = w; this.mesh.visible = w > 0.001; }

  /** Before the scene draws: centre on the camera; the horizon is the frame's air, the zenith the road's calm blue over it. */
  frame(camera: Vector3, air: Color): void {
    this.mesh.position.copy(camera);
    this.uniforms.uHorizon.value.copy(air);
    this.uniforms.uZenith.value.setRGB(ROAD_SKY.zenith[0], ROAD_SKY.zenith[1], ROAD_SKY.zenith[2]).lerp(air, ROAD_SKY.zenithAir);
  }

  /** The dome's drawn opacity (the readout). */
  get drawn(): number { return this.mesh.visible ? this.uniforms.uWeight.value : 0; }

  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); }
}
