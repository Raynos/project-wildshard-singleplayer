/**
 * three's point light node with its direct term as one shared layout function (G717.O4.4). PointLightNode.setupDirect
 * (r186 `directPointLight`) builds the light's direction, distance and distance attenuation inline for every light of
 * every node build; `wsPointLight` is those expressions in their order (three's own `getDistanceAttenuation` inside),
 * and three generates a layout function's code once per renderer, so a build pays one call a light. It returns the
 * light's direction and attenuated colour as a mat3's first two columns. EngineNodesHandler lights node materials'
 * PointLights through this node.
 */
import { ConvertNode, PointLightNode, type Node, type NodeBuilder } from 'three/webgpu';
import type { DirectLightData } from 'three/src/nodes/lighting/LightsNode.js';
import { Fn, getDistanceAttenuation, mat3, vec3 } from 'three/tsl';
import { MatrixColumnNode } from './matrixColumn';

type PointInputs = Readonly<Record<string, Node>>;
const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && Reflect.get(value, 'isNode') === true;
function pointInput(inputs: PointInputs, name: string): Node {
  const value = inputs[name];
  if (value === undefined) throw new Error(`pointLightNode: the point light term lacks ${name}`);
  return value;
}

const pointLight = Fn<PointInputs, Node>((inputs: PointInputs): Node => {
  const lightVector = new ConvertNode<'vec3'>(pointInput(inputs, 'lightVector'), 'vec3');
  const lightDirection = lightVector.normalize();
  const lightDistance = lightVector.length();
  const attenuation = getDistanceAttenuation({ lightDistance, cutoffDistance: pointInput(inputs, 'cutoffDistance'), decayExponent: pointInput(inputs, 'decayExponent') });
  const lightColor = new ConvertNode<'vec3'>(pointInput(inputs, 'color'), 'vec3').mul(attenuation);
  return mat3(lightDirection, lightColor, vec3(0));
}).setLayout({ name: 'wsPointLight', type: 'mat3', inputs: [
  { name: 'color', type: 'vec3' }, { name: 'lightVector', type: 'vec3' }, { name: 'cutoffDistance', type: 'float' }, { name: 'decayExponent', type: 'float' },
] });

/** three's point light node, its direct term as `wsPointLight` */
export class EnginePointLightNode extends PointLightNode {
  override setupDirect(builder: NodeBuilder): DirectLightData {
    // the light's colour after setupShadow (three's typings omit AnalyticLightNode's colorNode)
    const color: unknown = Reflect.get(this, 'colorNode');
    if (!isNode(color)) throw new Error('pointLightNode: a light colour that is not a node');
    const terms = pointLight({ color, lightVector: this.getLightVector(builder), cutoffDistance: this.cutoffDistanceNode, decayExponent: this.decayExponentNode });
    return { lightDirection: new MatrixColumnNode(terms, 0), lightColor: new MatrixColumnNode(terms, 1) };
  }
}
