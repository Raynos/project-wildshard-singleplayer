import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, PointLight, Quaternion, Scene, ShaderMaterial, Vector3 } from 'three';
import { BoxCollider, CapsuleCollider, HullCollider, MeshCollider } from '../src/sdk/physics';
import { Entry } from '../src/sdk/entries';
import { PlayerStart, Spawn } from '../src/sdk/spawns';
import { readScene } from '../src/sdk/scene';

describe('Node authoring scene reader', () => {
  it('reads real three.js geometry and shared material references deterministically, without UUIDs', () => {
    const make = (): Scene => {
      const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial({ color: 0x123456 });
      scene.add(new Mesh(geometry, material), new Mesh(geometry, material)); return scene;
    };
    const first = readScene(make()), second = readScene(make());
    expect(first).toStrictEqual(second); expect(first.geometries).toHaveLength(1); expect(first.materials).toHaveLength(1);
    expect(first.geometries[0]?.attributes['position']?.array).toHaveLength(72);
    expect(JSON.stringify(first)).not.toContain('uuid');
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- Serialization is the authoring intermediate contract.
    expect(JSON.parse(JSON.stringify(first))).toStrictEqual(first);
  });
  it('preserves instance matrices and ordinary point-light declarations', () => {
    const scene = new Scene(), instances = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 2);
    instances.setMatrixAt(1, new Matrix4().makeTranslation(4, 2, 3)); scene.add(instances, new PointLight(0xff8800, 5, 12, 2));
    const rows = readScene(scene); expect(rows.nodes[1]?.instances?.[1]?.slice(12, 15)).toEqual([4, 2, 3]);
    expect(rows.nodes[2]?.light).toMatchObject({ intensity: 5, parameters: { distance: 12, decay: 2 } });
  });
  it('clones authoring objects through the standard three.js scene graph operation', () => {
    const scene = new Scene(), box = new BoxCollider(2, 3, 4, 'metal'), mesh = new MeshCollider(new BoxGeometry()), spawn = new Spawn('goat');
    box.name = 'box'; mesh.name = 'mesh'; spawn.name = 'goat'; scene.add(box, mesh, spawn, ...Entry.midpoints());
    expect(readScene(scene.clone())).toStrictEqual(readScene(scene));
    const cloned = box.clone(); cloned.width = 7; expect(box.width).toBe(2); expect(cloned.toColliderData().hx).toBe(3.5);
  });
  it('refuses nonfinite materials and lights rather than turning their numbers into JSON null', () => {
    const scene = new Scene(); scene.add(new PointLight(0xffffff, Number.NaN)); expect(() => readScene(scene)).toThrow(/finite JSON/u);
    const material = new MeshStandardMaterial(); material.opacity = Infinity;
    const meshes = new Scene(); meshes.add(new Mesh(new BoxGeometry(), material)); expect(() => readScene(meshes)).toThrow(/finite JSON/u);
  });
  it('applies a parent transform once to colliders, with full dimensions becoming half extents', () => {
    const scene = new Scene(), parent = new Group(), box = new BoxCollider(2, 4, 6, 'wood'); box.name = 'wall';
    parent.position.set(10, 2, 3); parent.rotation.y = Math.PI / 2; parent.scale.set(2, 3, 4); box.position.set(1, 2, 3);
    scene.add(parent); parent.add(box); const shape = readScene(scene).colliders[0]?.shape;
    expect(shape).toMatchObject({ kind: 'box', hx: 2, hy: 6, hz: 12, surface: 'wood' });
    const expected = new Vector3(1, 2, 3).applyMatrix4(parent.matrixWorld);
    expect(shape?.x).toBe(expected.x); expect(shape?.y).toBe(expected.y); expect(shape?.z).toBe(expected.z);
  });
  it('retains authored hull vertices and exact triangle topology without mutating their geometry', () => {
    const geometry = new BoxGeometry(), before = Array.from(geometry.getAttribute('position').array), hull = new HullCollider(geometry), mesh = new MeshCollider(geometry);
    hull.name = 'hull'; mesh.name = 'mesh'; mesh.scale.set(2, 3, 4);
    const scene = new Scene(); scene.add(hull, mesh); const shapes = readScene(scene).colliders.map(row => row.shape);
    const first = shapes[0], second = shapes[1];
    if (first?.kind !== 'hull' || second?.kind !== 'trimesh') throw new Error('Missing authored collision');
    expect(first.points).toEqual(before); expect(second.indices).toEqual(Array.from(geometry.getIndex()?.array ?? []));
    expect(second.vertices.slice(0, 3)).toEqual([1, 1.5, 2]); expect(Array.from(geometry.getAttribute('position').array)).toEqual(before);
  });
  it('records native start, spawn order and the four midpoint sockets', () => {
    const scene = new Scene(), start = new PlayerStart(), spawn = new Spawn('goat'); spawn.name = 'goat.1';
    start.position.set(1, 2, 3); spawn.position.set(4, 5, 6); spawn.rotation.y = 0.4; scene.add(start, spawn, ...Entry.midpoints());
    const rows = readScene(scene); expect(rows.playerStart).toEqual({ x: 1, y: 2, z: 3, yaw: 0 });
    expect(rows.spawns).toEqual([{ id: 'goat.1', kind: 'goat', x: 4, y: 5, z: 6, yaw: 0.4 }]);
    expect(rows.entries.map(row => row.at)).toEqual([[0, 0, 250], [250, 0, 0], [0, 0, -250], [-250, 0, 0]]);
  });
  it('refuses approximation of reflected, sheared, collapsed or nonuniform capsule transforms', () => {
    const box = new BoxCollider(); box.name = 'box'; box.scale.x = -1; expect(() => box.toColliderData()).toThrow(/positive/u);
    box.scale.set(1, 1, 1); box.matrixAutoUpdate = false; box.matrix.set(1, 0.1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    expect(() => box.toColliderData()).toThrow(/unsheared/u);
    const capsule = new CapsuleCollider(); capsule.scale.set(1, 2, 1); expect(() => capsule.toColliderData()).toThrow(/uniform/u);
    box.matrixAutoUpdate = true; box.scale.x = 0; expect(() => box.toColliderData()).toThrow();
  });
  it('refuses malformed geometry, unnamed ownership and duplicate actor or collider identities', () => {
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geometry.setIndex([0, 1, 9]); expect(() => new MeshCollider(geometry).toColliderData()).toThrow(/indices/u);
    const scene = new Scene(), a = new BoxCollider(), b = new BoxCollider(); scene.add(a); expect(() => readScene(scene)).toThrow(/name/u);
    a.name = b.name = 'box'; scene.add(b); expect(() => readScene(scene)).toThrow(/Duplicate collider/u);
    const start = new PlayerStart(); start.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.1));
    const starts = new Scene(); starts.add(start); expect(() => readScene(starts)).toThrow(/upright/u);
    const moved = new Entry('north'); moved.position.z -= 1; expect(() => moved.toEntryData()).toThrow(/midpoint/u);
  });
  it('refuses raw shader code and custom material callbacks', () => {
    const scene = new Scene(); scene.add(new Mesh(new BoxGeometry(), new ShaderMaterial())); expect(() => readScene(scene)).toThrow(/Raw shaders/u);
    const material = new MeshStandardMaterial(); material.onBeforeCompile = () => undefined;
    const callbackScene = new Object3D(); callbackScene.add(new Mesh(new BoxGeometry(), material)); expect(() => readScene(callbackScene)).toThrow(/callbacks/u);
  });
});
