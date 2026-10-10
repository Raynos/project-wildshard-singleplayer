// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { prepareOffscreenBuild } from '../src/engine/render/offscreenBuild';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

const isTexture = (value: unknown): value is THREE.Texture => value instanceof THREE.Texture;
const isMesh = (value: THREE.Object3D): value is THREE.Mesh => value instanceof THREE.Mesh;

function recorder() {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Renderer prototype');
  let target: THREE.WebGLRenderTarget | null = null;
  const draws: unknown[] = [], compiled: unknown[] = [], compiledTones: number[] = [], ids = new Map<THREE.Texture, number>();
  const value = (input: unknown): unknown => {
    if (isTexture(input)) {
      if (!ids.has(input)) ids.set(input, ids.size);
      return { texture: ids.get(input), type: input.type, format: input.format, mapping: input.mapping };
    }
    if (input instanceof THREE.Vector3 || input instanceof THREE.Color) return input.toArray();
    return input;
  };
  const describe = (root: THREE.Object3D): unknown[] => {
    const rows: unknown[] = [];
    root.traverse(object => { if (isMesh(object)) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) rows.push(material instanceof THREE.ShaderMaterial
        ? { vertex: material.vertexShader, fragment: material.fragmentShader, defines: material.defines,
          uniforms: Object.fromEntries(Object.entries(material.uniforms).map(([key, uniform]) => [key, value(uniform.value)])) }
        : { type: material.type, colour: material instanceof THREE.MeshBasicMaterial ? material.color.toArray() : null });
    } });
    return rows;
  };
  const methods = { extensions: { has: () => false }, info: { programs: [] }, xr: { enabled: true }, autoClear: true, toneMapping: THREE.ACESFilmicToneMapping,
    state: { buffers: { depth: { getReversed: () => false } } }, getClearColor: (color: THREE.Color) => color.set(0x123456),
    getRenderTarget: () => target, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { target = next; }, initTexture: () => undefined,
    compile: (root: THREE.Object3D) => { compiled.push(root); compiledTones.push(renderer.toneMapping); },
    render: (root: THREE.Object3D, camera: THREE.Camera) => {
      draws.push({ viewport: target?.viewport.toArray(), scissor: target?.scissor.toArray(), scissorTest: target?.scissorTest,
        autoClear: renderer.autoClear, toneMapping: renderer.toneMapping, xr: renderer.xr.enabled,
        position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), objects: describe(root) });
    },
  };
  for (const [key, member] of Object.entries(methods)) Reflect.set(renderer, key, member);
  return { renderer, draws, compiled, compiledTones };
}

it('replays Three PMREM HDR passes with exact uniforms, samplers, cameras, viewport and state, yielding between draws', async () => {
  const prior = scopeEnvironment();
  let paints = 0;
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { paints++; render(0); }); return 1; }, cancelFrame: () => undefined });
  const texture = new THREE.DataTexture(new Uint16Array(128 * 64 * 4), 128, 64, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const before = recorder(), after = recorder(), generator = new THREE.PMREMGenerator(before.renderer);
  let scheduled: THREE.PMREMGenerator | null = null;
  const baseline = generator.fromEquirectangular(texture);
  try {
    const output = await prepareOffscreenBuild(after.renderer, renderer => { scheduled = new THREE.PMREMGenerator(renderer); return scheduled.fromEquirectangular(texture); }, () => true);
    expect(after.draws).toEqual(before.draws); expect(paints).toBeGreaterThanOrEqual(after.draws.length);
    expect(after.compiled).toHaveLength(after.draws.length); expect(after.renderer.getRenderTarget()).toBeNull();
    expect(after.renderer.autoClear).toBe(true); expect(after.renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping); expect(after.renderer.xr.enabled).toBe(true);
    // A retained generator must become an ordinary renderer client again, rather than retain or append old commands.
    const retained: unknown = scheduled;
    if (!(retained instanceof THREE.PMREMGenerator)) throw new Error('No scheduled generator');
    const count = after.draws.length, next = retained.fromEquirectangular(texture);
    expect(after.draws.length - count).toBe(before.draws.length);
    next.dispose(); output.dispose(); retained.dispose();
  } finally { baseline.dispose(); generator.dispose(); texture.dispose(); installScopeEnvironment(prior); }
});

it('captures the six actual scene-camera faces and restores source uniforms by identity', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  const scene = new THREE.Scene(), direction = new THREE.Vector3(1, 2, 3);
  const material = new THREE.ShaderMaterial({ uniforms: { direction: { value: direction } } }), geometry = new THREE.BoxGeometry();
  scene.background = new THREE.Color(0.2, 0.3, 0.4);
  scene.add(new THREE.Mesh(geometry, material));
  const before = recorder(), after = recorder(), generator = new THREE.PMREMGenerator(before.renderer);
  let scheduled: THREE.PMREMGenerator | null = null;
  const baseline = generator.fromScene(scene, 0, 1, 3000, { size: 32 });
  try {
    const output = await prepareOffscreenBuild(after.renderer, renderer => { scheduled = new THREE.PMREMGenerator(renderer); return scheduled.fromScene(scene, 0, 1, 3000, { size: 32 }); }, () => true);
    expect(after.draws).toEqual(before.draws); expect(after.compiledTones).toEqual(before.draws.map(draw => { if (draw === null || typeof draw !== 'object') throw new Error('Missing native draw'); const tone: unknown = Reflect.get(draw, 'toneMapping'); return tone; })); expect(material.uniforms['direction']?.value).toBe(direction); expect(material.uniformsNeedUpdate).toBe(false);
    const retained: unknown = scheduled;
    if (!(retained instanceof THREE.PMREMGenerator)) throw new Error('No scheduled generator');
    output.dispose(); retained.dispose();
  } finally { baseline.dispose(); generator.dispose(); material.dispose(); geometry.dispose(); installScopeEnvironment(prior); }
});

it('refuses canvas work and aborts an owner that leaves during shader preparation before any deferred draw', async () => {
  const before = recorder(), root = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()), camera = new THREE.PerspectiveCamera();
  await expect(prepareOffscreenBuild(before.renderer, renderer => { renderer.render(root, camera); return new THREE.WebGLRenderTarget(); }, () => true)).rejects.toThrow('offscreen target');
  expect(before.draws).toHaveLength(0);
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  let current = true, retired = false;
  const output = new THREE.WebGLRenderTarget(); output.addEventListener('dispose', () => { retired = true; });
  Reflect.set(before.renderer, 'compile', () => { current = false; });
  try {
    await expect(prepareOffscreenBuild(before.renderer, renderer => { renderer.setRenderTarget(output); renderer.render(root, camera); return output; }, () => current)).rejects.toThrow('owner left');
    expect(before.draws).toHaveLength(0); expect(retired).toBe(true); expect(before.renderer.getRenderTarget()).toBeNull();
  } finally { root.geometry.dispose(); root.material.dispose(); installScopeEnvironment(prior); }
});


it('keeps Chromium factories on their original synchronous renderer path', async () => {
  vi.stubGlobal('navigator', { userAgent: 'AppleWebKit/537.36 Chrome/130.0' });
  const record = recorder(), output = new THREE.WebGLRenderTarget();
  try {
    let factoryRenderer: THREE.WebGLRenderer | null = null;
    const result = await prepareOffscreenBuild(record.renderer, renderer => { factoryRenderer = renderer; return output; }, () => true, { webKitOnly: true });
    expect(factoryRenderer).toBe(record.renderer); expect(result).toBe(output); expect(record.compiled).toHaveLength(0);
  } finally { output.dispose(); vi.unstubAllGlobals(); }
});
