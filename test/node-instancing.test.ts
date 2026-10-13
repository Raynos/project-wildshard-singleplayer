import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { buildWithInstanceAttributes, instanceAttributeShader, nodeInstanceKey } from '../src/engine/render/nodes/nodeInstancing';

describe('node graph instance attributes', () => {
  it('keys shader features independently of count, identity and material map', () => {
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const first = new InstancedMesh(geometry, material, 3), second = new InstancedMesh(geometry, material, 1100);
    expect(nodeInstanceKey(first)).toBe(nodeInstanceKey(second));
    expect(nodeInstanceKey(new Mesh(geometry, material))).not.toBe(nodeInstanceKey(first));
    second.instanceColor = new InstancedBufferAttribute(new Float32Array(3300), 3);
    expect(nodeInstanceKey(second)).not.toBe(nodeInstanceKey(first));
    first.dispose(); second.dispose(); geometry.dispose(); material.dispose();
  });

  it('declares reserved attributes only for the actual draw features', () => {
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const instance = new InstancedMesh(geometry, material, 5);
    expect(instanceAttributeShader('shader', new Mesh(geometry, material))).toBe('shader');
    expect(instanceAttributeShader('shader', instance)).toBe('in mat4 instanceMatrix;\nshader');
    instance.instanceColor = new InstancedBufferAttribute(new Float32Array(15), 3);
    expect(instanceAttributeShader('shader', instance)).toBe('in mat4 instanceMatrix;\nin vec3 instanceColor;\nshader');
    instance.dispose(); geometry.dispose(); material.dispose();
  });

  it('restores the material setup after an interrupted build', () => {
    const material = new MeshBasicNodeMaterial(), setup: unknown = Reflect.get(material, 'setupPosition');
    expect(() => buildWithInstanceAttributes(material, () => { throw new Error('interrupted builder'); })).toThrow('interrupted builder');
    expect(Reflect.get(material, 'setupPosition')).toBe(setup);
    expect(material.positionNode).toBeNull();
    material.dispose();
  });
});
