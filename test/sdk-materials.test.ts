import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, Group, Material, Mesh, PointLight, SRGBColorSpace, Scene, SpotLight } from 'three';
import { Fn, dot, normalView, positionWorld, sqrt, uniform, uv, vec3 } from 'three/tsl';
import { validateGraph } from '@wildshard/format/materialGraph';
import { LIGHT_ROWS_MAX, parseLightRows } from '@wildshard/format/lights';
import { GraphMaterial, PainterlyMaterial, ToonMaterial, graph, graphInputs, noise, param, sample } from '@wildshard/sdk/materials';
import { readScene } from '@wildshard/sdk/scene';
import { restoreSceneGraph } from '@wildshard/sdk/sceneGraph';

describe('graph(): TSL to SF59 graph IR', () => {
  it('shares subtrees, inlines constants, names nodes from toVar and collects params', () => {
    const bands = param('bands', { type: 'float', value: 3, min: 1, max: 8 });
    const lit = dot(normalView, graphInputs.sunDirection).saturate().toVar('lit');
    const cel = lit.mul(bands).add(0.5).floor().div(bands);
    const ir = graph({ flatShading: true, surface: { colour: [1, 1, 1] }, lighting: { sun: graphInputs.albedo.mul(cel).mul(lit) } });
    expect(ir.params).toEqual({ bands: { type: 'float', value: 3, min: 1, max: 8 } });
    expect(ir.nodes['lit']).toEqual({ op: 'saturate', in: [expect.any(String)] });
    expect(Object.values(ir.nodes).filter((node) => node.op === 'sunDirection')).toHaveLength(1);
    expect(Object.values(ir.nodes).some((node) => node.op === 'add' && node.in?.[1] === 0.5)).toBe(true);
    expect(validateGraph(ir).ok).toBe(true);
  });
  it('maps swizzles, joins, noise, uv and texture samples', () => {
    const map = param('map', { type: 'texture', value: 'a'.repeat(64) });
    const at = positionWorld.xz.mul(0.1);
    const ir = graph({ model: 'unlit', surface: { colour: sample(map, uv()).rgb.mul(noise(at)), alpha: vec3(positionWorld.y, 1, 1).x } });
    const ops = Object.values(ir.nodes).map((node) => node.op);
    expect(ops).toEqual(expect.arrayContaining(['texture', 'noise', 'uv', 'swizzle', 'combine']));
    expect(Object.values(ir.nodes).find((node) => node.op === 'swizzle' && node.mask === 'xyz')).toBeDefined();
  });
  it('refuses what has no graph op', () => {
    expect(() => graph({ surface: { colour: vec3(uniform(1), 0, 0) } })).toThrow(/use param\(\)/u);
    expect(() => graph({ surface: { roughness: sqrt(positionWorld.y) } })).toThrow(/sqrt has no graph op/u);
    const custom = Fn(() => positionWorld.y.mul(2));
    expect(() => graph({ surface: { roughness: custom() } })).toThrow(/has no graph op/u);
    expect(() => graph({ lighting: { sun: graphInputs.sunColour }, surface: { colour: graphInputs.sunColour } })).toThrow(/graph:/u);
  });
});

describe('SDK catalogue materials', () => {
  it('ToonMaterial bakes to the toon family, its graph preset, or a cel graph with bands / rim', () => {
    const colour = new Color().setRGB(0.5, 0.25, 0.75, SRGBColorSpace);
    expect(new ToonMaterial({ color: colour }).toMaterialEntry()).toMatchObject({ family: 'toon', colour: [0.5, 0.25, 0.75], faceted: true, doubleSided: true });
    expect(new ToonMaterial({ color: colour, graphPreset: true }).toMaterialEntry()).toMatchObject({ family: 'graph', version: 1, preset: { family: 'toon' } });
    const cel = new ToonMaterial({ color: colour, bands: 4, rim: 0.6 }).toMaterialEntry();
    if (cel.family !== 'graph' || !('graph' in cel)) throw new Error('expected a cel graph');
    expect(cel.graph.params?.['bands']?.value).toBe(4);
    expect(validateGraph(cel.graph).ok).toBe(true);
    expect(() => new ToonMaterial({ bands: 1 })).toThrow(/bands/u);
  });
  it('PainterlyMaterial bakes to the painterly family', () => {
    expect(new PainterlyMaterial({ rim: 0.5, sway: 0.1 }).toMaterialEntry()).toMatchObject({ family: 'painterly', rim: 0.5, sway: 0.1, bands: 0.8 });
  });
  it('the scene reader writes catalogue entries and the restore rebuilds the SDK classes', () => {
    const scene = new Scene(), box = new BoxGeometry(1, 1, 1);
    const toon = new Mesh(box, new ToonMaterial({ color: 0x88aa44 })); toon.name = 'toon';
    const paint = new Mesh(box, new PainterlyMaterial({ color: 0xaa88cc })); paint.name = 'paint';
    const lit = new Mesh(box, new GraphMaterial({ surface: { colour: [0.5, 0.5, 0.5] }, lighting: { sun: graphInputs.albedo.mul(graphInputs.sunColour) } })); lit.name = 'graph';
    scene.add(toon, paint, lit);
    const first = readScene(scene);
    expect(first.materials.map((row) => row.entry?.family)).toEqual(['toon', 'painterly', 'graph']);
    const restored = restoreSceneGraph(first);
    const classes: string[] = [];
    restored.traverse((object) => { const material: unknown = object instanceof Mesh ? object.material : null; if (material instanceof Material) classes.push(material.constructor.name); });
    expect(classes).toEqual(['ToonMaterial', 'PainterlyMaterial', 'GraphMaterial']);
    expect(readScene(restored)).toEqual(first);
  });
});

describe('light rows', () => {
  it('the scene reader writes point and spot rows in world space', () => {
    const scene = new Scene(), camp = new Group(); camp.position.set(40, 0, -12); scene.add(camp);
    const fire = new PointLight(0xff9a3c, 2, 8); fire.name = 'camp.fire'; fire.position.set(0, 0.6, 1); camp.add(fire);
    const lamp = new SpotLight(0xffffff, 5, 20, Math.PI / 6, 0.4); lamp.name = 'camp.lamp'; lamp.position.set(0, 4, 0); lamp.target.position.set(0, 0, 2); camp.add(lamp, lamp.target);
    const rows = readScene(scene).lights ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'point', id: 'camp.fire', intensity: 2, distance: 8, decay: 2 });
    expect(rows[0]?.position[0]).toBeCloseTo(40); expect(rows[0]?.position[2]).toBeCloseTo(-11);
    expect(rows[1]).toMatchObject({ kind: 'spot', id: 'camp.lamp', angle: Math.PI / 6, penumbra: 0.4 });
    expect(rows[1]?.kind === 'spot' ? rows[1].target[0] : 0).toBeCloseTo(40);
    expect(readScene(restoreSceneGraph(readScene(scene))).lights).toEqual(rows);
  });
  it('a scene without local lights has no rows; the rows are bounded and unique', () => {
    expect(readScene(new Scene()).lights).toBeUndefined();
    const row = { kind: 'point', id: 'a', position: [0, 0, 0], colour: [1, 1, 1], intensity: 1, distance: 0, decay: 2 };
    expect(() => parseLightRows([row, row])).toThrow(/unique/u);
    expect(() => parseLightRows(Array.from({ length: LIGHT_ROWS_MAX + 1 }, (_, i) => ({ ...row, id: `l${i}` })))).toThrow(/light rows/u);
  });
});
