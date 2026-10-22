import * as THREE from 'three';
import * as v from 'valibot';
import { PopulationProjectionSchema, type PopulationProjectionRows } from '@wildshard/format/populationProjection';
import { PageActorGroups } from './pageGroups';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { Rng } from '@wildshard/engine/core/rng';
import { SEED } from '@wildshard/engine/core/config';
import { TIER } from '@wildshard/engine/core/tier';
import { worldTime } from '@wildshard/engine/core/time';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { ParticlePool } from '@wildshard/engine/fx/ParticlePool';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { RowBodySlots } from '@wildshard/engine/physics/bodies';

/** Client-only row projection of an existing population manager. Decisions stay
 * species-owned; this owns only declared placements, volley bodies and drawing. */
export class PopulationProjection {
  readonly group = new THREE.Group();
  readonly placed: Record<string, number> = {};
  private readonly rows: PopulationProjectionRows;
  private readonly creatures: PageActorGroups;
  private readonly rng: Rng;
  private readonly volley: RowBodySlots<Animal>;
  private readonly mesh: THREE.InstancedMesh;
  private readonly drops: ParticlePool;
  private readonly lights: { actor: Animal; light: THREE.PointLight; dead: boolean; fade: number }[] = [];
  private readonly observers: { row: PopulationProjectionRows['effects'][number]; actor: Animal | null; state: number; elapsed: number }[];
  private active = 0;
  private disposed = false;
  private readonly at = new THREE.Vector3(); private readonly head = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4(); private readonly scale = new THREE.Vector3(1, 1, 1);
  constructor(private readonly animals: AnimalManager, private readonly scene: THREE.Scene, sky: SkyRig, private readonly scope: Scope, input: unknown) {
    this.rows = v.parse(PopulationProjectionSchema, input); const row = this.rows;
    if (row.seed !== SEED) throw new Error('Population projection requires its authored seed');
    this.creatures = new PageActorGroups(animals, row.practice, scope); this.rng = new Rng(row.random);
    this.volley = new RowBodySlots(row.volley, app.bodies, { kind: row.id });
    const geometry = scope.own(new THREE.IcosahedronGeometry(row.volley.body.radius, row.husk.detail)), colour = new THREE.Color(row.husk.colour).toArray();
    geometry.setAttribute('color', new THREE.BufferAttribute(Float32Array.from({ length: geometry.getAttribute('position').count * 3 }, (_, i) => colour[i % 3] ?? 0), 3));
    this.mesh = scope.own(new THREE.InstancedMesh(geometry, lowPolyLookMaterial(sky, 'still'), row.volley.count));
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    for (let i = 0; i < row.volley.count; i++) this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.mesh);
    const map = scope.own(dropTexture()), material = scope.own(new THREE.PointsMaterial({ color: new THREE.Color(...row.splash.colour), size: row.splash.size,
      sizeAttenuation: true, transparent: true, opacity: row.splash.opacity, depthWrite: false, map, alphaTest: .3 }));
    this.drops = new ParticlePool({ capacity: row.splash.capacity, material, renderOrder: 5, attributes: {}, parkY: -1000 });
    scope.own(this.drops.points.geometry); this.group.add(this.drops.points);
    this.observers = row.effects.map(effect => ({ row: effect, actor: null, state: 0, elapsed: 0 }));
    scope.onDisposeSteps(() => this.disposeSteps());
  }
  get practice(): Animal | null { return this.creatures.practice; }
  async build(): Promise<this> {
    const row = this.rows, placement = row.page[TIER], habitat = this.animals.habitat;
    const before = { throwCoconut: habitat.throwCoconut, splash: habitat.splash, hold: habitat.hold, perches: habitat.perches, perchBases: habitat.perchBases };
    if (placement.perches.length > 0) {
      habitat.perches = placement.perches.map(site => new THREE.Vector3(...site.crown));
      habitat.perchBases = placement.perches.map(site => new THREE.Vector3(...site.base));
    }
    const launch = (from: THREE.Vector3, to: THREE.Vector3, actor: Animal | null): void => { this.volley.bind(app.bodies); this.volley.throw(row.launch, from, to, actor, this.rng); };
    const splash = (at: THREE.Vector3, strength = 1): void => { this.splash(at, strength); };
    habitat.throwCoconut = launch; habitat.splash = splash;
    const hold = row.hold, side = Math.round(2 * hold.guardR / hold.step) + 1;
    if (hold.floor.length !== side * side) throw new Error('Invalid population hold floor');
    const ownedHold = { x: hold.x, z: hold.z, r: hold.r, guardR: hold.guardR, floorAt: (x: number, z: number): number | undefined => {
      const ix = Math.round((x - hold.x + hold.guardR) / hold.step), iz = Math.round((z - hold.z + hold.guardR) / hold.step);
      return ix < 0 || iz < 0 || ix >= side || iz >= side ? undefined : hold.floor[iz * side + ix] ?? undefined;
    } };
    habitat.hold = ownedHold;
    this.scope.onDispose(() => {
      if (habitat.throwCoconut === launch) { if (before.throwCoconut === undefined) delete habitat.throwCoconut; else habitat.throwCoconut = before.throwCoconut; }
      if (habitat.splash === splash) { if (before.splash === undefined) delete habitat.splash; else habitat.splash = before.splash; }
      if (habitat.hold === ownedHold) { if (before.hold === undefined) delete habitat.hold; else habitat.hold = before.hold; }
      { if (before.perches === undefined) delete habitat.perches; else habitat.perches = before.perches; } { if (before.perchBases === undefined) delete habitat.perchBases; else habitat.perchBases = before.perchBases; }
    });
    await this.scope.run(() => this.animals.factory.prepareModels(placement.enemies));
    if (this.disposed) throw new Error('Population projection left during preparation');
    this.scope.run(() => {
      this.rng.restore(placement.stream); this.creatures.place(placement.centres, placement.kinds, placement.enemies);
      for (const spot of placement.enemies.filter(entry => entry.herd < 0 && entry.kind === hold.kind)) {
        const actor = this.creatures.loose(spot), light = new THREE.PointLight(row.light.colour, 0, row.light.distance, row.light.decay);
        light.castShadow = false; this.group.add(light); this.lights.push({ actor, light, dead: false, fade: 0 });
      }
      this.counts(); this.scene.add(this.group);
    });
    return this;
  }
  private counts(): void {
    for (const [id, row] of Object.entries(this.rows.counts)) this.placed[id] = this.creatures.count(row.kind, row.groups) - Number(row.practice && this.practice !== null);
  }
  splash(at: THREE.Vector3, strength = 1): void {
    const row = this.rows.splash, n = Math.round(row.count * strength), rng = app.rng.stream('cosmetic');
    const { pos, vel, life } = this.drops;
    for (let i = 0; i < n; i++) {
      const k = this.drops.claim(), angle = rng.next() * Math.PI * 2, radius = rng.next() * row.radius;
      pos[k * 3] = at.x + Math.cos(angle) * radius; pos[k * 3 + 1] = at.y + row.height[0] + rng.next() * row.height[1] * strength; pos[k * 3 + 2] = at.z + Math.sin(angle) * radius;
      const speed = row.speed[0] + rng.next() * row.speed[1]; vel[k * 3] = Math.cos(angle) * speed; vel[k * 3 + 1] = row.up[0] + rng.next() * row.up[1]; vel[k * 3 + 2] = Math.sin(angle) * speed;
      life[k] = row.life[0] + rng.next() * row.life[1];
    }
    this.active = Math.min(row.capacity, this.active + n);
  }
  update(dt: number, time: number, player: THREE.Vector3): void {
    if (this.disposed) return;
    const row = this.rows, rng = app.rng.stream('cosmetic');
    this.creatures.updatePractice(dt, player); this.counts();
    for (const observation of this.observers) {
      const actor = this.animals.animals.find(a => a.kind === observation.row.kind && a.alive);
      if (actor === undefined) continue;
      if (observation.actor !== actor) { observation.actor = actor; observation.state = 0; observation.elapsed = 0; }
      const state = actor.mem[observation.row.state] ?? 0;
      if (state !== observation.state) {
        for (const action of observation.row.actions) if (action.state === state && (action.from === undefined || action.from === observation.state) && (action.fromNot === undefined || action.fromNot !== observation.state)) {
          if (action.sound !== undefined) this.animals.onSound?.(action.sound, actor.position);
          if (action.splash !== undefined) this.splash(actor.position, action.splash);
        }
        observation.state = state;
      }
      const periodic = observation.row.periodic;
      if (state === periodic.state) {
        observation.elapsed += dt;
        while (observation.elapsed >= periodic.interval) {
          observation.elapsed -= periodic.interval;
          if (rng.next() < periodic.chance) {
            const x = actor.mem[periodic.x] ?? actor.position.x, z = actor.mem[periodic.z] ?? actor.position.z;
            this.splash(this.at.set(x + rng.range(-periodic.radius, periodic.radius), terrainHeight(x, z), z + rng.range(-periodic.radius, periodic.radius)), periodic.splash);
          }
        }
      } else observation.elapsed = 0;
    }
    this.volley.bind(app.bodies);
    if (this.volley.update(dt, app.bodies?.alpha ?? 1, player)) {
      for (const [i, pose] of this.volley.poses.entries()) this.mesh.setMatrixAt(i, pose.visible ? this.matrix.compose(this.at.copy(pose.at), pose.rotation, this.scale) : this.matrix.makeScale(0, 0, 0));
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const effect of this.volley.takeEvents()) {
      this.at.copy(effect.at);
      if (effect.kind === 'contact') {
        const source = effect.source;
        if (source !== null && app.player !== null) app.combat.hit({ source: 'env', sourceTags: row.strike.tags, target: app.player,
          amount: row.strike.damage, moveId: row.strike.id, point: source.position.clone(), dir: new THREE.Vector3(), cause: { kind: source.kind, label: source.label } });
        this.animals.onSound?.(row.contact.sound, this.at);
      } else {
        if (effect.age <= row.contact.landAge) this.animals.onSound?.(row.contact.landSound, this.at);
        if (effect.wet > 0) this.splash(this.at, row.contact.splash);
      }
    }
    if (this.active > 0) {
      const step = worldTime.realDt || dt, { life, pos, vel } = this.drops; let alive = 0;
      for (let k = 0; k < row.splash.capacity; k++) {
        if ((life[k] ?? 0) <= 0) continue;
        life[k] = (life[k] ?? 0) - step;
        if ((life[k] ?? 0) <= 0) { pos[k * 3 + 1] = -1000; continue; }
        alive++; const j = k * 3; vel[j + 1] = (vel[j + 1] ?? 0) - row.splash.gravity * step;
        for (let axis = 0; axis < 3; axis++) pos[j + axis] = (pos[j + axis] ?? 0) + (vel[j + axis] ?? 0) * step;
      }
      this.active = alive; this.drops.posAttr.needsUpdate = true;
    }
    for (const light of this.lights) {
      const actor = light.actor, profile = row.light; actor.headWorld(this.head); light.light.position.copy(this.head).y += profile.headY;
      if (!actor.alive && !light.dead) { light.dead = true; light.fade = 1; this.splash(actor.position, profile.deathSplash); }
      if (light.dead) { light.fade = Math.max(0, light.fade - dt * profile.fade); light.light.intensity = profile.intensity * light.fade; continue; }
      const rise = THREE.MathUtils.clamp(actor.mem[profile.rise] ?? 0, 0, 1), [base, gain, fast, slow, bend] = profile.flicker;
      light.light.intensity = profile.intensity * rise * (base + gain * Math.sin(time * fast + Math.sin(time * slow) * bend)) * Number(actor.position.distanceToSquared(player) < profile.range ** 2);
      if (actor.mem[profile.rising] && rng.next() < dt * profile.streamRate) {
        this.at.copy(actor.position).y += profile.streamHeight[0] + rng.next() * profile.streamHeight[1] * rise; this.splash(this.at, profile.streamSplash);
      }
    }
  }
  dispose(): void { const steps = this.disposeSteps(); while (steps.next().done !== true) { /* whole */ } }
  /** G598: the projection's creatures retired one a step in a sliced retirement (Driftwood's population held one 14 ms step) */
  *disposeSteps(): Generator<undefined, void> {
    if (this.disposed) return;
    this.disposed = true; this.volley.dispose();
    yield* this.creatures.disposeSteps();
    this.group.removeFromParent();
  }
}
function dropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Population splash requires its canvas');
  const gradient = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.6, 'rgba(255,255,255,.85)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(canvas);
}
