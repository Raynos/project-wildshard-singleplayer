import { expect, test } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { ProgramLike } from '../boot/perflog';
import { linkedGl } from '../../test/linkedGl';
import { runPrecompile, type CompileJob } from './precompile';

// DL21: under the loader the resolve loop waits on one program while the GPU process links the rest. The card counts those.
test('a resolve held on one program counts the links landing behind it', async () => {
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Renderer missing');
  const geometry = new BoxGeometry(), materials = Array.from({ length: 4 }, () => new MeshBasicMaterial());
  const jobs: CompileJob[] = materials.map((material, i) => {
    const root = new Scene(); root.add(new Mesh(geometry, material));
    return { label: `material-${i}`, root, target: null, rt: null };
  });
  const programs: ProgramLike[] = [], byMaterial = new WeakMap<MeshBasicMaterial, ProgramLike[]>(), details: string[] = [];
  let frame = 0;
  const fields: Record<string, unknown> = {
    info: { programs, render: { frame: 0 } }, extensions: { has: (name: string) => name === 'KHR_parallel_shader_compile' },
    properties: { has: () => true, get: (material: MeshBasicMaterial) => ({ programs: new Map(byMaterial.get(material)?.map(program => [`linked-${program.id}`, program])) }) },
    getContext: linkedGl, getRenderTarget: () => null, setRenderTarget: () => undefined,
    compile: (root: Scene): void => {
      root.traverse(object => {
        if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) return;
        const id = programs.length, issuedAt = frame;
        const program: ProgramLike = { type: 'test', name: `program-${id}`, cacheKey: `program-${id}`, usedTimes: 1, id, program: {},
          isReady: () => frame - issuedAt >= (id === 0 ? 12 : 4 + id), getUniforms: () => ({}) };
        programs.push(program); byMaterial.set(object.material, [program]);
      });
    },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  await runPrecompile(renderer, new PerspectiveCamera(), jobs, materials.length, (_done, _total, detail) => { details.push(detail); }, [], () => true,
    true, () => { frame++; return Promise.resolve(); }, undefined, undefined, 6);
  const counts = details.flatMap(detail => /^0 \/ 4 programs resolved · (\d+) linked/u.exec(detail)?.[1] ?? []);
  expect(counts).toEqual(['1', '2', '3']);
  expect(details.at(-1)).toContain('4 / 4 programs resolved');
});
