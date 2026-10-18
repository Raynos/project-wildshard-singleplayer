import { expect, test, vi } from 'vitest';
import { Bone, BoxGeometry, InstancedMesh, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, Skeleton, SkinnedMesh, WebGLRenderer, type Material } from 'three';
import { runPrecompile, sceneJobs, shadowJobs } from '../src/engine/render/precompile';
import type { ProgramLike } from '../src/engine/boot/perflog';
import { loadGraphBackend } from '../src/engine/render/graphBackend';
import { overrideSetting } from '../src/engine/ui/Settings';
import { isDev, setDev } from '../src/engine/core/devMode';

test('preparation retains both shadow-receiver variants of a shared material', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const plain = new Mesh(geometry, material), receiver = new Mesh(geometry, material), duplicate = new Mesh(geometry, material);
  receiver.receiveShadow = true;
  scene.add(plain, receiver, duplicate);
  const { jobs, materials } = sceneJobs(scene, null);
  const copies = jobs.flatMap(job => job.root.children);
  expect(materials).toBe(1);
  expect(copies).toHaveLength(2);
  expect(copies.map(copy => copy.receiveShadow)).toEqual([false, true]);
  expect(scene.children).toEqual([plain, receiver, duplicate]);
  expect(plain.receiveShadow).toBe(false); expect(receiver.receiveShadow).toBe(true);
  geometry.dispose(); material.dispose();
});

test('preparation covers distinct skin array lengths without splitting instance counts', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const first = new SkinnedMesh(geometry, material), second = new SkinnedMesh(geometry, material);
  first.bind(new Skeleton([new Bone(), new Bone()]));
  second.bind(new Skeleton([new Bone(), new Bone(), new Bone()]));
  const small = new InstancedMesh(geometry, material, 3), large = new InstancedMesh(geometry, material, 5);
  scene.add(first, second, small, large);
  const { jobs } = sceneJobs(scene, null);
  const copies = jobs.flatMap(job => job.root.children);
  expect(copies).toHaveLength(3);
  expect(copies.filter((copy): copy is SkinnedMesh => copy instanceof SkinnedMesh).map(copy => copy.skeleton.bones.length)).toEqual([2, 3]);
  expect(copies.filter(copy => copy instanceof InstancedMesh)).toHaveLength(1);
  first.skeleton.dispose(); second.skeleton.dispose(); small.dispose(); large.dispose();
  geometry.dispose(); material.dispose();
});

test('paced entry borrows instance layout without copying population buffers', () => {
  const developer = isDev(); setDev(true);
  overrideSetting('buildPacing', 'entry');
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const original = new InstancedMesh(geometry, material, 10000);
  original.setColorAt(0, material.color); scene.add(original);
  const clone = vi.spyOn(original, 'clone');
  try {
    const { jobs } = sceneJobs(scene, null);
    const copy = jobs[0]?.root.children[0];
    if (!(copy instanceof InstancedMesh)) throw new Error('Missing instanced compile stand-in');
    expect(clone).not.toHaveBeenCalled();
    expect(copy.instanceMatrix).toBe(original.instanceMatrix);
    expect(copy.instanceColor).toBe(original.instanceColor);
    expect(copy.count).toBe(original.count);
    expect(original.parent).toBe(scene);
    expect(copy.parent).not.toBe(scene);
    copy.dispose();
  } finally { overrideSetting('buildPacing', null); setDev(developer); clone.mockRestore(); original.dispose(); geometry.dispose(); material.dispose(); }
});

test('paced entry retains a specialized instanced constructor', () => {
  class PresentationInstances extends InstancedMesh { readonly presentation = true; }
  const developer = isDev(); setDev(true); overrideSetting('buildPacing', 'entry');
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const original = new PresentationInstances(geometry, material, 2); scene.add(original);
  try {
    const copy = sceneJobs(scene, null).jobs[0]?.root.children[0];
    if (!(copy instanceof PresentationInstances)) throw new Error('Specialized compile stand-in lost its constructor');
    expect(copy.presentation).toBe(true);
    expect(copy.instanceMatrix).not.toBe(original.instanceMatrix);
    copy.dispose();
  } finally { overrideSetting('buildPacing', null); setDev(developer); original.dispose(); geometry.dispose(); material.dispose(); }
});

test('shadow preparation compiles the depth variant a registered shadow draw substitutes (sp-o289)', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), moving = new MeshStandardMaterial(), still = new MeshStandardMaterial();
  const a = new Mesh(geometry, moving), b = new Mesh(geometry, moving), c = new Mesh(geometry, still);
  for (const mesh of [a, b, c]) mesh.castShadow = true;
  scene.add(a, b, c);
  const variant = new MeshBasicMaterial(), stocks: MeshDepthMaterial[] = [];
  const resolve = (source: Material, stock: MeshDepthMaterial): Material | null => {
    if (source !== moving) return null;
    stocks.push(stock); variant.side = stock.side; return variant;
  };
  const jobs = shadowJobs(scene, null, 6, undefined, resolve);
  const prepared = jobs.filter(job => job.prepare !== undefined);
  expect(prepared).toHaveLength(1);
  const copy = prepared[0]?.root.children[0];
  if (!(copy instanceof Mesh)) throw new Error('graph depth job has no caster');
  variant.side = 0; prepared[0]?.prepare?.();
  expect(copy.material).toBe(variant);
  expect(variant.side).toBe(stocks.at(-1)?.side);
  // the still material keeps a stock depth caster
  expect(jobs.flatMap(job => job.root.children).some(child => child instanceof Mesh && child.material instanceof MeshDepthMaterial)).toBe(true);
  for (const job of jobs) job.dispose?.();
  geometry.dispose(); moving.dispose(); still.dispose(); variant.dispose();
});

test('every acquired node layout prepares blocks across paced frames', async () => {
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Missing renderer');
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  Reflect.set(material, 'isNodeMaterial', true);
  const scene = new Scene(), plain = new Mesh(geometry, material), receiver = new Mesh(geometry, material);
  receiver.receiveShadow = true; scene.add(plain, receiver);
  const programs = new Map<string, ProgramLike>(), properties: { programs: typeof programs; currentProgram?: ProgramLike } = { programs };
  let frame = 0;
  const resolved: string[] = [], blocks: { material: Material; program: ProgramLike; frame: number }[] = [];
  const make = (name: string): ProgramLike => ({ name, type: 'node', cacheKey: name, id: programs.size, usedTimes: 1,
    program: {}, isReady: () => true, getUniforms: () => { resolved.push(name); } });
  const first = make('plain'), last = make('receiver');
  const fields: Record<string, unknown> = {
    info: { programs: [first, last], render: { frame: 0 } }, extensions: { has: () => true },
    properties: { get: () => properties, has: () => true }, getRenderTarget: () => null, setRenderTarget: () => undefined,
    getContext: () => ({}), setNodesHandler: (handler: { setRenderer: (value: WebGLRenderer) => void }) => { handler.setRenderer(renderer); },
    compile: () => { programs.set('plain', first); programs.set('receiver', last); properties.currentProgram = last; },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = await loadGraphBackend(renderer);
  const prepareProgram = vi.spyOn(handler, 'prepareProgram').mockImplementation((value: Material, program) => {
    const acquired = [first, last].find(candidate => candidate === program);
    if (acquired === undefined) throw new Error('Unknown program');
    blocks.push({ material: value, program: acquired, frame });
  });
  const warm = async (): Promise<void> => {
    const jobs = sceneJobs(scene, null).jobs;
    await runPrecompile(renderer, new PerspectiveCamera(), jobs, 1, undefined, [], () => true, true, () => { frame++; return Promise.resolve(); });
  };
  await warm();
  expect(resolved).toEqual(['plain', 'receiver']);
  expect(blocks.map(row => row.program)).toEqual([first, last]);
  expect(new Set(blocks.map(row => row.frame)).size).toBe(2);
  expect(properties.currentProgram).toBe(last);
  await warm();
  expect(blocks).toHaveLength(2); expect(resolved).toHaveLength(2);
  // Another material can acquire an already-resolved program. Its groups still
  // need preparation without resolving the program or selecting another variant.
  const shared = material.clone(); Reflect.set(shared, 'isNodeMaterial', true);
  plain.material = shared; receiver.material = shared;
  await warm();
  expect(blocks.slice(2).map(row => row.material)).toEqual([shared, shared]);
  expect(blocks.slice(2).map(row => row.program)).toEqual([first, last]);
  expect(new Set(blocks.slice(2).map(row => row.frame)).size).toBe(2);
  expect(resolved).toHaveLength(2); expect(properties.currentProgram).toBe(last);
  prepareProgram.mockRestore(); geometry.dispose(); material.dispose(); shared.dispose();
});

test.each([['links', false, true], ['links', true, true], ['links', true, false], ['on', false, true]] as const)(
  '%s isolates issue and first-use discovery (parallel %s, immediately ready %s)', async (pacing, parallel, immediate) => {
    const developer = isDev(); setDev(true); overrideSetting('buildPacing', pacing);
    const renderer: unknown = Object.create(WebGLRenderer.prototype);
    if (!(renderer instanceof WebGLRenderer)) throw new Error('Missing renderer');
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), scene = new Scene();
    scene.add(new Mesh(geometry, material));
    let frame = 0;
    const events: { operation: string; frame: number }[] = [], acquired: ProgramLike[] = [], programs = new Map<string, ProgramLike>();
    const program: ProgramLike = { name: 'fixture', type: 'basic', cacheKey: 'fixture', id: 1, usedTimes: 1, program: {},
      isReady: () => immediate || frame > 0, getUniforms: () => { events.push({ operation: 'resolve', frame }); } };
    const diagnostics = { checkShaderErrors: true };
    const fields: Record<string, unknown> = {
      info: { programs: acquired, render: { frame: 0 } }, extensions: { has: () => parallel }, debug: diagnostics,
      properties: { get: () => ({ programs }), has: () => true }, getRenderTarget: () => null, setRenderTarget: () => undefined,
      compile: () => { events.push({ operation: 'issue', frame }); acquired.push(program); programs.set('fixture', program); },
    };
    for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
    try {
      await runPrecompile(renderer, new PerspectiveCamera(), sceneJobs(scene, null).jobs, 1, undefined, [], () => true, true,
        () => { frame++; return Promise.resolve(); });
      expect(events.map(event => event.operation)).toEqual(['issue', 'resolve']);
      expect(events[0]?.frame).toBe(0);
      if (pacing === 'links') expect(events[1]?.frame).toBeGreaterThan(0);
      else expect(events[1]?.frame).toBe(0); // Existing pacing retains its same-frame behavior.
      expect(diagnostics.checkShaderErrors).toBe(true);
    } finally { geometry.dispose(); material.dispose(); overrideSetting('buildPacing', null); setDev(developer); }
  });
