import * as THREE from 'three';
import { expect, it } from 'vitest';
import { rainCurtain } from '../../src/game/systems/looks/rainCurtain';
import { RAIN_PROGRAM as PINE_RAIN } from '../../src/shards/pine-hollow/world/rainProgram';
import { RAIN_PROGRAM as STEPPE_RAIN } from '../../src/shards/nalati-grasslands/world/rainProgram';
import frozen from './fixtures/rain-curtain-e357.json';

const hash = async (bytes: string | Uint8Array): Promise<string> => {
  const input = new Uint8Array(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes);
  const digest = await crypto.subtle.digest('SHA-256',input);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2,'0')).join('');
};
it('both curtains retain the original seeded geometry and byte-identical shader programs', async () => {
  for (const [slug, program] of [['pine-hollow',PINE_RAIN],['nalati-grasslands',STEPPE_RAIN]] as const) {
    const mesh = rainCurtain({ count: 32, seed: 1337, uniforms: {}, program });
    const geometry: Record<string,string> = {};
    for (const [name,attribute] of Object.entries(mesh.geometry.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute)) throw new Error('unexpected rain attribute');
      geometry[name] = await hash(new Uint8Array(attribute.array.buffer));
    }
    const index = mesh.geometry.index;
    if (!index) throw new Error('rain index missing');
    geometry['index'] = await hash(new Uint8Array(index.array.buffer));
    const mat = mesh.material;
    if (!(mat instanceof THREE.ShaderMaterial)) throw new Error('rain shader missing');
    expect({ geometry, vertexShader:await hash(mat.vertexShader), fragmentShader:await hash(mat.fragmentShader) }).toEqual(frozen[slug]);
    expect(mesh).not.toBeInstanceOf(THREE.InstancedMesh);
    mesh.geometry.dispose(); mat.dispose();
  }
});
