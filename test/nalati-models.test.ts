// E306 / E315 M3 (docs/plans/MODEL-ARCHITECTURE.md, src/world/nalati/painted.ts): Nalati's models on the model contract.
// A Nalati place is ONE painted mesh, so its models are painted into the place's kit in the old builder's order (bit-
// identical: the kerb ring below is the old KurganField loop verbatim) and `place(…, { drawnInto })` registers them —
// one piece per model with no object of its own, the colliders the copies made, one catalog entry, the set's tap target.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../src/world/registry';
import type { Sky } from '../src/world/Sky';
import { modelContext, defineModel } from '../src/models/model';
import { place, placedCopies } from '../src/models/place';
import { placeSet } from '../src/models/sets';
import { PaintKit, M, blob } from '../src/world/nalati/paint';
import { Flutter } from '../src/world/nalati/Flutter';
import { Smoke } from '../src/world/nalati/Smoke';
import { NalatiSet } from '../src/world/nalati/painted';
import { kurganKerb } from '../src/chunks/nalati-grasslands/models/kurganKerb';
import { fieldstone } from '../src/chunks/nalati-grasslands/models/fieldstone';
import { kurganEntrance } from '../src/chunks/nalati-grasslands/models/kurganEntrance';
import { balbal } from '../src/chunks/nalati-grasslands/models/balbal';
import { checkModels, ON_CONTRACT } from '../scripts/check-models.mjs';

// a stand-in sky: the painterly material asks it for its sun and to prepare the material (no renderer in a test)
const lights: THREE.DirectionalLight[] = [];
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lights, lightDirection: new THREE.Vector3(0, -1, 0) }, sunDir: new THREE.Vector3(0, 1, 0) } as Sky;
const ctx = modelContext(sky);
/** a gently rolling ground */
const ground = (x: number, z: number): number => Math.sin(x * 0.05) * 0.8 + Math.cos(z * 0.07) * 0.6;
const RING = { x: 10, z: -20, r: 8 };
const C = { kerb: new THREE.Color('#948f86'), kerbDark: new THREE.Color('#77736c'), lichen: new THREE.Color('#b9a45a') };

describe('Nalati models (E306 / E315 M3)', () => {
  it('a kerb ring painted through NalatiSet is bit-identical to the loop it replaced', () => {
    // the old KurganField kerb ring + loose stones, verbatim (one ring, the rng stream shared with the placement)
    const old = new PaintKit(0x4b62), orng = old.rng;
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + orng.range(-0.02, 0.02);
      const sx = Math.cos(a), sz = Math.sin(a);
      if (orng.next() < 0.12) continue;
      const x = RING.x + sx * (RING.r + orng.range(-0.15, 0.15)), z = RING.z + sz * (RING.r + orng.range(-0.15, 0.15));
      const fallen = orng.next() < 0.08;
      const s = orng.range(0.34, 0.55);
      const g = blob(s, orng, 1, fallen ? 0.45 : orng.range(0.9, 1.35), 0.2);
      old.add(g, orng.next() < 0.4 ? C.kerbDark : C.kerb, { matrix: M(x, ground(x, z) + s * (fallen ? 0.2 : 0.45), z, a + orng.range(-0.3, 0.3), 1, 1, 1, fallen ? 1.2 : orng.range(-0.1, 0.1)), top: { color: C.lichen, threshold: 0.5, amount: 0.5 }, brush: 0.1 });
    }
    for (let i = 0; i < 4; i++) {
      const a = orng.range(0, Math.PI * 2), d = RING.r + orng.range(1, 7);
      const x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d, s = orng.range(0.15, 0.4);
      old.add(blob(s, orng, 1, 0.55), C.kerbDark, { matrix: M(x, ground(x, z) + s * 0.1, z, orng.range(0, 6)), top: { color: C.lichen, threshold: 0.5, amount: 0.4 } });
    }
    const want = old.finish({ ground });

    // the same through the models
    const kit = new PaintKit(0x4b62), rng = kit.rng;
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    let kerbs = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.02, 0.02);
      const sx = Math.cos(a), sz = Math.sin(a);
      if (rng.next() < 0.12) continue;
      const x = RING.x + sx * (RING.r + rng.range(-0.15, 0.15)), z = RING.z + sz * (RING.r + rng.range(-0.15, 0.15));
      const fallen = rng.next() < 0.08;
      const s = rng.range(0.34, 0.55);
      set.paint(kurganKerb, { x, y: ground(x, z), z, yaw: a }, { s, fallen });
      kerbs++;
    }
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI * 2), d = RING.r + rng.range(1, 7);
      const x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d, s = rng.range(0.15, 0.4);
      set.paint(fieldstone, { x, y: ground(x, z), z, yaw: 0 }, { s, squash: 0.55, rough: 0.22, lift: 0.1, look: 'kurgan' });
    }
    const got = kit.finish({ ground });
    for (const name of ['position', 'normal', 'color']) expect(Array.from(got.getAttribute(name).array), name).toEqual(Array.from(want.getAttribute(name).array));

    // registered: one piece per model, drawn into the set's mesh (no object of its own), its copies counted
    const reg = new WorldRegistry();
    const mesh = new THREE.Mesh(got, new THREE.MeshBasicMaterial());
    const placed = set.register({ ctx, registry: reg, object: mesh });
    expect(placed.map((p) => [p.model, p.copies, p.drawnAs])).toEqual([[kurganKerb.id, kerbs, 'merged'], [fieldstone.id, 4, 'merged']]);
    expect(reg.pieces.map((p) => [p.id, p.object === undefined, p.anchor !== undefined, p.solidFloor])).toEqual([[kurganKerb.id, true, true, true], [fieldstone.id, true, true, true]]);
    const m = reg.models().find((x) => x.id === kurganKerb.id);
    expect(m).toMatchObject({ copies: kerbs, drawnAs: 'merged', pipeline: 'code', live: false, category: 'props' });
    expect(placedCopies(kurganKerb.id)).toBeGreaterThanOrEqual(kerbs);
    // every copy's box holds the stone it painted, and the set's mesh is every model's tap target
    const b = placed[0]?.copyBox(0, new THREE.Box3());
    expect(b?.isEmpty()).toBe(false);
    expect(reg.picks.filter((p) => p.object === mesh).map((p) => p.entry)).toEqual([kurganKerb.id, fieldstone.id]);
    // and the specimen is one stone in its own space
    const specimen = m?.object();
    const bb = new THREE.Box3().setFromObject(specimen ?? new THREE.Object3D());
    expect(bb.getCenter(new THREE.Vector3()).length()).toBeLessThan(1);
  });

  it('carries the colliders a fitted model made, boxes first then its real geometry, with its floor', () => {
    const kit = new PaintKit(0x4b62);
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    const made = set.paint(kurganEntrance, { x: 0, y: ground(0, 0) + 0.5, z: 0, yaw: Math.PI / 2 }, { footY: ground(3, 0) });
    expect(made.boxes?.length).toBeGreaterThan(8);
    expect(made.descs?.map((d) => d.kind)).toEqual(['box', 'treads']);
    const reg = new WorldRegistry();
    set.register({ ctx, registry: reg, object: new THREE.Mesh(kit.finish({ ground }), new THREE.MeshBasicMaterial()) });
    const piece = reg.pieces[0];
    expect(piece?.id).toBe(kurganEntrance.id);
    expect(piece?.surface).toBe('wood');
    expect(piece?.colliders?.slice(-2).map((c) => c.kind)).toEqual(['box', 'treads']);
    expect(piece?.colliders).toHaveLength((made.boxes?.length ?? 0) + 2);
    expect(reg.floorAt(1, 0)).toBeDefined();
  });

  it('places the balbals instanced, one mesh per carved variant, and names the kurgan field as a set', () => {
    const reg = new WorldRegistry();
    const spots = [0, 1, 2, 3].map((i) => ({ x: i * 2, y: 0, z: 0, matrix: M(i * 2, 0, 0, Math.PI / 2), variant: i % 3 === 0 ? 'capped' : 'bare' }));
    const placed = place(balbal, spots, { ctx, draw: 'instanced', registry: reg });
    const meshes = placed.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(meshes.map((x) => [x.name, x.count])).toEqual([[`${balbal.id}:capped:0`, 2], [`${balbal.id}:bare:0`, 2]]);
    const set = placeSet({ id: 'nalati-grasslands/kurgan-field', name: 'Kurgan field', file: 'src/world/nalati/KurganField.ts', members: [placed], registry: reg });
    expect(set.members).toEqual([{ model: balbal.id, copies: 4 }]);
    expect(reg.models().find((x) => x.id === balbal.id)?.variants?.map((v) => v.id)).toEqual(['generated', 'bare', 'capped']);
  });

  it('a place on the contract never registers a built thing by hand again (check-models rule 6)', () => {
    expect(ON_CONTRACT).toContain('src/world/nalati/KurganField.ts');
    expect(checkModels().violations).toEqual([]);
    const bad = checkModels({ 'src/world/nalati/Bridge.ts': "registerSolid(registry, { id: 'nalati-bridge', object: mesh });" }).violations;
    expect(bad).toEqual(['src/world/nalati/Bridge.ts: on the model contract — it places models, it never registers a built thing by hand']);
  });

  it('`drawnInto`: place draws nothing, keeps the object where its set put it, and carries boxes and colliders', () => {
    const post = defineModel({ id: 'shared/test-drawn-post', name: 'Post', category: 'props', pipeline: 'code', file: 'test/nalati-models.test.ts', defaults: {},
      build: () => [{ geometry: new THREE.BoxGeometry(0.2, 2, 0.2), material: new THREE.MeshBasicMaterial() }],
      colliders: () => [{ kind: 'box', x: 0, y: 1, z: 0, hx: 0.1, hy: 1, hz: 0.1 }] });
    const parent = new THREE.Group(), drawn = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    parent.add(drawn);
    const reg = new WorldRegistry();
    const placed = place(post, [{ x: 4, y: 0, z: 0 }], { ctx, draw: 'merged', registry: reg,
      drawnInto: { object: drawn, boxes: Float32Array.of(3, 0, -1, 5, 2, 1), colliders: [{ kind: 'ball', x: 4, y: 3, z: 0, radius: 0.5 }] } });
    expect(placed.object).toBe(drawn);
    expect(drawn.parent).toBe(parent);
    expect(placed.colliders.map((c) => c.kind)).toEqual(['box', 'ball']); // its own-space one posed, then the set's
    expect(reg.pieces[0]?.object).toBeUndefined();
    expect(reg.pieces[0]?.anchor?.toArray()).toEqual([4, 1, 0]);
    expect(placed.copyBox(0, new THREE.Box3()).max.x).toBe(5);
  });
});
