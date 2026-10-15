/** One material alternates all four shadow/instance layouts without reselecting
 * warm programs. Real lit/shadowed pixels and instance transforms remain live. */
import { BoxGeometry, DirectionalLight, DoubleSide, InstancedMesh, LinearSRGBColorSpace, Matrix4, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderTarget, type WebGLRenderer } from 'three';
import type { Scope } from '../../src/engine/app/scope';
import { loadGraphBackend } from '../../src/engine/render/graphBackend';
import { compileGraph } from '../../src/engine/render/graph/compile';

export async function programVariants(renderer: WebGLRenderer, scope: Scope): Promise<object> {
  renderer.setSize(256, 64, false); renderer.shadowMap.enabled = true;
  const handler = await loadGraphBackend(renderer), scene = new Scene(), camera = new OrthographicCamera(-2, 2, 0.5, -0.5, 0.1, 30);
  camera.position.z = 12;
  const material = scope.own(compileGraph({ version: 1, kind: 'material', model: 'standard', nodes: {},
    stages: { surface: { colour: [1, 1, 1], roughness: 1 } }, effectState: { fog: false } }).material);
  const geometry = scope.own(new PlaneGeometry(0.7, 0.7)), box = scope.own(new BoxGeometry(0.9, 0.9, 0.5));
  const casterMaterial = scope.own(new MeshBasicMaterial());
  const receivers = [0, 1, 2, 3].map(i => {
    const mesh = i < 2 ? new Mesh(geometry, material) : new InstancedMesh(geometry, material, 1);
    mesh.position.x = i - 1.5; mesh.receiveShadow = i % 2 === 1; mesh.renderOrder = i; mesh.frustumCulled = false;
    if (mesh instanceof InstancedMesh) mesh.setMatrixAt(0, new Matrix4());
    scene.add(mesh);
    const caster = new Mesh(box, casterMaterial); caster.position.set(mesh.position.x + 4, 0, 4); caster.castShadow = true; scene.add(caster);
    return mesh;
  });
  const light = new DirectionalLight(0xffffff, 4); light.position.set(10, 0, 10); light.castShadow = true;
  Object.assign(light.shadow.camera, { left: -12, right: 12, top: 4, bottom: -4, far: 40 });
  light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.0001; scene.add(light, light.target);
  const gl = renderer.getContext();
  let selections = 0; const update = handler.onUpdateProgram.bind(handler);
  handler.onUpdateProgram = (...args) => { selections++; update(...args); };
  const pixels = (): number[][] => [32, 96, 160, 224].map(x => {
    const words = new Uint8Array(4); gl.readPixels(x, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, words); return Array.from(words);
  });
  const draw = (): number[][] => { renderer.render(scene, camera); return pixels(); };
  try {
    draw(); const initial = draw(), version = material.version, builds = handler.builds, programs = renderer.info.programs?.length;
    selections = 0;
    for (let i = 0; i < 8; i++) {
      for (const [j, mesh] of receivers.entries()) mesh.renderOrder = i % 2 === 0 ? 3 - j : j;
      const actual = draw(); if (JSON.stringify(actual) !== JSON.stringify(initial)) throw new Error('Warm variant changed rendered pixels');
    }
    const warmSelections = selections;
    if (warmSelections !== 0 || material.version !== version || handler.builds !== builds || renderer.info.programs?.length !== programs) throw new Error(JSON.stringify({ warmSelections, version, currentVersion: material.version, builds, currentBuilds: handler.builds }));
    if (!initial.every((pixel, i) => pixel[3] === 255 && (i % 2 === 0 ? (pixel[0] ?? 0) > 100 : (pixel[0] ?? 255) < 30))) throw new Error(JSON.stringify({ initial }));
    for (const mesh of receivers) mesh.receiveShadow = !mesh.receiveShadow;
    const flipped = draw();
    if (!flipped.every((pixel, i) => pixel[3] === 255 && (i % 2 === 1 ? (pixel[0] ?? 0) > 100 : (pixel[0] ?? 255) < 30)) || selections !== 0) throw new Error(JSON.stringify({ flipped, selections }));
    const target = scope.own(new WebGLRenderTarget(256, 64)); target.texture.colorSpace = LinearSRGBColorSpace;
    renderer.setRenderTarget(target); draw(); renderer.setRenderTarget(null); draw();
    material.side = DoubleSide; material.needsUpdate = true; selections = 0; draw();
    const invalidatedSelections = selections; selections = 0; const edited = draw();
    if (invalidatedSelections === 0 || selections !== 0 || JSON.stringify(edited) !== JSON.stringify(flipped) || gl.getError() !== gl.NO_ERROR) throw new Error(JSON.stringify({ invalidatedSelections, selections, edited, flipped }));
    return { initial, flipped, warmSelections, invalidatedSelections, programs, builds, glErrors: 0 };
  } finally { handler.onUpdateProgram = update; renderer.setRenderTarget(null); renderer.shadowMap.enabled = false; light.shadow.dispose(); }
}
