/** Client-only presentation of encounter rows: wake encounter effects on the existing boss bar and event bus, and a
 * slot encounter's cues and telegraph on the cue director and ground tells. No shard renderer callback is accepted. */
import * as THREE from 'three';
import * as v from 'valibot';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import type { Events } from '@wildshard/engine/events/events';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { CueDirector } from '../audio/cueDirector';
import { GroundTell } from '../Elite';
import type { ReturnProgram } from '../population/returnProgram';
import { EncounterSlots, type EncounterSlotSite, type PatrolActorRoster, type SlotActor } from './encounterPatrol';
import type { WakeBossEncounter } from './wake';

/** Apply the value machine's ordered effects once, on the caller's UI clock. */
export function presentWakeBoss(encounter: WakeBossEncounter, bar: BossBar, events: Events): void {
  for (const effect of encounter.takeEffects()) {
    if (effect.kind === 'outcome') events.emit('boss.attempt', { boss: encounter.row.id, level: encounter.row.level, outcome: effect.outcome });
    else if (effect.kind === 'hide') bar.hideBar();
    else {
      if (effect.visible && !bar.barShown) bar.showBar(encounter.row.name, encounter.row.presentation.cuts);
      else if (!effect.visible) bar.hideBar();
      bar.setHp(effect.hp);
    }
  }
}

const finite = v.pipe(v.number(), v.finite()), cue = v.pipe(v.string(), v.regex(/^cue\.[a-zA-Z0-9.-]+$/u)), name = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u));
const shader = v.pipe(v.string(), v.maxLength(4096));
/**
 * What a slot encounter shows (the cycle's `wake` / `dawn` flags spawn into and release the sites): `cues` at a site as an
 * actor wakes, on a hit (`weak` where the guest finds a weak point, `hard` past `drop` hp), on the member's `broken` flag
 * and as the actor's `strike` memory field turns 1 (then 2), `ahead` × the tell's reach in front; `trails` every `every` s
 * while a memory field is in [min, max), with `chance`; `lift` raises each point (the body's × the actor's scale). The
 * `tell` wedge (its own shaders: uniforms uFill, uAlpha, uColor) fills through the attack's `wind` and shows until
 * `strike` + `hold`, alpha `alpha[0] + alpha[1] × fill`, then `alpha[2]` on the blow.
 */
export const SlotViewSchema = v.strictObject({
  cycle: v.strictObject({ wake: name, dawn: name }), states: v.strictObject({ broken: name, retire: name, home: name }),
  cues: v.strictObject({ wake: cue, hit: cue, weak: cue, hard: v.strictObject({ cue, drop: finite }), broken: cue, strike: cue }),
  lift: v.strictObject({ wake: finite, hit: finite, broken: finite, strike: finite }), strike: v.strictObject({ field: name, ahead: finite }),
  every: v.pipe(finite, v.minValue(0.01)),
  trails: v.pipe(v.array(v.strictObject({ cue, field: name, min: finite, max: finite, chance: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    at: v.picklist(['ground', 'body']), lift: finite })), v.maxLength(8)),
  tell: v.strictObject({ pool: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)), cone: finite, reach: finite, wind: finite, strike: finite, hold: finite,
    alpha: v.tuple([finite, finite, finite]), colour: v.tuple([finite, finite, finite]), vertexShader: shader, fragmentShader: shader }),
});
/** A slot actor as drawn: where it stands and faces, its health and its attack's phase (−1 between attacks). */
export interface SlotViewActor extends SlotActor { readonly position: { readonly x: number; readonly y: number; readonly z: number }; readonly yaw: number; readonly hp: number; readonly attackPhase: number }
/** A site whose actor woke (`awake` 1: hide it) or is home again (0: stand it back up), for the caller's own sites. */
export interface SlotSiteChange { readonly index: number; readonly awake: number }
interface Awake<A> { readonly a: A; readonly site: number; lastHp: number; readonly wedge: GroundTell }
const point = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/** A slot encounter on its sites, drawn from rows: the roster's law stays in `EncounterSlots`, the look in cue rows; the
 * sites' own show and hide is the caller's, from the changes `update` returns. */
export class SlotEncounterView<A extends SlotViewActor = Animal> {
  readonly slots: EncounterSlots<A>;
  readonly awake: Awake<A>[] = [];
  private readonly changes: SlotSiteChange[] = [];
  private readonly rows: v.InferOutput<typeof SlotViewSchema>;
  private readonly wedges: GroundTell[] = [];
  private trailT = 0;
  constructor(slots: unknown, view: unknown, program: ReturnProgram, private readonly ports: { readonly scene: THREE.Scene; readonly cues: CueDirector;
    readonly sites: readonly EncounterSlotSite[] | null; readonly guest: { readonly weakPoint: (actor: A, at: THREE.Vector3) => boolean } }) {
    this.slots = new EncounterSlots<A>(slots, program); this.rows = v.parse(SlotViewSchema, view);
    const tell = this.rows.tell;
    for (let i = 0; i < tell.pool; i++) {
      const fill = { value: 0 }, alpha = { value: 0 };
      const material = new THREE.ShaderMaterial({ vertexShader: tell.vertexShader, fragmentShader: tell.fragmentShader,
        uniforms: { uFill: fill, uAlpha: alpha, uColor: { value: new THREE.Color(...tell.colour) } }, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      this.wedges.push(new GroundTell(ports.scene, 'wedge', 0, { cone: tell.cone, material, fill, alpha }));
    }
  }
  attachActors(roster: PatrolActorRoster<A>): void { this.slots.attachActors(roster); }
  /** Wake the chosen sites (the cycle's own choice when `which` is omitted); the changes until the next `update`. */
  wake(which?: readonly number[]): readonly SlotSiteChange[] {
    const sites = this.ports.sites; if (sites === null) return this.changes;
    for (const { a, index } of this.slots.spawnActors(sites, which)) {
      const site = sites[index], wedge = this.wedges[this.awake.length % this.wedges.length];
      if (site === undefined || wedge === undefined) continue;
      this.changes.push({ index, awake: 1 }); this.awake.push({ a, site: index, lastHp: a.hp, wedge });
      this.ports.cues.cue(this.rows.cues.wake, point.set(site.x, heightAt(site.x, site.z) + this.rows.lift.wake, site.z), UP);
    }
    return this.changes;
  }
  /** Send every actor home; a site whose actor is already gone stands again. */
  dawn(): readonly SlotSiteChange[] { for (const index of this.slots.dawnActors()) this.changes.push({ index, awake: 0 }); return this.changes; }
  /** Step the roster and draw it; the sites to hide or show since the last call. */
  update(dt: number, frame: Readonly<Record<string, number>>): readonly SlotSiteChange[] {
    this.changes.length = 0;
    const rows = this.rows, cues = this.ports.cues, step = this.slots.updateActors(dt, frame);
    if (step.cycle[rows.cycle.wake] === 1) this.wake();
    if (step.cycle[rows.cycle.dawn] === 1) this.dawn();
    for (const row of step.released) { const index = row['index']; if (index !== undefined) this.changes.push({ index, awake: 0 }); }
    this.trailT += dt; const trail = this.trailT > rows.every; if (trail) this.trailT = 0;
    for (let i = this.awake.length - 1; i >= 0; i--) {
      const w = this.awake[i]; if (w === undefined) continue;
      const a = w.a, sc = a.scale, state = step.members.get(a.entityId) ?? {};
      if (a.hp < w.lastHp) {
        point.set(a.position.x, a.position.y + rows.lift.hit * sc, a.position.z);
        cues.cue(this.ports.guest.weakPoint(a, point) ? rows.cues.weak : a.hp < w.lastHp - rows.cues.hard.drop ? rows.cues.hard.cue : rows.cues.hit, point, UP);
        w.lastHp = a.hp;
      }
      if (!a.alive) {
        w.wedge.hide();
        if (state[rows.states.broken] === 1) cues.cue(rows.cues.broken, point.set(a.position.x, a.position.y + rows.lift.broken * sc, a.position.z), UP);
        if (state[rows.states.retire] === 1) { this.slots.retireActor(a, true); this.awake.splice(i, 1); }
        continue;
      }
      if (state[rows.states.home] === 1) { this.slots.retireActor(a, false); this.changes.push({ index: w.site, awake: 0 }); this.awake.splice(i, 1); continue; }
      if (trail) for (const row of rows.trails) {
        const value = a.mem[row.field] ?? 0;
        if (value < row.min || value >= row.max || (row.chance < 1 && app.rng.stream('cosmetic').next() >= row.chance)) continue;
        cues.cue(row.cue, point.set(a.position.x, row.at === 'ground' ? heightAt(a.position.x, a.position.z) + row.lift : a.position.y + row.lift * sc, a.position.z), UP);
      }
      const p = a.attackPhase, tell = rows.tell, reach = tell.reach * sc;
      if (p < 0) { w.wedge.hide(); continue; }
      if (p < tell.strike + tell.hold) w.wedge.wedge(a.position.x, a.position.z, a.yaw, reach, Math.min(1, p / tell.wind), p < tell.strike ? tell.alpha[0] + tell.alpha[1] * (p / tell.wind) : tell.alpha[2]);
      else w.wedge.hide();
      if (a.mem[rows.strike.field] === 1) {
        a.mem[rows.strike.field] = 2;
        point.set(a.position.x + Math.sin(a.yaw) * reach * rows.strike.ahead, 0, a.position.z + Math.cos(a.yaw) * reach * rows.strike.ahead);
        cues.cue(rows.cues.strike, point.setY(heightAt(point.x, point.z) + rows.lift.strike), UP);
      }
    }
    return this.changes;
  }
}
