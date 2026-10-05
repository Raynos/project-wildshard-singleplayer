/**
 * The sun's cascades and the shadow fade as nodes (SHARD-PLATFORM SF59 step 2, fix 3; sf59-tsl-spike.md §2.2).
 *
 * three's classic CSM lights a material with one DirectionalLight per cascade and gates each one to its depth slice in
 * its `lights_fragment_begin` (CSMShader.js, the CSM_FADE branch the sky rig uses); the engine's shadow fade (E147,
 * shadowFade.ts) mixes ghost i's shadow into cascade i's while `uSunFade` runs. EngineNodesHandler lights node materials
 * with this light node for every DirectionalLight: a light the sky rig registered as a cascade (world/cascadeLights.ts)
 * gets the chunk's gate, the rest light as three's own directional node. The gate, per cascade i with slice [x, y) of the
 * view depth over (far − near):
 *
 *   margin = ¼ · (the nearer slice edge)², the slice widened by margin / 2 each side, ratio = the distance into it / margin;
 *   a cascade but the last adds its shadowed light × ratio inside its widened slice (the chunk mixes the reflected light
 *   by ratio, and the direct terms are linear in the light's colour); the last adds it × ratio before its centre and
 *   mix(unshadowed, shadowed, ratio) after it, everywhere past its near edge.
 *
 * The fade: a cascade with a ghost uses mix(ghost shadow, its shadow, uSunFade). The ghosts light nothing (intensity 0),
 * so the handler leaves them out of the node lights; their shadow maps are still drawn by the classic shadow pass. The
 * sky rig's CSM light block (skyRig.ts patchCSMShaderChunk) re-inserts three's DFG multi-scatter block that CSMShader's
 * copy of the chunk predates; TSL's physical model carries that term already, so it needs no node.
 */
import * as THREE from 'three';
import { DirectionalLightNode, type Node, type NodeBuilder } from 'three/webgpu';
import type { DirectLightData } from 'three/src/nodes/lighting/LightsNode.js';
import { clamp, min, mix, positionView, reference, select, shadow, uniform, vec3 } from 'three/tsl';
import { cascadeOf, ghostOf } from '../../world/cascadeLights';

/** a light's colour node (three's d.ts types DirectLightData's colour as a bare Node) */
const isColour = (value: unknown): value is Node<'vec3'> => typeof value === 'object' && value !== null && Reflect.get(value, 'isNode') === true;
function colour(value: unknown): Node<'vec3'> {
  if (!isColour(value)) throw new Error('cascadeLightNode: a light colour that is not a node');
  return value;
}
const nearFar = (camera: THREE.Camera): { near: number; far: number } =>
  camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera ? { near: camera.near, far: camera.far } : { near: 0, far: 1 };

/** three's directional light node, gated as a cascade where the sky rig registered the light as one */
export class EngineDirectionalLightNode extends DirectionalLightNode {
  private ghostShadow: Node<'vec3'> | null = null;

  /** the light's direction and colour; a cascade's colour carries the CSM chunk's slice gate and the fade */
  override setupDirect(builder: NodeBuilder): DirectLightData | undefined {
    const data = super.setupDirect(builder);
    const light = this.light;
    if (data === undefined || light === null) return data;
    const cascade = cascadeOf(light);
    if (cascade === undefined) return data;
    const { set, index } = cascade;
    const csm = set.csm;
    // the shadow went in when setupShadow swapped the colour for colour × shadow (it keeps the plain one as baseColorNode)
    const baseNode: unknown = Reflect.get(this, 'baseColorNode');
    const received = isColour(baseNode) && baseNode !== data.lightColor;
    const shadowedIn = colour(data.lightColor);
    const base = received ? colour(baseNode) : shadowedIn;
    let shadowed = shadowedIn;
    const ghost = ghostOf(set, index);
    if (received && ghost !== undefined) {
      // E147: the cascade fades in from its ghost's shadow (the direction before the step)
      const ghostShadow = this.ghostShadow ?? colour(shadow(ghost)); // a shadow node is the light's colour factor
      this.ghostShadow = ghostShadow;
      shadowed = mix(base.mul(ghostShadow), shadowed, reference('value', 'float', set.fade));
    }
    const range = uniform(new THREE.Vector2()).onRenderUpdate(function update() {
      this.value.set(csm.breaks[index - 1] ?? 0, csm.breaks[index] ?? 0);
    });
    const depthSpan = uniform(1).onRenderUpdate(() => {
      const { near, far } = nearFar(csm.camera);
      return Math.min(far, csm.maxFar) - near;
    });
    const d = positionView.z.negate().div(depthSpan);
    const x = range.x, y = range.y;
    const centre = x.add(y).mul(0.5);
    const edge = select(d.lessThan(centre), x, y);
    const margin = edge.mul(edge).mul(0.25);
    const lo = x.sub(margin.mul(0.5)), hi = y.add(margin.mul(0.5));
    const ratio = clamp(min(d.sub(lo), hi.sub(d)).div(margin), 0, 1);
    const last = index === csm.cascades - 1;
    const lightColor = last
      ? select(d.greaterThanEqual(lo), select(d.lessThan(centre), shadowed.mul(ratio), mix(base, shadowed, ratio)), vec3(0))
      : select(d.greaterThanEqual(lo).and(d.lessThan(hi)), shadowed.mul(ratio), vec3(0));
    return { lightDirection: data.lightDirection, lightColor };
  }
}
