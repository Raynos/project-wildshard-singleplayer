// E306 / E315 M3 (project/archive/2026-09-30-model-architecture.md, src/shards/nalati-grasslands/world/painted.ts): Nalati's models on the model contract.
// A Nalati place is ONE painted mesh, so its models are painted into the place's kit in the old builder's order (bit-
// identical: the kerb ring below is the old KurganField loop verbatim) and `place(…, { drawnInto })` registers them —
// one piece per model with no object of its own, the colliders the copies made, one catalog entry, the set's tap target.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../../../src/engine/world/registry';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { modelContext, defineModel } from '../../../src/engine/models/model';
import { place, placedCopies } from '../../../src/engine/models/place';
import { placeSet } from '../../../src/engine/models/sets';
import { PaintKit, M } from '../../../src/shards/nalati-grasslands/world/paint';
import { blob } from '../../../src/engine/world/geometryKit';
import { Flutter } from '../../../src/shards/nalati-grasslands/world/Flutter';
import { Smoke } from '../../../src/shards/nalati-grasslands/world/Smoke';
import { NalatiSet } from '../../../src/shards/nalati-grasslands/world/painted';
import { kurganKerb } from '../../../src/shards/nalati-grasslands/models/kurganKerb';
import { fieldstone } from '../../../src/shards/nalati-grasslands/models/fieldstone';
import { kurganEntrance } from '../../../src/shards/nalati-grasslands/models/kurganEntrance';
import { balbal } from '../../../src/shards/nalati-grasslands/models/balbal';
import { checkModels, ON_CONTRACT } from '../../../scripts/check-models.mjs';
// the painted defs the places bake paints with (the page's defs draw the bake: world/placeBake.ts)
import { yurtPainted as yurt } from '../../../src/shards/nalati-grasslands/generators/yurt';
import { barrelPainted as barrel, corralPainted as corral } from '../../../src/shards/nalati-grasslands/generators/campProps';
import { kazan, firewood } from '../../../src/shards/nalati-grasslands/models/campGenerated';
import { fence, fenceRun, addFence } from '../../../src/shards/nalati-grasslands/models/fence';
import { signpost, boardSpots } from '../../../src/shards/nalati-grasslands/models/signpost';
import type { Box } from '../../../src/shards/nalati-grasslands/world/solid';
import { stump, fallenLog } from '../../../src/shards/nalati-grasslands/models/dressingProps';
import { boulder } from '../../../src/shards/nalati-grasslands/models/dressing';
import { Rng } from '../../../src/engine/core/rng';
import { graniteOutcrop, roundedBoulder } from '../../../src/shards/nalati-grasslands/models/outcrop';
import { cragRock, finGeometry } from '../../../src/shards/nalati-grasslands/models/cragRock';
import { registerNalatiPlaces, PLACE_SETS } from '../../../src/shards/nalati-grasslands/world/places';
import { NALATI_PLACES } from '../../../src/shards/nalati-grasslands/quest';

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
    const set = placeSet({ id: 'nalati-grasslands/kurgan-field', name: 'Kurgan field', file: 'src/shards/nalati-grasslands/world/KurganField.ts', members: [placed], registry: reg });
    expect(set.members).toEqual([{ model: balbal.id, copies: 4 }]);
    expect(reg.models().find((x) => x.id === balbal.id)?.variants?.map((v) => v.id)).toEqual(['generated', 'bare', 'capped']);
  });

  it('a place on the contract never registers a built thing by hand again (check-models rule 6)', () => {
    expect(ON_CONTRACT).toContain('src/shards/nalati-grasslands/world/KurganField.ts');
    expect(checkModels().violations).toEqual([]);
    const bad = checkModels({ 'src/shards/nalati-grasslands/world/Bridge.ts': "registerSolid(registry, { id: 'nalati-bridge', object: mesh });" }).violations;
    expect(bad).toEqual([
      'src/shards/nalati-grasslands/world/Bridge.ts: on the model contract — it places models, it never registers a built thing by hand',
      // and Nalati is held on the contract (DONE, the second pass): nothing drawn or registered by hand outside models/
      'src/shards/nalati-grasslands/world/Bridge.ts: nalati-grasslands is on the model contract (DONE) — 1 × registerSolid here; draw and register things through defineModel / place, or declare the file world in DONE with its reason',
    ]);
  });

  it('`drawnInto`: place draws nothing, keeps the object where its set put it, and carries boxes and colliders', () => {
    const post = defineModel({ id: 'shared/test-drawn-post', name: 'Post', category: 'props', pipeline: 'code', file: 'test/shards/nalati-grasslands/nalati-models.test.ts', defaults: {},
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

describe('the camps (E306 / E315 second pass)', () => {
  it('a camp places its yurts, props and generated props; each model is one piece with the colliders its copies made', () => {
    const kit = new PaintKit(0x7a17);
    const flutter = new Flutter(), smoke = new Smoke();
    const set = new NalatiSet(kit, { ground, flutter, smoke });
    set.paint(yurt, { x: 0, y: ground(0, 0), z: 0, yaw: 0.3 }, { r: 3, flue: true, palette: 0, old: false, base: 'lattice', pennant: true });
    set.paint(barrel, { x: 6, y: ground(6, 0), z: 0, yaw: 0 }, { s: 1 });
    set.instance(kazan, { x: 3, y: ground(3, 4), z: 4, rot: 0.4 }, {});
    set.instance(firewood, { x: -4, y: ground(-4, 2), z: 2, rot: 0.9 }, { dy: 0.2, pile: { x: -4, z: 2, hw: 0.8, hd: 0.85, rot: -0.9, yBottom: -1, yTop: 1 } });
    set.instance(firewood, { x: -3, y: ground(-3, 2), z: 2, rot: 0.9 }, { dy: -0.15 });
    // the pennant's cloth and the flue's plume are the shard's, not the kit's
    expect(flutter.count).toBeGreaterThan(0);
    // the data boxes: the yurt's two crossed squares (ghosts), the barrel's, the kazan's, the pile's — in order
    expect(set.boxes.map((b) => b.ghost === true)).toEqual([true, true, false, false, false]);
    const reg = new WorldRegistry();
    const group = new THREE.Group();
    const placed = set.register({ ctx, registry: reg, object: group, group });
    expect(placed.map((p) => [p.model, p.copies, p.drawnAs])).toEqual([[yurt.id, 1, 'merged'], [barrel.id, 1, 'merged'], [kazan.id, 1, 'instanced'], [firewood.id, 2, 'instanced']]);
    // the yurt collides as its felt wall and roof (the ghosts stay data), the barrel and the kazan as a box, the pile once
    expect(reg.pieces.map((p) => [p.id, p.colliders?.map((c) => `${c.kind}:${c.surface ?? p.surface ?? '-'}`)])).toEqual([
      [yurt.id, ['hull:felt', 'hull:felt']], [barrel.id, ['box:wood']], [kazan.id, ['box:wood']], [firewood.id, ['box:wood']],
    ]);
    expect(reg.models().find((m) => m.id === yurt.id)?.variants?.map((v) => v.id)).toEqual(['lattice', 'reed', 'felt']);
    const s = placeSet({ id: 'nalati-grasslands/spring-camp', name: 'Spring camp', file: 'src/shards/nalati-grasslands/world/NomadCamp.ts', members: placed, registry: reg });
    expect(s.members.map((m) => m.model)).toEqual([yurt.id, barrel.id, kazan.id, firewood.id]);
  });

  it('the corral is one model: a box per rail span, the gate gap open', () => {
    const kit = new PaintKit(1);
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    const made = set.paint(corral, { x: 0, y: 0, z: 0, yaw: 0 }, { r: 9, posts: 26 });
    expect(made.boxes?.length).toBe(24); // 26 spans, the two either side of the gate left open
  });

  it('the camps are on the contract (check-models rule 6)', () => {
    expect(ON_CONTRACT).toEqual(expect.arrayContaining(['src/shards/nalati-grasslands/world/NomadCamp.ts', 'src/shards/nalati-grasslands/world/SummerCamp.ts']));
  });
});

describe('the roads (E306 / E315 second pass)', () => {
  it('a fence run stands at its first point; its points are relative, and it paints what addFence painted', () => {
    const pts: [number, number][] = [[5.8, 244], [5.6, 232], [6.0, 221]];
    const old = new PaintKit(0x70ad), boxes: Box[] = [];
    addFence(old, ground, pts, boxes);
    const want = old.finishTextured({ ground }, 'rock');
    const kit = new PaintKit(0x70ad);
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    const r = fenceRun(pts);
    expect(r.at).toEqual({ x: 5.8, z: 244 });
    const made = set.paint(fence, { x: r.at.x, y: ground(r.at.x, r.at.z), z: r.at.z, yaw: 0 }, r.params);
    expect(made.boxes).toEqual(boxes); // one box per straight segment, the same floats
    const got = kit.finishTextured({ ground }, 'rock');
    expect(Array.from(got?.getAttribute('position').array ?? [])).toEqual(Array.from(want?.getAttribute('position').array ?? []));
  });

  it('a signpost hangs its boards where the lettering expects them, and collides as its post', () => {
    const kit = new PaintKit(3);
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    const boards = [{ text: 'NOMAD CAMP', dir: 0 }, { text: 'KUNES BRIDGE', dir: Math.PI }];
    const made = set.paint(signpost, { x: 2, y: ground(2, 3), z: 3, yaw: 0 }, { boards });
    expect(made.boxes?.length).toBe(1);
    const spots = boardSpots(2, 3, ground(2, 3), boards);
    expect(spots.map((s) => Math.round(s.p.z * 100) / 100)).toEqual([3.78, 2.23]); // 0.775 m out from the post, either way
  });

  it('the roads are on the contract, and NalatiPOIs registers nothing by hand', () => {
    expect(ON_CONTRACT).toEqual(expect.arrayContaining(['src/shards/nalati-grasslands/world/RoadFurniture.ts', 'src/shards/nalati-grasslands/world/index.ts']));
  });
});

describe('the dressing (E306 / E315 second pass)', () => {
  it('a prop painted into a kit of its own (`into`) is still one model: its copies and colliders summed over the kits', () => {
    const set = new NalatiSet(null, { ground, flutter: new Flutter(), smoke: new Smoke() });
    const rng = new Rng(0x0d7e);
    const a = new PaintKit(rng.int(1, 1e6)), b = new PaintKit(rng.int(1, 1e6));
    set.into(a).paint(stump, { x: 1, y: ground(1, 1), z: 1, yaw: 0 }, { s: 0.3, rng });
    set.into(b).paint(stump, { x: 5, y: ground(5, 2), z: 2, yaw: 0 }, { s: 0.4, rng });
    expect(a.empty).toBe(false);
    expect(b.empty).toBe(false);
    const made = set.into(b).paint(fallenLog, { x: 8, y: ground(8, 0), z: 0, yaw: 0 }, { ax: 0, az: 0, bx: 4, bz: 1, r: 0.3, drift: false, rng });
    expect(made.descs?.map((d) => `${d.kind}:${d.surface ?? '-'}`)).toEqual(['capsule:wood']);
    const reg = new WorldRegistry();
    const placed = set.register({ ctx, registry: reg, object: new THREE.Group() });
    expect(placed.map((p) => [p.model, p.copies, p.drawnAs])).toEqual([[stump.id, 2, 'merged'], [fallenLog.id, 1, 'merged']]);
    expect(reg.pieces.map((p) => p.colliders?.length)).toEqual([2, 1]);
  });

  it('a scatter layer places its model drawnInto the layer: its copies counted, the big rocks\' hulls carried', () => {
    const reg = new WorldRegistry();
    const layer = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 3);
    const placed = place(boulder, [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }], {
      ctx, draw: 'instanced', registry: reg,
      drawnInto: { object: layer, boxes: Float32Array.of(-1, 0, -1, 1, 1, 1, 3, 0, -1, 5, 1, 1, 7, 0, -1, 9, 1, 1), colliders: [{ kind: 'ball', x: 4, y: 0.5, z: 0, radius: 1, surface: 'rock' }] },
      piece: { solidFloor: true },
    });
    expect([placed.copies, placed.drawnAs, placed.object]).toEqual([3, 'instanced', layer]);
    expect(reg.models().find((m) => m.id === boulder.id)).toMatchObject({ pipeline: ['hunyuan', 'code'], category: 'nature', copies: 3 });
    expect(reg.pieces[0]?.colliders).toHaveLength(1);
  });

  it('the escarpment\'s rocks and the crag rock are models: a big one collides as the hull of what it draws', () => {
    const kit = new PaintKit(0x0c7);
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    const block = set.paint(graniteOutcrop, { x: 0, y: 0, z: 0, yaw: 0.4 }, { w: 4, h: 1.5, d: 2, rough: 0.22, pitch: 0.1, roll: 0, tint: 'warm', lichen: 0.55, solid: true });
    const pebble = set.paint(roundedBoulder, { x: 3, y: 0, z: 0, yaw: 0 }, { r: 0.6, look: 'bank', coolOdds: 0.5, solid: false });
    expect([block.descs?.map((d) => d.kind), pebble.descs]).toEqual([['hull'], []]);
    // the crag pieces draw their shape's choices from the placer's stream: the same stream, the same rock
    const a = finGeometry(new Rng(9), 10, 5, 14), b = finGeometry(new Rng(9), 10, 5, 14);
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
    expect(cragRock.variants?.map((v) => v.id)).toEqual(['fin', 'rib', 'tower']);
  });

  it('every named place is a set (M12): a POI\'s models whole, and the copies of the others standing in its radius', async () => {
    const reg = new WorldRegistry();
    const layer = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
    const camp = NALATI_PLACES.find((p) => p.id === 'nomad-camp');
    expect(camp).toBeDefined();
    const cx = camp?.x ?? 0, cz = camp?.z ?? 0;
    // one boulder in the camp, one far away
    const rocks = place(boulder, [{ x: cx + 5, y: 0, z: cz }, { x: cx + 200, y: 0, z: cz }], {
      ctx, draw: 'instanced', registry: reg, drawnInto: { object: layer, boxes: Float32Array.of(cx + 4, 0, cz - 1, cx + 6, 1, cz + 1, cx + 199, 0, cz - 1, cx + 201, 1, cz + 1) },
    });
    const kit = new PaintKit(1);
    const set = new NalatiSet(kit, { ground, flutter: new Flutter(), smoke: new Smoke() });
    set.paint(barrel, { x: cx, y: 0, z: cz, yaw: 0 }, { s: 1 });
    const campPlaced = set.register({ ctx, registry: reg, object: new THREE.Group() });
    const n = await registerNalatiPlaces({ registry: reg, pois: new Map([['camp', campPlaced]]), others: [rocks], yieldTask: () => Promise.resolve() });
    expect(n).toBeGreaterThanOrEqual(1);
    const s = reg.sets.find((x) => x.place === 'nalati-grasslands/nomad-camp');
    expect(s?.id).toBe('nalati-grasslands/spring-camp');
    expect(s?.members).toEqual([{ model: barrel.id, copies: 1 }, { model: boulder.id, copies: 1 }]);
    expect(PLACE_SETS.map((r) => r.place).sort()).toEqual(NALATI_PLACES.map((p) => `nalati-grasslands/${p.id}`).sort());
  });

  it('the dressing is on the contract', () => {
    expect(ON_CONTRACT).toEqual(expect.arrayContaining(['src/shards/nalati-grasslands/world/dressing/index.ts', 'src/shards/nalati-grasslands/world/dressing/statics.ts']));
  });
});
