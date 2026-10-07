// SF55 (G211): named prop materials. A props GLB with three named materials binds each to its own look.materials entry
// (toon, PBR, an outlined graph) with its KTX2 slots and samplers; an unmapped name refuses; the one-family path is untouched.
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { familyMaterial, type FamilyContext } from '../src/engine/render/families/registry';
import { ToonLook } from '../src/engine/render/families/toon';
import { PainterlyLook } from '../src/engine/render/families/painterly';
import { EmissiveLook } from '../src/engine/render/families/emissive';
import { attachOutline, compileGraph } from '../src/engine/render/graph/compile';
import { installDeclaredProps } from '../src/engine/world/declaredProps';
import { MaterialsSchema } from '../src/game/shardfile/materials';
import { clientGraphs, graphOutlineHook, isGraphEntry } from '../src/game/shardfile/clientGraphs';
import { clientTileViews } from '../src/game/shardfile/clientViews';
import { propSurfaces } from '../src/game/shardfile/clientPropMaterials';
import { PropMaterialsSchema, checkPropMaterialNames, glbMaterialNames, propMaterialTextureRefs, propMaterialsOf, validatePropMaterials, type PropMaterials } from '../src/game/shardfile/propMaterials';
import { parseGlb } from '../src/game/shardfile/assets';
import { NAMES, namedMaterialsGlb, slotGraph } from './fixtures/prop-materials/fixture';
import { emptyShardfile } from '@wildshard/sdk/author';

const h = (c: string): string => c.repeat(64);
const GLB = h('a'), FILES = { clayColour: h('1'), clayNormal: h('2'), clayMr: h('3'), clayEmissive: h('4'), doorColour: h('5'), doorNormal: h('6'), doorMr: h('7'), doorEmissive: h('8'), inkColour: h('9'), inkMr: h('b'), inkEmissive: h('c') };
const PLACEHOLDER = h('d'), CLAMP = 33071, MIRROR = 33648;

function look() {
  return v.parse(MaterialsSchema, {
    'world.clay': { family: 'toon' }, 'world.door': { family: 'pbr' },
    // the catalogue graph's own texture defaults are placeholders; each named binding fills its params with its slots
    'world.ink': { family: 'graph', graph: slotGraph({ colour: PLACEHOLDER, metallicRoughness: PLACEHOLDER, emissive: PLACEHOLDER }) },
  });
}
function named(overrides: Record<string, unknown> = {}): PropMaterials {
  return v.parse(PropMaterialsSchema, {
    'Grey clay': { id: 'world.clay', colour: { file: FILES.clayColour }, normal: { file: FILES.clayNormal, scale: 0.5 }, metallicRoughness: { file: FILES.clayMr }, emissive: { file: FILES.clayEmissive } },
    'Door paint': { id: 'world.door', colour: { file: FILES.doorColour, wrapS: CLAMP, wrapT: MIRROR, minFilter: 9729, magFilter: 9728 }, normal: { file: FILES.doorNormal }, metallicRoughness: { file: FILES.doorMr }, occlusion: { file: FILES.doorMr, strength: 0.7 }, emissive: { file: FILES.doorEmissive } },
    'Ink trim': { id: 'world.ink', colour: { file: FILES.inkColour }, metallicRoughness: { file: FILES.inkMr }, emissive: { file: FILES.inkEmissive } },
    ...overrides,
  });
}
const files = (slotFiles: readonly string[] = Object.values(FILES)) => [{ hash: GLB, kind: 'glb', dependencies: [...slotFiles] }, ...Object.values(FILES).map((hash) => ({ hash, kind: 'ktx2', dependencies: [] }))];

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

/** the client side as clientMaterials composes it, with stand-in textures for the transcoded KTX2 files */
function client(row = true) {
  const scope = new Scope('prop-materials'); cleanups.push(() => { scope.dispose(); });
  const textures = new Map<string, THREE.Texture>(), roles = new Map<string, string>(), graphReads: string[] = [];
  for (const ref of [...Object.values(FILES), PLACEHOLDER]) { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.name = ref; textures.set(ref, scope.own(t)); }
  const texture = (ref: string, use: 'colour' | 'data'): THREE.Texture => {
    const t = textures.get(ref); if (t === undefined) throw new Error(`no texture ${ref}`);
    const seen = roles.get(ref); if (seen !== undefined && seen !== use) throw new Error('mixed roles'); roles.set(ref, use);
    t.colorSpace = use === 'colour' ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
  };
  const context: FamilyContext = { toon: new ToonLook(), painterly: new PainterlyLook(), emissive: new EmissiveLook(), textures: texture, scope };
  const base = emptyShardfile({ slug: 'prop-materials', name: 'Prop materials', author: 'Local', seed: 1, revision: 1 });
  // the graph's placeholder texture defaults are not admitted files here: the client side reads only look and state
  const source = { look: { ...base.look, materials: look() }, state: base.state };
  const graphs = clientGraphs(source, { compiler: row ? { compileGraph, attachOutline } : null, fallback: (entry) => familyMaterial(entry, context), textures: (ref) => { graphReads.push(ref); return texture(ref, 'colour'); } });
  const compile = (entry: unknown): THREE.Material => (isGraphEntry(entry) ? scope.own(graphs.compile(entry)) : scope.own(familyMaterial(entry, context)));
  const catalogue = new Map(Object.entries(source.look.materials).map(([id, entry]) => [id, compile(entry)]));
  catalogue.set('pbr', compile({ family: 'pbr', vertexColours: true, metalness: 0 }));
  graphReads.length = 0;
  const surfaces = propSurfaces(named(), { look: source.look.materials, catalogue, compile, texture });
  return { scope, textures, surfaces, catalogue, graphs, graphReads, outline: graphOutlineHook(graphs.outline) };
}
const props = { version: 1 as const, family: 'pbr', tiles: [{ lod: 0 as const, x: 0, z: 0, file: GLB }], panels: [], models: [], far: null, colliders: [], textures: [] };
function isMesh(o: THREE.Object3D): o is THREE.Mesh { return o instanceof THREE.Mesh; }
function meshesOf(root: THREE.Object3D): THREE.Mesh[] { const out: THREE.Mesh[] = []; root.traverse((o) => { if (isMesh(o)) out.push(o); }); return out; }
const bodyByName = (root: THREE.Object3D, name: string): THREE.Mesh => {
  const mesh = meshesOf(root).find((m) => m.name === `box-${NAMES.indexOf(name as (typeof NAMES)[number])}`); if (mesh === undefined) throw new Error(`no body ${name}`); return mesh;
};

describe('named prop materials: data (SF55)', () => {
  it('admits the fixture mapping and lists every slot file once', () => {
    expect(() => validatePropMaterials(named(), { look: look(), models: [GLB], textures: [], files: files() })).not.toThrow();
    expect(propMaterialTextureRefs(named()).sort()).toEqual(Object.values(FILES).sort());
    expect(propMaterialsOf({ ...props })).toBeUndefined();
    expect(Object.keys(propMaterialsOf({ ...props, materials: named() }) ?? {})).toEqual([...NAMES]);
  });
  it('reads the source names out of the admitted fixture GLB and refuses an unmapped one', async () => {
    const bytes = await namedMaterialsGlb();
    expect(() => parseGlb(bytes)).not.toThrow();
    expect(glbMaterialNames(bytes)).toEqual([...NAMES]);
    expect(() => checkPropMaterialNames(named(), bytes)).not.toThrow();
    const unmapped = await namedMaterialsGlb('Brass Rail.001');
    expect(() => checkPropMaterialNames(named(), unmapped)).toThrow(/"Brass Rail\.001" is not in props\.materials/u);
  });
  it.each([
    ['an unknown material ID', { 'Grey clay': { id: 'world.none' } }, /not an admitted material ID/u],
    ['a graph slot without its texture param', { 'Ink trim': { id: 'world.ink', normal: { file: FILES.clayNormal } } }, /no texture param "normal"/u],
    ['a painterly metallic-roughness slot', { 'Grey clay': { id: 'painterly', metallicRoughness: { file: FILES.clayMr } } }, /painterly family draws no metallicRoughness/u],
    ['an emissive-family normal slot', { 'Grey clay': { id: 'emissive', normal: { file: FILES.clayNormal } } }, /emissive family draws no normal/u],
    ['one file in two roles', { 'Grey clay': { id: 'world.clay', colour: { file: FILES.doorNormal } } }, /mix colour and numeric data roles/u],
    ['one file with two samplers', { 'Grey clay': { id: 'world.clay', colour: { file: FILES.doorColour } } }, /one sampler/u],
  ])('refuses %s', (_label, override, message) => {
    expect(() => validatePropMaterials(named(override), { look: look(), models: [GLB], textures: [], files: files() })).toThrow(message);
  });
  it('refuses a slot file the props GLBs do not depend on, a catalogue texture, and props.textures beside named materials', () => {
    expect(() => validatePropMaterials(named(), { look: look(), models: [GLB], textures: [], files: files(Object.values(FILES).slice(1)) })).toThrow(/KTX2 dependency of a declared props GLB/u);
    const shared = v.parse(MaterialsSchema, { ...look(), 'world.tex': { family: 'pbr', maps: { colour: FILES.clayColour, normal: null, orm: null } } });
    expect(() => validatePropMaterials(named(), { look: shared, models: [GLB], textures: [], files: files() })).toThrow(/also a look\.materials texture/u);
    expect(() => validatePropMaterials(named(), { look: look(), models: [GLB], textures: [{ model: GLB }], files: files() })).toThrow(/replaces props\.textures/u);
    expect(() => v.parse(PropMaterialsSchema, { ' Edge': { id: 'pbr' } })).toThrow();
    expect(() => v.parse(PropMaterialsSchema, {})).toThrow();
  });
});

describe('named prop materials: render (SF55)', () => {
  it('binds each GLB material to its look.materials entry with its slots and samplers, and outlines the graph', async () => {
    const { scope, textures, surfaces, catalogue, graphs, graphReads, outline } = client();
    const bytes = await namedMaterialsGlb(), level = new Scope('prop-materials.tile'); cleanups.push(() => { level.dispose(); });
    const views = clientTileViews({ terrain: null, materials: catalogue, textures, outline, surfaces });
    const root = new THREE.Group(), tile = await views.props({ ...props }, '0/0/0', bytes, root, level);
    expect(tile).not.toBeNull();
    const tex = (ref: string) => textures.get(ref);

    // Grey clay → world.clay (toon): a variant keeping the toon program, every slot bound
    const clay = bodyByName(root, 'Grey clay').material;
    if (!(clay instanceof THREE.MeshStandardMaterial)) throw new Error('toon is standard');
    const toonBase = catalogue.get('world.clay');
    expect(clay).not.toBe(toonBase); expect(clay.customProgramCacheKey()).toBe(toonBase?.customProgramCacheKey());
    expect([clay.map, clay.normalMap, clay.roughnessMap, clay.metalnessMap, clay.emissiveMap]).toEqual([tex(FILES.clayColour), tex(FILES.clayNormal), tex(FILES.clayMr), tex(FILES.clayMr), tex(FILES.clayEmissive)]);
    expect(clay.normalScale.toArray()).toEqual([0.5, -0.5]);
    expect(tex(FILES.clayColour)?.colorSpace).toBe(THREE.SRGBColorSpace); expect(tex(FILES.clayNormal)?.colorSpace).toBe(THREE.NoColorSpace);
    expect(tex(FILES.clayEmissive)?.colorSpace).toBe(THREE.SRGBColorSpace);
    // glTF's default sampler: repeat, trilinear
    expect([tex(FILES.clayColour)?.wrapS, tex(FILES.clayColour)?.wrapT, tex(FILES.clayColour)?.minFilter, tex(FILES.clayColour)?.magFilter]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.LinearMipmapLinearFilter, THREE.LinearFilter]);

    // Door paint → world.door (PBR): slots, packed occlusion, the GLB's emissive and metal factors, its explicit sampler
    const door = bodyByName(root, 'Door paint').material;
    if (!(door instanceof THREE.MeshStandardMaterial)) throw new Error('pbr is standard');
    expect([door.map, door.normalMap, door.roughnessMap, door.aoMap, door.emissiveMap]).toEqual([tex(FILES.doorColour), tex(FILES.doorNormal), tex(FILES.doorMr), tex(FILES.doorMr), tex(FILES.doorEmissive)]);
    expect(door.aoMapIntensity).toBe(0.7); expect(door.metalness).toBe(1);
    expect(door.emissive.getHex(THREE.LinearSRGBColorSpace)).toBe(new THREE.Color().setRGB(1, 0.6, 0.2, THREE.LinearSRGBColorSpace).getHex(THREE.LinearSRGBColorSpace));
    expect([tex(FILES.doorColour)?.wrapS, tex(FILES.doorColour)?.wrapT, tex(FILES.doorColour)?.minFilter, tex(FILES.doorColour)?.magFilter]).toEqual([THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping, THREE.LinearFilter, THREE.NearestFilter]);

    // Ink trim → world.ink (graph): compiled once more with the slot files in its own params, drawn as compiled, outlined
    const ink = bodyByName(root, 'Ink trim'), inkMaterial = ink.material;
    if (Array.isArray(inkMaterial)) throw new Error('one material');
    expect(Reflect.get(inkMaterial, 'isNodeMaterial')).toBe(true);
    expect(new Set(graphReads)).toEqual(new Set([FILES.inkColour, FILES.inkMr, FILES.inkEmissive]));
    const hull = graphs.outline(inkMaterial);
    expect(hull).not.toBeNull();
    expect(ink.children.filter(isMesh).map((c) => c.material)).toEqual([hull?.material]);
    // only the graph mesh draws a hull: the toon and PBR bodies keep one draw
    expect(meshesOf(root)).toHaveLength(4);
    expect(surfaces('Ink trim').material).toBe(inkMaterial);
    level.dispose(); expect(meshesOf(root).filter((m) => m.parent === ink)).toHaveLength(0);
    expect(scope.disposed).toBe(false);
  });

  it('a graph that falls back (Debug row off) still draws its slots on the preset, with no hull', async () => {
    const { textures, catalogue, outline, surfaces } = client(false);
    const level = new Scope('prop-materials.off'); cleanups.push(() => { level.dispose(); });
    const root = new THREE.Group();
    await clientTileViews({ terrain: null, materials: catalogue, textures, outline, surfaces }).props({ ...props }, '0/0/0', await namedMaterialsGlb(), root, level);
    const ink = bodyByName(root, 'Ink trim').material;
    if (!(ink instanceof THREE.MeshStandardMaterial)) throw new Error('the fallback preset is PBR');
    expect([ink.map, ink.roughnessMap, ink.emissiveMap]).toEqual([textures.get(FILES.inkColour), textures.get(FILES.inkMr), textures.get(FILES.inkEmissive)]);
    expect(meshesOf(root)).toHaveLength(3);
  });

  it('refuses to install a GLB whose material name is unmapped, naming it', async () => {
    const { textures, catalogue, outline, surfaces } = client();
    const level = new Scope('prop-materials.unmapped'); cleanups.push(() => { level.dispose(); });
    await expect(clientTileViews({ terrain: null, materials: catalogue, textures, outline, surfaces }).props({ ...props }, '0/0/0', await namedMaterialsGlb('Brass Rail.001'), new THREE.Group(), level)).rejects.toThrow(/"Brass Rail\.001" is not in props\.materials/u);
  });

  it('without named materials every mesh still draws the one family (the default path)', async () => {
    const { textures, catalogue } = client();
    const level = new Scope('prop-materials.default'); cleanups.push(() => { level.dispose(); });
    const bytes = await namedMaterialsGlb();
    const installed = await installDeclaredProps({ ...props }, { scene: new THREE.Group(), scope: level, assets: new Map([[GLB, bytes]]), materials: catalogue, textures });
    const root = installed.tiles.get('0/0/0'); if (root === undefined) throw new Error('no tile');
    const pbr = catalogue.get('pbr');
    for (const mesh of meshesOf(root)) {
      const m = mesh.material; if (!(m instanceof THREE.MeshStandardMaterial) || !(pbr instanceof THREE.MeshStandardMaterial)) throw new Error('pbr family');
      expect(m.map).toBe(pbr.map); expect(m.normalMap).toBe(pbr.normalMap); expect(m.emissiveMap).toBeNull();
    }
  });
});
