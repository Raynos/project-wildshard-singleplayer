/** Real GL transport oracle: one material, many distinct object matrices,
 * camera changes and an interleaved classic draw. No game frame-floor gate. */
import { LinearSRGBColorSpace, Mesh, MeshBasicMaterial, NoToneMapping, OrthographicCamera, PlaneGeometry, Scene, type WebGLRenderer } from 'three';
import type { Scope } from '../../src/engine/app/scope';
import { compileGraph } from '../../src/engine/render/graph/compile';

export function uniformTransport(renderer: WebGLRenderer, scope: Scope, requireOptimised = true): object {
  renderer.setSize(300, 200, false); renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace;
  const scene = new Scene(), camera = new OrthographicCamera(-15, 15, 10, -10, 0.1, 30); camera.position.z = 10;
  const graph = scope.own(compileGraph({version: 1, kind: 'material', model: 'unlit', nodes: {},
    stages: {surface: {colour: [1, 0, 0]}}, effectState: {fog: false}}).material);
  const classic = scope.own(new MeshBasicMaterial({color: 0xff0000, toneMapped: false})), geometry = scope.own(new PlaneGeometry(0.6, 0.6));
  const meshes = Array.from({length: 600}, (_, i) => {
    const mesh = new Mesh(geometry, graph); mesh.position.set(i % 30 - 14.5, Math.floor(i / 30) - 9.5, 0); mesh.frustumCulled = false;
    scene.add(mesh); return mesh;
  });
  const gl = renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext)) throw new Error('Uniform blocks require WebGL2');
  const read = (): Uint8Array => { const bytes = new Uint8Array(300 * 200 * 4); gl.readPixels(0, 0, 300, 200, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return bytes; };
  const cases: number[] = [];
  for (let pose = 0; pose < 3; pose++) {
    camera.position.x = pose * 0.13; camera.updateMatrixWorld();
    for (const [i, mesh] of meshes.entries()) { mesh.rotation.z = pose * (i % 5) * 0.1; mesh.scale.set(1 + pose * (i % 3) * 0.1, 1 - pose * (i % 4) * 0.05, 1); mesh.material = graph; }
    renderer.render(scene, camera); const actual = read();
    for (const mesh of meshes) mesh.material = classic;
    renderer.render(scene, camera); const expected = read();
    const different = actual.reduce((sum, value, i) => sum + Number(value !== expected[i]), 0); cases.push(different);
    if (different !== 0) throw new Error(`Classic matrix transport changed ${different} channels at pose ${pose}`);
  }
  for (const mesh of meshes) mesh.material = graph;
  renderer.render(scene, camera);
  let binds = 0, uploads = 0, matrices = 0;
  const bind = gl.bindBufferBase.bind(gl), upload = gl.bufferSubData.bind(gl), matrix = gl.uniformMatrix4fv.bind(gl);
  gl.bindBufferBase = (...args) => { binds++; bind(...args); };
  gl.bufferSubData = (...args: Parameters<typeof gl.bufferSubData>) => { uploads++; upload(...args); };
  gl.uniformMatrix4fv = (...args) => { matrices++; matrix(...args); };
  try { renderer.render(scene, camera); } finally { gl.bindBufferBase = bind; gl.bufferSubData = upload; gl.uniformMatrix4fv = matrix; }
  if ((requireOptimised && (binds > 4 || uploads !== 0 || matrices < 600 || matrices > 605)) || gl.getError() !== gl.NO_ERROR) throw new Error(JSON.stringify({binds, uploads, matrices}));
  const timings: number[] = [];
  for (let round = 0; round < 3; round++) {
    const start = performance.now(); for (let frame = 0; frame < 30; frame++) renderer.render(scene, camera);
    timings.push((performance.now() - start) * 1000 / (30 * 600));
  }
  return {draws: 600, cases, binds, uploads, matrices, cpuMicrosPerDraw: timings, glErrors: 0};
}
