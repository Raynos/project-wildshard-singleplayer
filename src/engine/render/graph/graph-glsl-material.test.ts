// NF14: a classic graph material's clones share the graph's uniforms as a node material's clones share its uniform nodes,
// while a variant's own colour and borrowed map stay its own; a declared fog's params move every program selecting it.
import { expect, test } from 'vitest';
import * as THREE from 'three';
import { compileClassicGraph } from './glslMaterial';

test('a clone shares params, clocks and lent textures; its colour and borrowed map are its own', () => {
  const graph = { version: 1, kind: 'material', model: 'unlit', params: { tint: { type: 'colour', value: [1, 0.5, 0.25] }, ramp: { type: 'texture', value: 'ramp', role: 'lent' } },
    nodes: { t: { op: 'param', param: 'tint' }, u: { op: 'uv' }, r: { op: 'texture', param: 'ramp', in: ['u'] }, s: { op: 'swizzle', in: ['r'], mask: 'xyz' },
      c: { op: 'mul', in: ['t', 's'] }, w: { op: 'time' }, k: { op: 'mul', in: ['c', 'w'] }, m: { op: 'materialColour' }, o: { op: 'mul', in: ['k', 'm'] } },
    stages: { surface: { colour: 'o' } } };
  const compiled = compileClassicGraph(graph), source = compiled.material, copy = source.clone();
  expect(copy.uniforms['wsP_tint']).toBe(source.uniforms['wsP_tint']);
  expect(copy.uniforms['wsTime']).toBe(source.uniforms['wsTime']);
  compiled.setParam('tint', [0, 1, 0]);
  expect(copy.uniforms['wsP_tint']?.value).toEqual(new THREE.Color().setRGB(0, 1, 0, THREE.SRGBColorSpace));
  const ramp = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  compiled.setTexture('ramp', ramp);
  expect(copy.uniforms['wsT_ramp']?.value).toBe(ramp);
  copy.color.set(0xff0000);
  expect(source.color.getHex()).toBe(0xffffff);
  const map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  copy.map = map;
  expect(copy.defines['WS_MESH_MAP']).toBe('');
  expect(source.map).toBe(null);
  expect(copy.clone().map).toBe(map);
  expect(() => { compiled.setParam('tint', 1); }).toThrow(/type mismatch/);
  expect(() => { compiled.setTexture('tint', ramp); }).toThrow(/no sampled lent texture/);
});

test('a declared fog lends its own uniforms to every material that selects it', () => {
  const fogGraph = { version: 1, kind: 'fog', params: { density: { type: 'float', value: 0.5, min: 0, max: 1 } },
    nodes: { f: { op: 'fogInput' }, d: { op: 'param', param: 'density' }, e: { op: 'engineFogged' }, o: { op: 'mix', in: ['f', 'e', 'd'] } }, stages: { fog: { colour: 'o' } } };
  const fog = compileClassicGraph(fogGraph);
  if (fog.fog === null) throw new Error('a fog graph lowers its fog stage');
  const select = (): THREE.ShaderMaterial => compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', effectState: { fog: 'haze' }, nodes: {}, stages: { surface: { colour: [1, 1, 1] } } },
    { fog: id => { expect(id).toBe('haze'); if (fog.fog === null) throw new Error('fog'); return fog.fog; } }).material;
  const a = select(), b = select();
  expect(a.fragmentShader).toContain('wsGraphFog(');
  expect(a.uniforms['wsFogP_density']).toBe(b.uniforms['wsFogP_density']);
  fog.setParam('density', 0.25);
  expect(a.uniforms['wsFogP_density']?.value).toBe(0.25);
});

test('a displaced caster draws its shadow depth from its own vertex stage', () => {
  const compiled = compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', nodes: { p: { op: 'positionGeometry' }, y: { op: 'mul', in: ['p', [0, 1, 0]] } },
    stages: { 'vertex.offset': { offset: 'y', shadow: true }, surface: { colour: [1, 1, 1] } } });
  expect(compiled.depth?.vertexShader).toContain('transformed = wsPositionLocal +');
  expect(compiled.depth?.fragmentShader).toContain('1.0 - gl_FragCoord.z');
  expect(compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } }).depth).toBe(null);
});

test('a row sets a variant its own alphaTest and roughness, as on a node material', () => {
  const graph = { version: 1, kind: 'material', model: 'standard', nodes: { u: { op: 'uv' }, a: { op: 'swizzle', in: ['u'], mask: 'x' } },
    stages: { surface: { colour: [1, 1, 1], alpha: 'a', alphaCutoff: 0.5 } } };
  const compiled = compileClassicGraph(graph), source = compiled.material, copy = source.clone();
  expect(source.alphaTest).toBe(0.5); expect(source.roughness).toBe(1);
  expect(source.fragmentShader).toContain('diffuseColor.a < wsAlphaCutoff');
  expect(source.fragmentShader).toContain('roughnessFactor = wsMaterialRoughness');
  Object.assign(copy, { alphaTest: 0.35, roughness: 0.8 });
  expect(copy.uniforms['wsAlphaCutoff']?.value).toBe(0.35); expect(copy.uniforms['wsMaterialRoughness']?.value).toBe(0.8);
  expect(source.uniforms['wsAlphaCutoff']?.value).toBe(0.5); expect(source.uniforms['wsMaterialRoughness']?.value).toBe(1);
  expect(copy.clone().alphaTest).toBe(0.35);
  // a graph's own roughness output wins, as a node material's roughnessNode does
  const rough = compileClassicGraph({ ...graph, stages: { surface: { colour: [1, 1, 1], roughness: 0.3 } } }).material;
  expect(rough.fragmentShader).not.toContain('wsMaterialRoughness');
});

test('a declared attribute a mesh lacks reads its default, else TSL\'s constant (never a leftover generic value)', () => {
  const m = compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', nodes: { a: { op: 'attribute', name: 'aLump', type: 'vec4' }, b: { op: 'attribute', name: 'aTone', type: 'vec2', default: [0.5, 1] },
    c: { op: 'swizzle', in: ['a'], mask: 'xyz' }, d: { op: 'swizzle', in: ['b'], mask: 'x' }, e: { op: 'mul', in: ['c', 'd'] }, v: { op: 'varying', in: ['e'] } }, stages: { surface: { colour: 'v' } } }).material;
  expect(Reflect.get(m.defaultAttributeValues, 'aLump')).toEqual([0, 0, 0, 1]);
  expect(Reflect.get(m.defaultAttributeValues, 'aTone')).toEqual([0.5, 1]);
});

test('a lent texture samples the node path\'s black opaque stand-in until its runtime lends one', () => {
  const compiled = compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', params: { field: { type: 'texture', value: 'field', role: 'lent' } },
    nodes: { u: { op: 'uv' }, f: { op: 'texture', param: 'field', in: ['u'] }, c: { op: 'swizzle', in: ['f'], mask: 'www' } }, stages: { surface: { colour: 'c' } } });
  const sampler: unknown = compiled.material.uniforms['wsT_field']?.value;
  expect(sampler instanceof THREE.DataTexture && sampler.image.data !== null ? [...new Uint8Array(sampler.image.data.buffer)] : null).toEqual([0, 0, 0, 255]);
  const lent = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  compiled.setTexture('field', lent);
  expect(compiled.material.uniforms['wsT_field']?.value).toBe(lent);
});

test('a program reading a model-space position decodes the drawn tile primitive\'s grid, uploading only on a change', () => {
  const m = compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', nodes: { p: { op: 'positionGeometry' }, v: { op: 'varying', in: ['p'] } }, stages: { surface: { colour: 'v' } } }).material;
  const grid = new THREE.BufferGeometry(); grid.setAttribute('position', new THREE.BufferAttribute(new Int16Array([0, 0, 0, 4, 0, 0, 0, 4, 0]), 3));
  const tile = new THREE.Mesh(grid, m); tile.scale.setScalar(0.25); tile.position.set(1, 2, 3);
  const plain = new THREE.Mesh(new THREE.BoxGeometry(), m);
  const at = (object: THREE.Mesh): [unknown, unknown, boolean] => { m.uniformsNeedUpdate = false; m.codec?.draw(m, object); return [m.uniforms['wsCodecStep']?.value, m.uniforms['wsCodecOrigin']?.value, m.uniformsNeedUpdate]; };
  expect(at(tile)).toEqual([0.25, new THREE.Vector3(1, 2, 3), true]);
  expect(at(tile)[2]).toBe(false);
  expect(at(plain)).toEqual([1, new THREE.Vector3(0, 0, 0), true]);
  expect(m.clone().codec).not.toBe(m.codec);
});


test('a lit graph takes its drawn scene\'s prefiltered environment, as a node material does', () => {
  const lit = compileClassicGraph({ version: 1, kind: 'material', model: 'standard', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } }).material;
  const unlit = compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } }).material;
  const scene = new THREE.Scene(), environment = new THREE.Texture();
  environment.mapping = THREE.CubeUVReflectionMapping;
  scene.environment = environment; scene.environmentIntensity = 0.4;
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const draw = (m: THREE.ShaderMaterial): void => { m.onBeforeRender(renderer, scene, new THREE.Camera(), new THREE.BufferGeometry(), new THREE.Mesh(), new THREE.Group()); };
  draw(lit); draw(unlit);
  expect(lit.envMap).toBe(environment); expect(lit.uniforms['envMap']?.value).toBe(environment); expect(lit.uniforms['envMapIntensity']?.value).toBe(0.4);
  expect(unlit.envMap).toBe(null);
  // an environment that is not prefiltered is none (the node path's PMREM has no classic twin)
  scene.environment = new THREE.Texture(); draw(lit);
  expect(lit.envMap).toBe(null);
});

test('a lit graph borrows a model\'s normal, roughness and ao maps as its own slots, as the node path does', () => {
  const lit = compileClassicGraph({ version: 1, kind: 'material', model: 'standard', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } }).material;
  expect(lit.userData['graphPbrMaps']).toBe(true);
  expect(compileClassicGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } }).material.userData['graphPbrMaps']).toBeUndefined();
  const copy = lit.clone(), normal = new THREE.Texture(), rough = new THREE.Texture();
  rough.offset.set(0.5, 0);
  Object.assign(copy, { normalMap: normal, roughnessMap: rough, aoMapIntensity: 0.5 }); copy.normalScale.set(2, 2);
  expect(copy.normalMap).toBe(normal); expect(copy.uniforms['normalScale']?.value).toEqual(new THREE.Vector2(2, 2));
  expect(copy.uniforms['roughnessMapTransform']?.value).toEqual(new THREE.Matrix3().setUvTransform(0.5, 0, 1, 1, 0, 0, 0));
  expect(lit.normalMap).toBe(null); expect(lit.aoMapIntensity).toBe(1); expect(lit.normalScale).toEqual(new THREE.Vector2(1, 1));
  expect(lit.fragmentShader).toContain('USE_NORMALMAP_TANGENTSPACE');
});
