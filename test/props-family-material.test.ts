import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import { staticGlb } from '../src/sdk/bake/glb';
import { contentHash } from '../src/sdk/project';
import { installDeclaredProps, type DeclaredProps } from '../src/engine/world/declaredProps';
import { familyCompileJobs, familyMaterial, familyVariant, liveFamilyMaterials, type FamilyContext } from '../src/engine/render/families/registry';
import { TOON_PROGRAM_KEY, ToonLook } from '../src/engine/render/families/toon';
import { PAINTERLY_PROGRAM_KEY, PainterlyLook } from '../src/engine/render/families/painterly';
import { patchIds } from '../src/engine/render/shaderPatches';

/** run a material's onBeforeCompile on three's source for its type, as WebGLPrograms would */
function compiled(m: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const lib = m instanceof THREE.MeshLambertMaterial ? THREE.ShaderLib.lambert : THREE.ShaderLib.physical;
  const shader = legacyDouble<THREE.WebGLProgramParametersWithUniforms>({ uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
  m.onBeforeCompile(shader, legacyDouble<THREE.WebGLRenderer>({}));
  return shader;
}

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

/** one baked props tile: two vertex-coloured boxes sharing a surface, and a third in another colour */
function propsTile(): { props: DeclaredProps; assets: Map<string, Uint8Array> } {
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.setAttribute('color', new THREE.BufferAttribute(new Float32Array(box.getAttribute('position').count * 3).fill(0.5), 3));
  const red = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.6, metalness: 0 }), blue = new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.6, metalness: 0 });
  cleanups.push(() => { box.dispose(); red.dispose(); blue.dispose(); });
  const bytes = staticGlb([
    { geometry: box, material: red, instances: [new THREE.Matrix4()] },
    { geometry: box, material: red, instances: [new THREE.Matrix4().makeTranslation(2, 0, 0)] },
    { geometry: box, material: blue, instances: [new THREE.Matrix4().makeTranslation(4, 0, 0)] },
  ]);
  const file = contentHash(bytes);
  return { props: { family: 'f', tiles: [{ lod: 0, x: 0, z: 0, file }], panels: [], models: [], far: null, textures: [] }, assets: new Map([[file, bytes]]) };
}

const isMaterial = (m: unknown): m is THREE.Material => m instanceof THREE.Material;
function meshMaterials(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((o) => { if (!(o instanceof THREE.Mesh)) return; const list: unknown[] = Array.isArray(o.material) ? o.material : [o.material]; out.push(...list.filter(isMaterial)); });
  return out;
}

describe('declared props keep their material family\'s program (SF9b / SF10a)', () => {
  const context = (scope: Scope): FamilyContext => ({ toon: new ToonLook(), painterly: new PainterlyLook(), textures: () => { throw new Error('no textures'); }, scope });

  for (const [entry, key, type] of [
    [{ family: 'toon' }, TOON_PROGRAM_KEY, 'MeshStandardMaterial'],
    [{ family: 'painterly' }, `${PAINTERLY_PROGRAM_KEY}|g`, 'MeshLambertMaterial'],
  ] as const) {
    it(`a ${entry.family} prop compiles the program of a directly built ${entry.family} material and shares its look`, async () => {
      const scope = new Scope(`props.${entry.family}`), level = new Scope('props.level'); cleanups.push(() => { level.dispose(); scope.dispose(); });
      const direct = familyMaterial(entry, context(scope)), { props, assets } = propsTile(), scene = new THREE.Group();
      const installed = await installDeclaredProps(props, { scene, scope: level, assets, materials: new Map([['f', direct]]) });
      const tile = installed.tiles.get('0/0/0'); if (tile === undefined) throw new Error('no tile');
      const mats = meshMaterials(tile);
      expect(mats).toHaveLength(3);
      // two meshes with one surface share one variant; the blue box its own
      expect(new Set(mats).size).toBe(2);
      const want = compiled(direct);
      for (const m of mats) {
        expect(m).not.toBe(direct);
        expect(m.type).toBe(type);
        expect(m.customProgramCacheKey()).toBe(key);
        expect(m.customProgramCacheKey()).toBe(direct.customProgramCacheKey());
        expect(patchIds(m)).toEqual(patchIds(direct));
        const got = compiled(m);
        expect(got.fragmentShader).toBe(want.fragmentShader);
        expect(got.vertexShader).toBe(want.vertexShader);
        // the look's uniforms are the same objects: a day clock moving the family moves its props
        for (const name of Object.keys(want.uniforms).filter((n) => n.startsWith('fam'))) expect(got.uniforms[name]).toBe(want.uniforms[name]);
        expect(m.userData['familyUniforms']).toBe(direct.userData['familyUniforms']);
        expect(Object.getOwnPropertyDescriptor(m, 'onBeforeRender')?.value).toBe(Object.getOwnPropertyDescriptor(direct, 'onBeforeRender')?.value);
        // tracked for the loading screen's shader step
        expect(liveFamilyMaterials().get(m)).toBe(liveFamilyMaterials().get(direct));
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshLambertMaterial) expect(m.vertexColors).toBe(true);
      }
      const colours = mats.map((m) => (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshLambertMaterial ? m.color.getHexString() : ''));
      expect(new Set(colours)).toEqual(new Set(['ff0000', '0000ff']));
      level.dispose();
      for (const m of mats) expect(liveFamilyMaterials().has(m)).toBe(false);
      expect(liveFamilyMaterials().has(direct)).toBe(true);
    });
  }

  it('shares variants across tiles and disposes one only when its last holder lets go', async () => {
    const scope = new Scope('props.share'), a = new Scope('props.a'), b = new Scope('props.b'); cleanups.push(() => { a.dispose(); b.dispose(); scope.dispose(); });
    const direct = familyMaterial({ family: 'toon' }, context(scope)), { props, assets } = propsTile();
    const first = await installDeclaredProps(props, { scene: new THREE.Group(), scope: a, assets, materials: new Map([['f', direct]]) });
    const second = await installDeclaredProps(props, { scene: new THREE.Group(), scope: b, assets, materials: new Map([['f', direct]]) });
    const ta = first.tiles.get('0/0/0'), tb = second.tiles.get('0/0/0'); if (ta === undefined || tb === undefined) throw new Error('no tile');
    const ma = meshMaterials(ta), mb = meshMaterials(tb);
    expect(new Set([...ma, ...mb]).size).toBe(2);
    let disposed = 0; for (const m of new Set(ma)) m.addEventListener('dispose', () => { disposed++; });
    a.dispose(); expect(disposed).toBe(0);
    second.disposeTile('0/0/0'); expect(disposed).toBe(2);
  });

  it('familyVariant keeps a ground layer\'s uniforms shared and a plain material plain', () => {
    const scope = new Scope('props.variant'); cleanups.push(() => { scope.dispose(); });
    const plain = new THREE.MeshStandardMaterial(), v = familyVariant(plain, scope, (m) => { m.side = THREE.DoubleSide; });
    cleanups.push(() => { plain.dispose(); v.dispose(); });
    expect(patchIds(v)).toEqual([]); expect(v.side).toBe(THREE.DoubleSide); expect(liveFamilyMaterials().has(v)).toBe(false);
    const ground = familyMaterial({ family: 'pbr', ground: {} }, context(scope)), gv = familyVariant(ground, scope);
    expect(gv.customProgramCacheKey()).toBe(ground.customProgramCacheKey());
    expect(gv.userData['familyUniforms']).toBe(ground.userData['familyUniforms']);
    gv.dispose();
  });

  it('the PBR family takes a renderer-neutral flat-shading option', () => {
    const scope = new Scope('props.faceted'); cleanups.push(() => { scope.dispose(); });
    const flat = familyMaterial({ family: 'pbr', faceted: true }, context(scope)), smooth = familyMaterial({ family: 'pbr' }, context(scope));
    expect(flat).toBeInstanceOf(THREE.MeshStandardMaterial); expect(smooth).toBeInstanceOf(THREE.MeshStandardMaterial);
    if (!(flat instanceof THREE.MeshStandardMaterial) || !(smooth instanceof THREE.MeshStandardMaterial)) return;
    expect([flat.flatShading, smooth.flatShading]).toEqual([true, false]);
    // a distinct program variant, so the shader step compiles it before its first draw
    const keys = familyCompileJobs(null, null, 64).flatMap((job) => job.root.children).map((o) => (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial ? o.material : null));
    expect(keys).toContain(flat);
  });
});
