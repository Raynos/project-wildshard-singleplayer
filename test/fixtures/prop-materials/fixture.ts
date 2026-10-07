// SF55 named prop materials: a fixture props GLB carrying three named materials (as the world bake keeps the source
// glTF names) and the look / props.materials data that maps them to three look.materials (toon, PBR, an outlined graph),
// each with colour + normal + metallic-roughness + emissive slots (the graph reads colour, MR and emissive through its
// own texture params).
import { Document, NodeIO } from '@gltf-transform/core';
import type { GraphIr } from '../../../src/engine/core/materialGraph';

/** a box's indexed triangles with normals and UV0, centred on (cx, 0.5, 0) */
function box(cx: number): { positions: Float32Array<ArrayBuffer>; normals: Float32Array<ArrayBuffer>; uvs: Float32Array<ArrayBuffer>; indices: Uint16Array<ArrayBuffer> } {
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const [n, u, v] of faces) {
    const base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      positions.push(cx + 0.5 * (n[0] ?? 0) + 0.5 * (a * (u[0] ?? 0) + b * (v[0] ?? 0)), 0.5 + 0.5 * (n[1] ?? 0) + 0.5 * (a * (u[1] ?? 0) + b * (v[1] ?? 0)), 0.5 * (n[2] ?? 0) + 0.5 * (a * (u[2] ?? 0) + b * (v[2] ?? 0)));
      normals.push(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0); uvs.push((a + 1) / 2, (1 - b) / 2);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint16Array.from(indices) };
}

/** The three source glTF material names, as Blender exports them (spaces kept). */
export const NAMES = ['Grey clay', 'Door paint', 'Ink trim'] as const;

/** A props GLB with one box per named material (a fourth name, when given, adds an unmapped box). */
export async function namedMaterialsGlb(extra?: string): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('props');
  const names: string[] = [...NAMES, ...(extra === undefined ? [] : [extra])];
  names.forEach((name, i) => {
    const g = box(i * 1.5 - 1.5);
    const material = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(i === 1 ? 1 : 0)
      .setEmissiveFactor(i === 1 ? [1, 0.6, 0.2] : [0, 0, 0]);
    const primitive = doc.createPrimitive().setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.normals).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(g.uvs).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.indices).setBuffer(buffer));
    scene.addChild(doc.createNode(`box-${i}`).setMesh(doc.createMesh(`box-${i}`).addPrimitive(primitive)));
  });
  return new NodeIO().writeBinary(doc);
}

/** An outlined standard graph that reads the colour, metallic-roughness and emissive slots through its texture params. */
export function slotGraph(files: { colour: string; metallicRoughness: string; emissive: string }): GraphIr {
  return {
    version: 1, kind: 'material', model: 'standard',
    params: { colour: { type: 'texture', value: files.colour }, metallicRoughness: { type: 'texture', value: files.metallicRoughness }, emissive: { type: 'texture', value: files.emissive } },
    nodes: {
      uv: { op: 'uv' }, c: { op: 'texture', param: 'colour', in: ['uv'] }, cRgb: { op: 'swizzle', in: ['c'], mask: 'xyz' },
      mr: { op: 'texture', param: 'metallicRoughness', in: ['uv'] }, rough: { op: 'swizzle', in: ['mr'], mask: 'y' }, metal: { op: 'swizzle', in: ['mr'], mask: 'z' },
      e: { op: 'texture', param: 'emissive', in: ['uv'] }, eRgb: { op: 'swizzle', in: ['e'], mask: 'xyz' },
      n: { op: 'normalLocal' }, off: { op: 'mul', in: ['n', 0.03] }, ink: { op: 'const', value: [0.02, 0.02, 0.03] },
    },
    stages: { surface: { colour: 'cRgb', roughness: 'rough', metalness: 'metal', emissive: 'eRgb' }, outline: { offset: 'off', colour: 'ink' } },
  };
}
