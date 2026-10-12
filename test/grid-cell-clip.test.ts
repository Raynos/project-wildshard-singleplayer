// SHARD-PLATFORM G343 / G348: an entered cell's world-sized sheets (a sea to the horizon) stay in its cell in the grid, so
// the road and the neighbours show past it; a dome, an in-cell mesh and a fragment inside the cell are untouched.
import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector4, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { legacyDouble } from './fake/FakeGame';
import { Scope } from '../src/engine/app/scope';
import { CELL_CLIP, cellClip } from '../src/game/grid/cellClip';

const LIT = 'varying vec3 vViewPosition;\nvoid main() { gl_FragColor = vec4(1.0); }';
function compiled(material: ShaderMaterial): WebGLProgramParametersWithUniforms {
  const shader = legacyDouble<WebGLProgramParametersWithUniforms>({ vertexShader: material.vertexShader, fragmentShader: material.fragmentShader, uniforms: { ...material.uniforms } });
  material.onBeforeCompile(shader, legacyDouble<WebGLRenderer>({}));
  return shader;
}
function sheet(size: number, material: ShaderMaterial | MeshStandardMaterial | MeshBasicMaterial): Mesh {
  const mesh = new Mesh(new PlaneGeometry(size, size), material); mesh.rotation.x = -Math.PI / 2; return mesh;
}

it('clips a world-sized sheet to its cell square on the root\'s world position, once, and leaves the rest whole', () => {
  const scope = new Scope('test'), page = new Group(), root = new Group();
  root.position.set(555, 0, -555); page.add(root);
  const sea = new ShaderMaterial({ fragmentShader: LIT }), seaKey = sea.customProgramCacheKey();
  const shore = new ShaderMaterial({ fragmentShader: LIT }), shoreKey = shore.customProgramCacheKey();
  const dome = new ShaderMaterial({ fragmentShader: LIT }), domeKey = dome.customProgramCacheKey();
  root.add(sheet(8000, sea), new Mesh(new BoxGeometry(400, 20, 400), shore), new Mesh(new SphereGeometry(3000), dome));
  // a pier that ends on the road band is not world-sized
  root.add(new Mesh(new BoxGeometry(4, 2, 2 * (250 + CELL_CLIP.reach) - 2), shore));
  const clip = cellClip(root, 250, scope);
  expect(clip.sweep()).toBe(1);
  expect(clip.sweep()).toBe(0); // swept once
  expect(clip.state()).toEqual({ meshes: 1, materials: 1, unclipped: 0 });
  const shader = compiled(sea);
  expect(shader.fragmentShader.match(/discard/g)).toHaveLength(1);
  expect(shader.fragmentShader.indexOf('discard')).toBeLessThan(shader.fragmentShader.indexOf('gl_FragColor'));
  const cell: unknown = shader.uniforms['wsCellClip']?.value;
  if (!(cell instanceof Vector4)) throw new Error('no cell uniform');
  expect(cell.toArray()).toEqual([305, -805, 805, -305]);
  // the origin moves with the page: the square follows the root on the next sweep
  root.position.set(0, 0, 0); clip.sweep();
  expect(cell.toArray()).toEqual([-250, -250, 250, 250]);
  expect(shore.customProgramCacheKey()).toBe(shoreKey);
  expect(dome.customProgramCacheKey()).toBe(domeKey);
  expect(sea.customProgramCacheKey()).not.toBe(seaKey);
  scope.dispose();
  expect(sea.customProgramCacheKey()).toBe(seaKey);
});

it('patches a lit built-in material and counts an unlit world-sized one as unclipped', () => {
  const scope = new Scope('test'), root = new Group();
  const lit = new MeshStandardMaterial(), litKey = lit.customProgramCacheKey();
  root.add(sheet(4000, lit), sheet(4000, new MeshBasicMaterial()));
  const clip = cellClip(root, 250, scope);
  clip.sweep();
  expect(clip.state()).toEqual({ meshes: 1, materials: 1, unclipped: 1 });
  expect(lit.customProgramCacheKey()).not.toBe(litKey);
  scope.dispose();
});
