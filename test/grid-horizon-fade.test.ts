// SHARD-PLATFORM G321 part 4 (op-sky43): inside a cell whose shard draws its own sky, the road's far reaches and the
// neighbours' far proxies dither out by how much the cells' own skies own the frame, beyond the near road.
import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, ShaderMaterial, Vector4, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { legacyDouble } from './fake/FakeGame';
import { Scope } from '../src/engine/app/scope';
import { HORIZON_FADE, horizonFade } from '../src/game/grid/horizonFade';

/** run a material's chained `onBeforeCompile` on a stand-in program source (what three hands it) */
function compiled(material: ShaderMaterial): WebGLProgramParametersWithUniforms {
  const shader = legacyDouble<WebGLProgramParametersWithUniforms>({ vertexShader: material.vertexShader, fragmentShader: material.fragmentShader, uniforms: { ...material.uniforms } });
  material.onBeforeCompile(shader, legacyDouble<WebGLRenderer>({}));
  return shader;
}

it('puts one discard at the top of each fragment shader, keyed once, fed by the frame\'s horizon share', () => {
  const scope = new Scope('test'), fade = horizonFade(scope);
  const material = new ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4(0.0); }', fragmentShader: 'uniform vec3 c;\nvoid main()\n{\n  gl_FragColor = vec4(c, 1.0);\n}' });
  const before = material.customProgramCacheKey();
  const root = new Group(), mesh = new Mesh(new BoxGeometry(), material), twin = new Mesh(new BoxGeometry(), material);
  root.add(mesh, twin);
  fade.patch(root); fade.patch(material); // once per material, however often it is reached
  const shader = compiled(material);
  expect(shader.fragmentShader.match(/discard/g)?.length).toBe(1);
  expect(shader.fragmentShader).toContain('uniform float wsHorizonOwned;');
  expect(shader.fragmentShader).toContain(`smoothstep(${HORIZON_FADE.near.toFixed(1)}, ${HORIZON_FADE.far.toFixed(1)}, 1.0 / gl_FragCoord.w)`);
  expect(shader.fragmentShader.indexOf('discard')).toBeLessThan(shader.fragmentShader.indexOf('gl_FragColor'));
  expect(material.customProgramCacheKey()).not.toBe(before);
  const uniform = shader.uniforms['wsHorizonOwned'];
  fade.set(0.4, null); expect(uniform?.value).toBe(0.4);
  fade.set(3, null); expect(uniform?.value).toBe(1); expect(fade.owned()).toBe(1);
  fade.set(-1, null); expect(uniform?.value).toBe(0);
  // no lit position in this program: an 'owned' material fades by distance alone
  expect(shader.fragmentShader).not.toContain('wsHorizonAt');
  // a shared material ('outside') without a lit position is left whole; a lit one fades only outside the owning cell
  const shared = new ShaderMaterial({ vertexShader: material.vertexShader, fragmentShader: material.fragmentShader });
  fade.patch(shared, 'outside');
  expect(compiled(shared).fragmentShader).not.toContain('discard');
  const lit = new ShaderMaterial({ vertexShader: material.vertexShader, fragmentShader: 'varying vec3 vViewPosition;\nvoid main() { gl_FragColor = vec4(1.0); }' });
  fade.patch(lit, 'outside');
  const litShader = compiled(lit).fragmentShader;
  expect(litShader).toContain('wsHorizonAt');
  expect(litShader.indexOf('wsHorizonCell.x - wsHorizonAt.x')).toBeLessThan(litShader.indexOf('discard'));
  const cell: unknown = compiled(lit).uniforms['wsHorizonCell']?.value;
  if (!(cell instanceof Vector4)) throw new Error('no owning cell uniform');
  fade.set(1, { x: 555, z: 0, half: 256 });
  expect(cell.toArray()).toEqual([299, -256, 811, 256]);
  fade.set(0, null);
  expect(cell.x).toBeGreaterThan(cell.z); // empty: everything is outside
  // a built-in material too, and every patch comes off with the scope
  const lambert = new MeshLambertMaterial(), lambertKey = lambert.customProgramCacheKey();
  fade.patch(lambert);
  expect(lambert.customProgramCacheKey()).not.toBe(lambertKey);
  scope.dispose();
  expect(material.customProgramCacheKey()).toBe(before);
  expect(lambert.customProgramCacheKey()).toBe(lambertKey);
});
