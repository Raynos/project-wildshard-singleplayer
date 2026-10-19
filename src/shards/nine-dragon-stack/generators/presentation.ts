import { BufferAttribute, Color, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, type Mesh, Quaternion, Vector3, Vector4 } from 'three';
import { parseSceneBuffers, type SceneBuffers } from '@wildshard/format/sceneBuffers';
import { volumeSources } from './lightVolumes';
import { buildStreaks, stairStreaks } from './receiverCards';
import { buildHalos } from './haloCards';
import { stairPlanData } from './stairPlan';
import plan from '../data/layoutPlan.json' with { type: 'json' };
import world from '../data/worldRows.generated.json' with { type: 'json' };
import lantern from '../data/lantern.json' with { type: 'json' };

const { STAIR, WELL, Y0 } = plan;
const encoded = (values: ArrayBufferView): string => btoa(Array.from(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), value => String.fromCodePoint(value)).join(''));
/** Native typed channels, index and receiver order become data for the existing scene-buffer reader. */
export function cardScene(list: readonly Mesh[], name: string): SceneBuffers {
  const buffers: SceneBuffers['buffers'] = [], attributes: SceneBuffers['attributes'] = [], geometries: SceneBuffers['geometries'] = [], draws: SceneBuffers['draws'] = [];
  const bufferId = (id: string, values: ArrayBufferView, storage: 'f32' | 'u16', instanced: boolean): string => {
    const bytes = encoded(values), shared = buffers.find(row => row.storage === storage && row.instanced === instanced && row.bytes === bytes);
    if (shared !== undefined) return shared.id;
    buffers.push({ id, storage, bytes, instanced }); return id;
  };
  for (const [i, mesh] of list.entries()) {
    const id = String(i), geometry = mesh.geometry, refs: Record<string, string> = {};
    for (const [key, value] of Object.entries(geometry.attributes)) {
      if (!(value instanceof BufferAttribute) || !(value.array instanceof Float32Array)) throw new Error('Presentation needs plain float channels');
      const channel = `${id}.${key}`; refs[key] = channel;
      attributes.push({ id: channel, buffer: bufferId(channel, value.array, 'f32', value instanceof InstancedBufferAttribute), size: value.itemSize, offset: 0, normalized: value.normalized });
    }
    const index = geometry.getIndex(); if (index === null) throw new Error('Presentation triangles missing');
    const key = `${id}.index`;
    attributes.push({ id: key, buffer: bufferId(key, Uint16Array.from(index.array), 'u16', false), size: 1, offset: 0, normalized: false });
    geometries.push({ id, attributes: refs, index: key, ...(geometry instanceof InstancedBufferGeometry ? { instances: geometry.instanceCount } : {}) });
    draws.push({ id, name: mesh.name, at: [0, 0, 0], draw: { kind: 'mesh', geometry: id, at: [0, 0, 0], frustum: mesh.frustumCulled } });
    geometry.dispose();
    if (!Array.isArray(mesh.material)) mesh.material.dispose();
  }
  return parseSceneBuffers({ version: 1, name, buffers, attributes, geometries, draws });
}

/** All filtering, window-facing tests and card geometry run once on the author. */
export function presentationRows(tier: 'phone' | 'desktop', caps: boolean): { streaks: SceneBuffers; halos: SceneBuffers } {
  const source = volumeSources(tier, caps), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  for (const offset of world.rows.portalLanterns) {
    new Matrix4().fromArray(world.records, offset).decompose(position, rotation, scale);
    source.lanterns.push({ at: position.clone().add(new Vector3(0, -lantern.drop * scale.x, 0)), color: new Color(lantern.glow.color),
      w: lantern.glow.w * scale.x, h: lantern.glow.h * scale.x, power: lantern.glow.power, spill: lantern.glow.spill * scale.x });
  }
  const emitters = [...source.signs, ...source.lanterns, ...source.ctxEmitters];
  const square = emitters.filter(e => e.at.y > Y0 + 0.3 && e.at.y < Y0 + 45 && e.at.x > WELL.x0 - 2 && e.at.x < 40 && e.at.z > -170 && e.at.z < 30);
  const u = new Vector3(), n = new Vector3(), c = new Vector3(), point = new Vector3(), white = new Color(1, 1, 1);
  for (const row of source.windows) {
    if (row.win.y <= 0) continue;
    row.m.extractBasis(u, c, n); point.setFromMatrixPosition(row.m).addScaledVector(c, 0.5);
    if (point.y < Y0 + 0.5 || point.y > Y0 + 28 || point.x < WELL.x1 - 1 || point.x > 40 || point.z < -170 || point.z > 30) continue;
    if (n.normalize().dot(new Vector3(6.5, point.y, Math.min(Math.max(point.z, -170), 10)).sub(point)) <= 0) continue;
    square.push({ at: point.clone(), color: row.light.clone().lerp(white, 0.3).multiplyScalar(row.win.y), w: u.length(), h: c.length(), power: 0.07, spill: 0 });
  }
  const stair = stairPlanData(), onStair = emitters.filter(e => e.at.x > STAIR.x0 - 4 && e.at.x < stair.FAR_X && e.at.z > stair.FACE_N - 6 && e.at.z < stair.FACE_S + 6 && e.at.y > Y0 + 0.3 && e.at.y < stair.TOP_Y + 40);
  const floor = buildStreaks(Y0, square, new Vector4(WELL.x0 + 5, WELL.z0 + 5, WELL.x1, WELL.z1 - 5)); floor.name = 'streaks';
  const stairs = stairStreaks(onStair, { flights: stair.FLIGHTS, landings: stair.LANDINGS, rise: stair.RISE, run: stair.RUN, z0: STAIR.z0, z1: STAIR.z1 });
  for (const mesh of stairs) mesh.name = 'streaks-stair';
  const halo = buildHalos({ lanterns: source.lanterns, shops: source.ctxEmitters, signs: source.signs });
  return { streaks: cardScene([floor, ...stairs], 'wet-receivers'), halos: cardScene([halo], 'halos') };
}

export function presentationData(): { open: ReturnType<typeof presentationRows>; capped: ReturnType<typeof presentationRows> } {
  return { open: presentationRows('phone', false), capped: presentationRows('phone', true) };
}
