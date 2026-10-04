/**
 * Wreck — Wreck Cove's wreck site (Driftwood Isle, remaster M2 / D6; E306 / E315 M1, second pass: the vessel is the
 * shipwreck model, src/shards/driftwood-isle/models/shipwreck.ts; this is the world side). The two-master lies heeled
 * on the reef; around it the cove's beach carries driftwood piles (drift logs, a net draped over one), stray barrels,
 * crates and rope coils, reef rocks with mossy tops in the water, planks in the shallows and a spar leaning on the hull.
 *
 * It builds the vessel with the shipwreck's builder and adds the surroundings to the same kit (one mesh: the AO and the
 * hold's lantern light fall over all of it, as always), the reef rocks as their own smooth mesh, the lantern flames as
 * one unlit draw. Then it places the Wreck cove's models `drawnInto` what it drew: the shipwreck (piece `wreck`: every
 * collider of the site, in their old order, and the walkable floors), the barrel, the crate and the rope coil (the
 * hold's and the beach's), the drift log and the reef rock — each card counts its copies here, VIEW IN WORLD lands on a
 * real one; `placed` joins the cove's rocks in the Wreck cove set (src/shards/driftwood-isle/world/Cove.ts).
 *
 *   const wreck = new Wreck(sky, WRECK).place(registry);   // the game: piece `wreck` + the models' cards; add wreck.group to the scene
 *   const wreck = new Wreck(sky, WRECK).build();           // a dev page / the navmesh bake: not registered
 *   scene.add(wreck.group); its registry piece.push(...wreck.colliders);
 *   player.platforms.push((x, z) => wreck.floorHeightAt(x, z));   // hold floor, ramp, stair, bow deck, quarterdeck
 *
 * `anchors`, `holdBounds` and the frames: see the model.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { log, plank, rock, rope } from '@wildshard/engine/world/geometryKit';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';
import { rockGeometry, rockMaterial, REEF_ROCK } from './rockKit';
import { addDriftLog, DRIFT } from './driftLogs';
import { ShipwreckBuilder, shipwreck, WRECK_COLOURS as C, type CargoCopy, type WreckAnchor, type HoldBounds, type WreckSpec, type WreckAround } from '../models/shipwreck';
import { barrel as barrelModel, crate as crateModel, ropeCoil, cargoBox, addBarrel, addCoil, addCrate } from '../models/cargo';
import { driftLog, driftLogBox } from '../models/driftLog';
import { reefRock } from '../models/reefRock';


export class Wreck {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  glow!: THREE.Mesh;
  colliders: Collider[] = [];
  anchors: Record<string, WreckAnchor> = {};
  holdBounds: HoldBounds = { x: 0, z: 0, r: 0, yMin: 0, yMax: 0 };
  /** the Wreck cove's models as placed here (the set's members) */
  readonly placed: Placed[] = [];
  private readonly ship: ShipwreckBuilder;
  /** what the surroundings added: the strays (after the hold's cargo), the pile logs, the reef rocks */
  private readonly strays: CargoCopy[] = [];
  private readonly logs: { a: THREE.Vector3; b: THREE.Vector3; r: number; tone: number }[] = [];
  private readonly rocks: { m: THREE.Matrix4; r: number; moss: number; box: THREE.Box3 }[] = [];

  constructor(private sky: Sky, spec: WreckSpec) { this.ship = new ShipwreckBuilder(spec, heightAt); }

  /** the game's: built, then its models placed and registered (piece `wreck` and the cards); add `group` to the scene */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's / the navmesh bake's: the same site, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const ship = this.ship, logs = this.logs, rocks = this.rocks;
    const { geometry, glow } = ship.build((at: WreckAround) => this.around(at));
    this.mesh = new THREE.Mesh(geometry, lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = swayDepthMaterial();   // the torn sail's shadow flutters with it (M5)
    this.group.add(this.mesh);
    this.glow = new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.glow.name = 'wreck-lanterns';
    this.group.add(this.glow);
    this.colliders = ship.colliders;
    this.anchors = ship.anchors;
    this.holdBounds = ship.holdBounds;

    // ── the Wreck cove's models, drawn into the site's meshes ──
    const ctx = modelContext(this.sky), s = ship.spec, box = new THREE.Box3();
    const into = (boxes: number[], colliders?: ColliderDesc[]): { object: THREE.Object3D; boxes: Float32Array; colliders?: ColliderDesc[] } =>
      ({ object: this.group, boxes: Float32Array.from(boxes), ...(colliders ? { colliders } : {}) });
    const push = (b: THREE.Box3, out: number[]): void => { out.push(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z); };
    // the vessel: the site's every collider (the hold's stacks, the piles', the strays', the rocks', the hull's, the floors), as they always were
    const shipBox: number[] = [];
    push(ship.shipBox(box), shipBox);
    this.placed.push(place(shipwreck, [{ x: s.x, y: ship.floorY, z: s.z, yaw: s.heading, params: { site: s, ground: heightAt } }], { ctx, draw: 'merged', registry,
      drawnInto: into(shipBox, this.colliderDescs()), piece: { id: 'wreck', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } }));
    // the cargo: the hold's, then the beach's
    const cargo = [...ship.cargo, ...this.strays];
    const cargoOf = <P extends object>(kinds: readonly CargoCopy['kind'][], pl: (c: CargoCopy) => Placement<P>): { pls: Placement<P>[]; boxes: number[] } => {
      const pls: Placement<P>[] = [], boxes: number[] = [];
      for (const c of cargo) {
        if (!kinds.includes(c.kind)) continue;
        pls.push(pl(c));
        push(box.copy(cargoBox(c.kind, c.size)).applyMatrix4(c.matrix), boxes);
      }
      return { pls, boxes };
    };
    const at = (c: CargoCopy): { x: number; y: number; z: number; matrix: THREE.Matrix4 } => { const p = new THREE.Vector3().setFromMatrixPosition(c.matrix); return { x: p.x, y: p.y, z: p.z, matrix: c.matrix }; };
    const barrels = cargoOf<{ lying: boolean }>(['barrel', 'lying'], (c) => ({ ...at(c), variant: c.kind === 'lying' ? 'lying' : 'standing' }));
    const crates = cargoOf<{ size: number; broken: boolean }>(['crate', 'broken'], (c) => ({ ...at(c), params: { size: c.size, broken: c.kind === 'broken' } }));
    const coils = cargoOf<{ r: number }>(['coil'], (c) => ({ ...at(c), params: { r: c.size } }));
    this.placed.push(place(barrelModel, barrels.pls, { ctx, draw: 'merged', registry, drawnInto: into(barrels.boxes), piece: { id: 'wreck-barrels' } }));
    this.placed.push(place(crateModel, crates.pls, { ctx, draw: 'merged', registry, drawnInto: into(crates.boxes), piece: { id: 'wreck-crates' } }));
    this.placed.push(place(ropeCoil, coils.pls, { ctx, draw: 'merged', registry, drawnInto: into(coils.boxes), piece: { id: 'wreck-coils' } }));
    // the piles' logs and the reef rocks
    const logBoxes: number[] = [];
    const logPls = logs.map((l) => {
      push(driftLogBox(l.a, l.b, l.r, box), logBoxes);
      const d = l.b.clone().sub(l.a);
      return { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2, z: (l.a.z + l.b.z) / 2, yaw: Math.atan2(-d.z, d.x), params: { len: d.length(), r0: l.r, r1: l.r * 0.7, tone: l.tone % 3 } };
    });
    this.placed.push(place(driftLog, logPls, { ctx, draw: 'merged', registry, drawnInto: into(logBoxes), piece: { id: 'wreck-drift-logs' } }));
    const rockBoxes: number[] = [];
    const rockPls = rocks.map((k) => {
      push(k.box, rockBoxes);
      const p = new THREE.Vector3().setFromMatrixPosition(k.m);
      return { x: p.x, y: p.y, z: p.z, matrix: k.m, params: { r: k.r, squash: 0.62, moss: k.moss } };
    });
    this.placed.push(place(reefRock, rockPls, { ctx, draw: 'merged', registry, drawnInto: into(rockBoxes), piece: { id: 'wreck-reef-rocks' } }));
    return this;
  }

  /** the cove's surroundings, added to the wreck's kit between the hold and the finish (their old place in the build) */
  private around(at: WreckAround): void {
    const { kit, rng, sea, colliders, cs, sn, floorY } = at;
    const site = this.ship.spec, logCopies = this.logs, reefCopies = this.rocks, strays = this.strays;
    // the strays are the cargo models too (recorded after the hold's)
    const barrel = (m: THREE.Matrix4, lying = false): void => { addBarrel(kit, m, lying); strays.push({ kind: lying ? 'lying' : 'barrel', matrix: m, size: 0 }); };
    const crate = (m: THREE.Matrix4, sz: number, broken = false): void => { addCrate(kit, m, sz, broken); strays.push({ kind: broken ? 'broken' : 'crate', matrix: m, size: sz }); };
    const coil = (m: THREE.Matrix4, r = 0.3): void => { addCoil(kit, m, r); strays.push({ kind: 'coil', matrix: m, size: r }); };
      // ── around the wreck (world space): driftwood piles on the beach, barrels, crates, a net, reef rocks, flotsam ──
      const W0 = new THREE.Matrix4();
      const wm = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 =>
        W0.clone().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
      const hw = (lx: number, lz: number): [number, number] => [site.x + lx * cs + lz * sn, site.z - lx * sn + lz * cs];
      const pile = (px: number, pz: number, n: number, spread: number, seedYaw: number): void => {
        let layer = 0;
        for (let k = 0; k < n; k++) {
          const len = rng.range(2.4, 5.2), r = rng.range(0.14, 0.32), yaw = seedYaw + (k % 2 ? 1.2 : 0) + rng.range(-0.35, 0.35);
          const ox = px + rng.range(-spread, spread), oz = pz + rng.range(-spread, spread);
          const dx = Math.cos(yaw) * len / 2, dz = Math.sin(yaw) * len / 2;
          const ya = heightAt(ox - dx, oz - dz), yb = heightAt(ox + dx, oz + dz), lift = layer * 0.28 + r * 0.8;
          const a = new THREE.Vector3(ox - dx, ya + lift + rng.range(0, 0.15), oz - dz), b = new THREE.Vector3(ox + dx, yb + lift + rng.range(0, 0.15), oz + dz);
          addDriftLog(kit, a, b, r, r * rng.range(0.6, 0.85), { sides: 7, twist: rng.range(0, 1), tone: k, wobble: 0.03 });
          logCopies.push({ a, b, r, tone: k });
          if (rng.next() < 0.45) {                                          // a snapped branch stub
            const m = a.clone().lerp(b, rng.range(0.3, 0.7));
            kit.add(log(m, m.clone().add(new THREE.Vector3(rng.range(-0.4, 0.4), rng.range(0.3, 0.6), rng.range(-0.4, 0.4))), r * 0.35, r * 0.2, 5), DRIFT.stub);
          }
          if (rng.next() < 0.3) {                                           // a rope lashed round it
            const m = a.clone().lerp(b, rng.range(0.2, 0.8)), dir = b.clone().sub(a).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            for (let j = 0; j < 3; j++) kit.add(new THREE.TorusGeometry(r + 0.03, 0.03, 3, 8), C.rope, { matrix: new THREE.Matrix4().compose(m.clone().addScaledVector(dir, (j - 1) * 0.08), q, new THREE.Vector3(1, 1, 1)) });
          }
          if (k % 2 === 1) layer++;
        }
        colliders.push({ x: px, z: pz, hw: spread + 0.9, hd: spread + 0.9, rot: 0, yTop: heightAt(px, pz) + 0.6 + layer * 0.28, yBottom: heightAt(px, pz) - 2 });
      };
      // the piles sit on the cove beach west / south-west of the hull (between the path's end and the water)
      // (hull-local x / z: +x = starboard = WSW, the beach; −z = the bow = NNW, toward the crag)
      // E354: the third pile stood on the path's last stretch (its 3.6 m box across x 133.5…137.1 at z ≈ 3.3, a 1.1 m
      // wall both ways); 2 m sternward it lies 1.4 m south of the path
      const piles: [number, number, number, number, number][] = [[9, -9, 7, 1.1, 0.4], [14, 4.5, 6, 1.0, 1.9], [16, -5.5, 5, 0.9, 1.1], [6, -13, 4, 0.8, 0.2]];
      const pileAt: [number, number][] = [];
      for (const [lx, lz, n, s, yw] of piles) { const [x, z] = hw(lx, lz); pile(x, z, n, s, yw); pileAt.push([x, z]); }
      // a net draped over the first pile, a coil and a lantern-less barrel beside it
      {
        const [px, pz] = pileAt[0] ?? [0, 0], cols = 8, rowsN = 6;
        const P = (c: number, r: number): THREE.Vector3 => {
          const x = px - 1.4 + (c / (cols - 1)) * 2.8, z = pz - 1.0 + (r / (rowsN - 1)) * 2.0;
          const cx = (c / (cols - 1)) * 2 - 1, cz = (r / (rowsN - 1)) * 2 - 1;
          return new THREE.Vector3(x, heightAt(x, z) + 0.05 + Math.max(0, 1 - cx * cx) * Math.max(0, 1 - cz * cz * 0.8) * 0.75 + 0.05, z);
        };
        for (let c = 0; c < cols; c++) for (let r = 0; r + 1 < rowsN; r++) kit.add(rope([P(c, r), P(c, r + 1)], 0.02, 3), C.net, { jitter: 0.05 });
        for (let r = 0; r < rowsN; r++) for (let c = 0; c + 1 < cols; c++) kit.add(rope([P(c, r), P(c + 1, r)], 0.02, 3), C.net, { jitter: 0.05 });
      }
      const loose: [number, number, 'barrel' | 'lying' | 'crate' | 'broken' | 'coil', number][] = [
        [10.8, -6.2, 'barrel', 0], [11.6, -5.4, 'lying', 0.8], [12.2, 2.6, 'crate', 0.4], [13.1, 1.8, 'broken', -0.3],
        [14.4, -4.6, 'coil', 0], [7.2, -10.2, 'barrel', 0], [8.8, -11.6, 'coil', 0], [17.8, -10.4, 'lying', 2.2],
      ];
      for (const [lx, lz, kind, yaw] of loose) {
        const [x, z] = hw(lx, lz), y = heightAt(x, z);
        if (kind === 'barrel') barrel(wm(x, y + 0.42, z, yaw, rng.range(-0.08, 0.08)));
        else if (kind === 'lying') barrel(wm(x, y + 0.3, z, yaw), true);
        else if (kind === 'crate') crate(wm(x, y - 0.05, z, yaw, 0.05), 0.75);
        else if (kind === 'broken') crate(wm(x, y - 0.04, z, yaw), 0.7, true);
        else coil(wm(x, y, z, yaw), 0.34);
        if (kind !== 'coil') colliders.push({ x, z, hw: 0.45, hd: 0.45, rot: -yaw, yTop: y + 0.9, yBottom: y - 1 });
      }
      // reef rocks around the hull in the water (mossy tops), a few in the shallows toward the beach
      const rocks: [number, number, number][] = [
        [-4.2, 3, 1.4], [-4.0, 6, 1.1], [-3.2, 9.4, 1.6], [0.5, 10.6, 1.3], [3.8, 8.5, 1.2], [4.4, 5.2, 0.9], [4.8, 2.5, 1.0],
        [-4.4, -1.5, 0.9], [-3.8, -6.5, 1.2], [4.3, -5.8, 0.8], [6.8, 4, 0.7], [-6.3, 7.5, 0.8], [6.2, 10.5, 1.4], [-2.0, 12.4, 1.1],
        [7.5, -3.8, 0.6], [6.2, 3.2, 0.5], [8.5, 7.0, 0.9],
      ];
      // E114: the reef rocks are rockKit rocks (smooth painted). The draws the old flat-shaded rocks took (the rock, its
      // side colour, one per face) are still burnt, so everything after the rocks is placed as it always was
      const rockRng = new Rng(SEED ^ 0x70c5), reef: THREE.BufferGeometry[] = [];
      for (const [lx, lz, r] of rocks) {
        const [x, z] = hw(lx, lz), y = heightAt(x, z);
        const old = rock(r, 1, rng, 0.62, 0.3);
        rng.next();
        const mossy = rng.next() < 0.6, m = wm(x, y + r * 0.2, z, rng.range(0, 6));
        for (let i = old.getAttribute('position').count / 3; i > 0; i--) rng.next();
        old.dispose();
        const g = rockGeometry(r, rockRng, { squash: 0.62, palette: REEF_ROCK, moss: mossy ? 0.9 : 0.5, ground: -0.2 * r });
        g.applyMatrix4(m); reef.push(g);
        g.computeBoundingBox(); reefCopies.push({ m, r, moss: mossy ? 0.9 : 0.5, box: g.boundingBox?.clone() ?? new THREE.Box3() });
        if (r > 0.9) colliders.push({ x, z, hw: r * 0.8, hd: r * 0.8, rot: 0, yTop: y + r * 0.7, yBottom: y - 2 });
      }
      if (reef.length > 0) {
        // their own smooth normals can't join the flat-shaded kit: all the rocks are one more draw
        const rm = new THREE.Mesh(mergeGeometries(reef, false), rockMaterial(this.sky));
        for (const s of reef) s.dispose();
        rm.name = 'wreck-rocks'; rm.castShadow = true; rm.receiveShadow = true;
        this.group.add(rm);
      }
      // flotsam: planks lying in the shallows by the stern, a spar leaning on the hull
      for (let k = 0; k < 6; k++) {
        const [x, z] = hw(rng.range(2, 7), rng.range(4, 13)), yaw = rng.range(0, Math.PI);
        kit.add(plank(rng.range(1.2, 2.4), rng.range(0.22, 0.3), 0.06, rng, 0.02), rng.next() < 0.5 ? C.hullGrey : C.hull, { matrix: wm(x, Math.max(heightAt(x, z) + 0.04, sea + 0.01), z, yaw, 0, rng.range(-0.1, 0.1)) });
      }
      {
        const [x0, z0] = hw(4.6, 7.2), [x1, z1] = hw(2.4, 3.2);
        kit.add(log(new THREE.Vector3(x0, heightAt(x0, z0) + 0.1, z0), new THREE.Vector3(x1, floorY + 1.6, z1), 0.16, 0.12, 6), C.mast);
      }
  }

  /** PHYSICS P4: the site's static collision in world space — the legacy boxes (the hold's stacks, the piles, the strays,
   *  the rocks, the hull walls) and every floor `floorHeightAt` describes, as real geometry (see the model). */
  colliderDescs(): ColliderDesc[] { return this.ship.colliderDescs(); }

  /** the walkable wood under (x, z): the hold floor, the stair, the breach ramp, the forecastle and the quarterdeck */
  floorHeightAt(x: number, z: number): number | undefined { return this.ship.floorHeightAt(x, z); }
}
