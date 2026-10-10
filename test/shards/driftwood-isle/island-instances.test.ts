import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TiledInstances, type InstProto } from '@wildshard/sdk/looks/instancedTiles';

// G144 (E435, the default-off driftwoodIslandInstancing row): the island's placements as one InstancedMesh per prototype
// and set; a tile changing reach or view repacks the meshes with rows in it, in-view rows first.

const tri: InstProto = { pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), col: new Uint8Array([200, 100, 50, 255, 200, 100, 50, 255, 200, 100, 50, 255]), index: new Uint32Array([0, 1, 2]) };
const lo: InstProto = { pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), col: new Uint8Array(12).fill(255), index: new Uint32Array([0, 1, 2]) };

/** placements.bin rows: proto, x, y, z, quaternion, scale, tint */
function placements(rows: [number, number, number, number][]): Float32Array {
  const f = new Float32Array(rows.length * 10);
  for (const [i, [p, x, z, tint]] of rows.entries()) f.set([p, x, 0, z, 0, 0, 0, 1, 1, tint], i * 10);
  return f;
}

function camera(x: number, z: number, lookX: number, lookZ: number): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  c.position.set(x, 2, z); c.lookAt(lookX, 2, lookZ);
  return c;
}

describe('island instancing', () => {
  // two caster tiles 200 m apart (x 0..10 and 200..210): proto 0 has a far copy (proto 1), proto 2 has none
  const f = placements([[0, 5, 5, 1], [2, 6, 6, 1.5], [0, 205, 5, 1], [2, 206, 6, 1]]);
  const rects = [{ x0: 0, x1: 10, z0: 0, z1: 10 }, { x0: 200, x1: 210, z0: 0, z1: 10 }];
  const build = () => {
    const group = new THREE.Group();
    const ins = new TiledInstances(group, [tri, lo, tri], ['palm', 'palm_lo', 'rock'], f, new Map([[0, 1]]), 'island-');
    ins.add({ tag: 'casters', tiles: [[0, 1], [2, 3]], rects, material: new THREE.MeshBasicMaterial(), cast: true, reach: 0, lod: 110, cover: false });
    return { group, ins };
  };

  it('makes one mesh per prototype and role, sized for its rows, nothing drawn before the first update', () => {
    const { group, ins } = build();
    const meshes = group.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
    expect(meshes.map((m) => m.name)).toEqual(['island-casters-both-rock', 'island-casters-near-palm', 'island-casters-far-palm_lo']);
    expect(meshes.map((m) => m.instanceMatrix.count)).toEqual([2, 2, 2]);
    expect(meshes.every((m) => m.count === 0 && !m.frustumCulled)).toBe(true);
    expect(ins.stats.rows).toBe(6);
  });

  it('draws the near copies within the LOD, the far ones past it, and only what is in view or in a shadow', () => {
    const { group, ins } = build();
    const [rock, near, far] = group.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
    // standing by tile 0, looking away from tile 1 (−x): tile 0 is in view, tile 1 far and out of view, no cascades
    ins.update(camera(5, 5, 4, 5), []);
    expect(near?.count).toBe(1); expect(far?.count).toBe(0); expect(rock?.count).toBe(1);
    expect(near?.instanceMatrix.array[12]).toBe(5); // the in-view palm's translation
    // looking at tile 1 from tile 0 (200 m): both in view, tile 1 draws its far copy
    ins.update(camera(5, 5, 205, 5), []);
    expect(near?.count).toBe(1); expect(far?.count).toBe(1); expect(rock?.count).toBe(2);
    expect(far?.instanceMatrix.array[12]).toBe(205);
    // the tint rides per row
    const tint = rock?.geometry.getAttribute('aTint');
    expect(tint instanceof THREE.InstancedBufferAttribute ? Array.from(tint.array.slice(0, 2)) : null).toEqual([1.5, 1]);
  });

  it('packs a shadow-only tile after the in-view ones: the camera draws the prefix, a reached cascade all', () => {
    const { group, ins } = build();
    const rock = group.children.find((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && o.name.endsWith('rock'));
    const light = new THREE.DirectionalLight(); light.castShadow = true;
    // a cascade box around tile 1 only
    const box = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
    box.position.set(205, 100, 5); box.lookAt(205, 0, 5); box.updateMatrixWorld();
    light.shadow.camera = box;
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(box.projectionMatrix, box.matrixWorldInverse));
    light.shadow.getFrustum = () => fr;
    const cam = camera(5, 5, 4, 5);
    ins.update(cam, [light]);
    if (rock === undefined) throw new Error('no rock mesh');
    // the draw hooks as three calls them (the renderer is not read)
    const draw = (viewer: THREE.Camera) => { Reflect.apply(Reflect.get(rock, 'onBeforeRender'), rock, [null, new THREE.Scene(), viewer, rock.geometry, rock.material, null]); };
    const shadow = (shadowCamera: THREE.Camera) => { Reflect.apply(Reflect.get(rock, 'onBeforeShadow'), rock, [null, rock, cam, shadowCamera, rock.geometry, rock.material, null]); };
    draw(cam);
    expect(rock.count).toBe(1);
    shadow(box);
    expect(rock.count).toBe(2);
    expect(rock.instanceMatrix.array[16 + 12]).toBe(206); // the shadow-only row after the in-view one
    const other = new THREE.OrthographicCamera();
    const light2 = new THREE.DirectionalLight(); light2.shadow.camera = other; light2.castShadow = true;
    light2.shadow.getFrustum = () => new THREE.Frustum(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1000));
    ins.update(cam, [light, light2]);
    shadow(other);
    expect(rock.count).toBe(0); // a cascade none of its tiles reaches draws nothing
  });

  it('hands the cover grid the merged tiles\' triangles: f32 world positions, the truncated tinted colour', () => {
    const group = new THREE.Group();
    const cf = placements([[0, 3, 4, 1.3]]);
    const ins = new TiledInstances(group, [tri], ['fern'], cf, new Map(), 'island-');
    ins.add({ tag: 'cover', tiles: [[0]], rects: [rects[0] ?? { x0: 0, x1: 1, z0: 0, z1: 1 }], material: new THREE.MeshBasicMaterial(), cast: false, reach: 41, lod: 110, cover: true });
    const tris: { bx: number; dy: number; r: number; g: number }[] = [];
    for (const t of ins.coverTriangles()) tris.push({ bx: t.bx, dy: t.dy, r: t.r, g: t.g }); // (the generator reuses its record)
    expect(tris).toHaveLength(1);
    expect(tris[0]?.bx).toBe(4); expect(tris[0]?.dy).toBe(1);
    expect(tris[0]?.r).toBeCloseTo(Math.trunc(Math.min(255, 200 * Math.fround(1.3))) / 255, 12);
    expect(tris[0]?.g).toBeCloseTo(Math.trunc(100 * Math.fround(1.3)) / 255, 12);
  });
});
