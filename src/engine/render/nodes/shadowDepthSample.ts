/** Shadow maps are depth textures, so their backend Y convention is known at build time. */
import { DepthTexture } from 'three';
import { TextureNode, type Node, type NodeBuilder } from 'three/webgpu';
import { nodeObject, texture } from 'three/tsl';
import { setting } from '../../ui/Settings';

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'isNode') === true;
}

class ShadowDepthTextureNode extends TextureNode {
  setupUV(builder: NodeBuilder, uv: Node<'vec2'>): Node {
    if (!(this.value instanceof DepthTexture)) throw new Error('Shadow comparison needs a depth texture');
    // Keep the stock shader expression and uniform layout. Only its value is
    // fixed: a shadow depth map always has the backend's depth-texture flip.
    const setup: unknown = Reflect.get(TextureNode.prototype, 'setupUV');
    if (typeof setup !== 'function') throw new Error('Missing texture coordinate convention');
    const result: unknown = Reflect.apply(setup, this, [builder, uv]);
    const flip: unknown = Reflect.get(this, '_flipYUniform');
    if (typeof flip === 'object' && flip !== null) {
      Reflect.set(flip, 'value', true);
      // The returned UV graph owns the uniform now. Clear only the updater
      // handle, so TextureNode.setup leaves this comparison at updateType NONE.
      Reflect.set(this, '_flipYUniform', null);
    }
    if (!isNode(result)) throw new Error('Missing shadow coordinates');
    return result;
  }
}

/** Sample an engine-owned shadow depth map; taps, comparison and filtering stay with the caller. */
export function shadowDepthSample(depth: DepthTexture, uv: Node<'vec2'>, fixed = setting('fixedShadowSamples') === 'on'): TextureNode {
  return fixed ? nodeObject(new ShadowDepthTextureNode(depth, uv)) : texture(depth, uv);
}
