import { GroundTell, type GroundTellWedgeStyle } from '@wildshard/game/Elite';
import { nightSpawner } from './spawns';
import type { Spawner } from '@wildshard/engine/ai/encounters';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { balbalPiercing } from '../weapons/effects';

import * as THREE from 'three';


import type { Balbals } from '../world/Balbals';


import { BALBAL, BALBAL_SLAM, balbalCombat, onBalbalCrack } from '../species/balbal';
import { type FxRenderer, NightParticles, FLAG_GRAVITY, FLAG_BOUNCE, FLAG_GROW } from './nightFx';


/**
 * Balbal warriors — the dusk half of row B11 (project/archive/2026-09-23-nalati.md): at dusk some of the shard's balbal statues (the POI
 * agent's ring of 9 on the knoll + the kurgan crowns, `pois.balbals`) tear out of the ground and fight; at dawn the
 * survivors walk back to their plinths and sink into them, and every statue stands again.
 *
 *   const bw = new BalbalWarriors({ scene, balbals: pois.balbals, clock: weather.clock });
 *   bw.attach(animals)       // once main's AnimalManager exists (nalati.attachAnimals) — wakes them at once if it is dusk / night
 *   bw.bindKit(kit)          // the melee weapon in hand feeds the damage model (sabre breaks, spear + crack)
 *   bw.update(dt, t, camera, renderer, player)
 *   bw.wake() / bw.dawn()    // native encounter / diagnostic port
 *   bw.awake                 // the live warriors
 *
 * Who wakes: each dusk four stones of the ring (a different four each night) and one crown balbal. The species
 * (src/shards/nalati-grasslands/species/balbal.ts, `mem.field = 1`) does the rest — rise, guard, stalk, the slam, return, sink; this
 * controller hides the statue, spawns the warrior in its place (same spot, same facing, same carved variant), and draws
 * what the species can't: the soil pouring off it as it rises and walks, the dust and turf of the slam, the stone chips
 * of a hit (amber sparks off a crack), the rubble of a kill, and the SLAM telegraph — an amber wedge on the ground
 * filling toward the tip through the 1.5 s wind-up, exactly the area the blow will hit.
 */

export interface BalbalWarriorsCtx { scene: THREE.Scene; balbals: Balbals | null; clock: DayCycleClock; scope: Scope }
interface KitLike { sabre: { model: THREE.Object3D }; spear: { model: THREE.Object3D } }
interface Warrior { a: Animal; statue: number; deadT: number; sparkT: number; lastHp: number; wedge: GroundTell }

const RING = 9;
const SOIL: readonly [number, number, number] = [0.26, 0.19, 0.12], TURF: readonly [number, number, number] = [0.3, 0.36, 0.14];
const STONE: readonly [number, number, number] = [0.55, 0.53, 0.49], DUST: readonly [number, number, number] = [0.5, 0.44, 0.34];
const AMBER: readonly [number, number, number] = [2.4, 1.1, 0.25];
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** Nalati's amber fill/rim shader; GroundTell owns sector geometry and terrain draping. */
function wedgeStyle(): GroundTellWedgeStyle {
  const fill = { value: 0 }, alpha = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { uFill: fill, uAlpha: alpha, uColor: { value: new THREE.Color(2.2, 0.95, 0.2) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // the rim + the edges always; the body fills from the balbal's feet toward the tip as the wind-up runs; a crackle of noise
      fragmentShader: `varying vec2 vUv; uniform float uFill; uniform float uAlpha; uniform vec3 uColor;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float r = vUv.y, e = min(vUv.x, 1.0 - vUv.x);
          float rim = smoothstep(0.93, 1.0, r) + smoothstep(0.035, 0.0, e) * 0.8;
          float fill = smoothstep(uFill + 0.02, uFill - 0.04, r) * (0.22 + 0.25 * r);
          float front = smoothstep(0.05, 0.0, abs(r - uFill)) * 0.7;
          float n = h(floor(vUv * vec2(26.0, 14.0)));
          float a = (rim * 0.75 + fill * (0.7 + 0.3 * n) + front) * uAlpha * smoothstep(0.0, 0.12, r);
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
  mat.name = 'balbal-telegraph';
  return { cone: BALBAL_SLAM.cone, material: mat, fill, alpha };
}

export class BalbalWarriors {
  readonly awake: Warrior[] = [];
  readonly debris: NightParticles;
  /** fired when one breaks (the kill feed / achievements already get it through animals.onKill) */
  onBroken?: ((a: Animal) => void) | undefined;
  private animals: AnimalManager | null = null;
  private kit: KitLike | null = null;
  private readonly wedges: GroundTell[] = [];
  private spawner: Spawner<Animal> | null = null;
  private night = 0;
  private soilAcc = 0;

  constructor(private readonly ctx: BalbalWarriorsCtx) {
    balbalCombat.isPiercing = balbalPiercing;
    this.debris = new NightParticles(ctx.scene, 'debris');
    for (let i = 0; i < 6; i++) this.wedges.push(new GroundTell(ctx.scene, 'wedge', 0, wedgeStyle()));
    ctx.clock.onDusk(() => { this.wake(); });
    ctx.clock.onDawn(() => { this.dawn(); });
    ctx.clock.onDay(() => { this.dawn(); });
    ctx.scope.onDispose(app.debug.scopedExpose('nalati.balbals', this)); // dev / screenshots
  }

  attach(animals: AnimalManager): void {
    this.animals = animals;
    this.spawner = nightSpawner('spawn.nalati.balbals', this.ctx.scope, animals);
    animals.factory.model(BALBAL, 'warrior'); animals.factory.model(BALBAL, 'capped'); // build now, not at dusk
    const ph = this.ctx.clock.dayPhase;
    if (ph === 'dusk' || ph === 'night') this.wake();
  }

  bindKit(kit: KitLike | null): void { this.kit = kit; }

  /** statues that wake tonight: four of the ring (rotating each night) and one crown */
  private tonight(): number[] {
    const n = this.ctx.balbals?.statues.length ?? 0;
    const count = 4;
    const out: number[] = [];
    for (let k = 0; k < count; k++) out.push((this.night * 2 + k * 2 + (k >= 3 ? 1 : 0)) % Math.min(RING, n));
    if (n > RING) out.push(RING + (this.night % (n - RING)));
    return [...new Set(out)];
  }

  /** dusk: tear the chosen statues out of the ground */
  wake(which?: number[]): void {
    const b = this.ctx.balbals, animals = this.animals;
    if (b === null || animals === null) return;
    for (const i of which ?? this.tonight()) {
      if (this.awake.some((w) => w.statue === i)) continue;
      const s = b.statues[i];
      const wedge = this.wedges[this.awake.length % this.wedges.length];
      if (s === undefined || wedge === undefined) continue;
      b.setAwake(i, true);
      // the statue faces −z at yaw 0; an animal faces +z at yaw 0
      const yaw = s.yaw + Math.PI;
      const variant = s.variant === 1 ? 'capped' : 'warrior';
      const a = this.spawner?.spawn({ tags: [this.ctx.clock.dayPhase, 'force', variant] }, { x: s.x, z: s.z, yaw }, () => app.rng.stream('ai').next())[0];
      if (a === undefined) continue;
      a.herd = -1;
      const m = a.mem;
      m['field'] = 1; m['homeX'] = s.x; m['homeZ'] = s.z; m['homeYaw'] = yaw; m['rise'] = 0;
      a.yOffset = -2.5 * a.scale;
      this.awake.push({ a, statue: i, deadT: 0, sparkT: 0, lastHp: a.hp, wedge });
      // the ground splits: a first spray of turf and soil
      _v.set(s.x, heightAt(s.x, s.z) + 0.1, s.z);
      this.debris.burst(_v, 26, 2.2, 3.5, 1.6, 0.16, TURF, 0.25, FLAG_GRAVITY | FLAG_BOUNCE, 0.6);
      this.debris.burst(_v, 10, 1.2, 0.8, 2.2, 0.9, DUST, 0.15, FLAG_GROW, 0.5);
    }
    this.night++;
  }

  /** dawn: send every warrior home (the species walks back and sinks); a broken one's statue stands again */
  dawn(): void {
    for (const w of this.awake) if (w.a.alive) w.a.mem['dawn'] = 1;
    const b = this.ctx.balbals;
    if (b !== null) for (const w of this.awake) if (!w.a.alive && w.a.hidden) b.setAwake(w.statue, false);
  }

  update(dt: number, _t: number, camera: THREE.PerspectiveCamera, renderer: FxRenderer, light: number): void {
    const k = this.kit;
    if (k !== null) {
      const equipment = app.equipment;
      const id = equipment !== null && equipment.visible && !equipment.stowed ? equipment.current.row.id : undefined;
      balbalCombat.melee = id === 'weapon.sabre' || id === 'weapon.naizagai' ? 'sabre' : id === 'weapon.spear' ? 'spear' : 'other';
    }
    this.debris.light = Math.max(0.25, light);
    this.soilAcc += dt;
    const soilTick = this.soilAcc > 0.05; if (soilTick) this.soilAcc = 0;
    const b = this.ctx.balbals;
    for (let i = this.awake.length - 1; i >= 0; i--) {
      const w = this.awake[i];
      if (w === undefined) continue;
      const a = w.a, m = a.mem, sc = a.scale;
      // ── hits: stone chips (or amber sparks off a crack) where it was struck ──
      if (a.hp < w.lastHp) {
        _v.set(a.position.x, a.position.y + 1.2 * sc, a.position.z);
        const crack = onBalbalCrack(a, _v);
        this.debris.burst(_v, crack ? 6 : 14, 2.6, 2.2, 0.9, 0.07, STONE, 0.2, FLAG_GRAVITY | FLAG_BOUNCE, 0.35);
        if (crack || w.a.hp < w.lastHp - 40) this.debris.burst(_v, 12, 3, 2.5, 0.5, 0.05, AMBER, 0.2, FLAG_GRAVITY, 0.3);
        w.lastHp = a.hp;
      }
      // ── dead: rubble as it crumbles, then gone (the statue returns at dawn) ──
      if (!a.alive) {
        w.wedge.hide();
        if (w.deadT === 0) {
          _v.set(a.position.x, a.position.y + sc, a.position.z);
          this.debris.burst(_v, 46, 3.2, 3, 1.8, 0.12, STONE, 0.25, FLAG_GRAVITY | FLAG_BOUNCE, 0.6);
          this.debris.burst(_v, 14, 1.5, 0.6, 2.4, 1.0, DUST, 0.15, FLAG_GROW, 0.7);
          this.onBroken?.(a);
        }
        w.deadT += dt;
        if (w.deadT > 3.2) { this.retire(a); this.awake.splice(i, 1); }
        continue;
      }
      // ── home again at dawn and under the ground: the statue stands ──
      if (m['gone'] === 1) { this.retire(a); b?.setAwake(w.statue, false); this.awake.splice(i, 1); continue; }
      const rise = m['rise'] ?? 1;
      const moving = rise > 0 && rise < 1;
      // ── soil: pouring off it while it moves through the ground, a few clods from the body as it walks ──
      if (soilTick) {
        if (moving) {
          for (let n = 0; n < 3; n++) {
            const ang = app.rng.stream('cosmetic').next() * Math.PI * 2, r = (0.45 + app.rng.stream('cosmetic').next() * 0.35) * sc;
            const x = a.position.x + Math.cos(ang) * r, z = a.position.z + Math.sin(ang) * r;
            this.debris.emit(x, heightAt(x, z) + 0.05, z, Math.cos(ang) * 1.2, 2.2 + app.rng.stream('cosmetic').next() * 2.5, Math.sin(ang) * 1.2, 1.4, 0.08 + app.rng.stream('cosmetic').next() * 0.1,
              SOIL[0], SOIL[1], SOIL[2], FLAG_GRAVITY | FLAG_BOUNCE);
          }
          if (app.rng.stream('cosmetic').next() < 0.35) { _v.set(a.position.x, heightAt(a.position.x, a.position.z) + 0.1, a.position.z); this.debris.burst(_v, 1, 0.6, 0.4, 2.2, 0.8, DUST, 0.15, FLAG_GROW, 0.6); }
        } else if (rise >= 1 && app.rng.stream('cosmetic').next() < 0.18) {
          const ang = app.rng.stream('cosmetic').next() * Math.PI * 2;
          const x = a.position.x + Math.cos(ang) * 0.3 * sc, z = a.position.z + Math.sin(ang) * 0.3 * sc;
          this.debris.emit(x, a.position.y + (0.3 + app.rng.stream('cosmetic').next() * 1.3) * sc, z, Math.cos(ang) * 0.4, 0, Math.sin(ang) * 0.4, 1.3, 0.05 + app.rng.stream('cosmetic').next() * 0.06,
            SOIL[0], SOIL[1], SOIL[2], FLAG_GRAVITY | FLAG_BOUNCE);
        }
      }
      // ── the slam: the telegraph wedge through the wind-up, turf + dust on the blow ──
      const p = a.attackPhase;
      const reach = BALBAL_SLAM.reach * sc / 1.18;
      if (p >= 0) {
        const wind = BALBAL_SLAM.windup / 2.9, strike = BALBAL_SLAM.strike / 2.9;
        if (p < strike + 0.08) w.wedge.wedge(a.position.x, a.position.z, a.yaw, reach, Math.min(1, p / wind), p < strike ? 0.6 + 0.4 * (p / wind) : 1.4);
        else w.wedge.hide();
        if (m['slamT'] === 1) {
          m['slamT'] = 2;
          _v.set(a.position.x + Math.sin(a.yaw) * reach * 0.75, 0, a.position.z + Math.cos(a.yaw) * reach * 0.75);
          _v.y = heightAt(_v.x, _v.z) + 0.1;
          this.debris.burst(_v, 30, 3.5, 4.5, 1.5, 0.12, TURF, 0.25, FLAG_GRAVITY | FLAG_BOUNCE, 0.5);
          this.debris.burst(_v, 18, 2.6, 3.5, 1.4, 0.1, SOIL, 0.25, FLAG_GRAVITY | FLAG_BOUNCE, 0.4);
          _w.copy(_v); _w.y += 0.2;
          this.debris.burst(_w, 12, 3.2, 0.3, 1.8, 1.1, DUST, 0.12, FLAG_GROW, 0.6);
          this.debris.burst(_w, 10, 3.5, 2.5, 0.6, 0.05, AMBER, 0.2, FLAG_GRAVITY, 0.4);
        }
      } else w.wedge.hide();
    }
    this.debris.update(dt, renderer, camera);
  }

  /** out of the world: hidden, out of the animals list (the minimap, the harvest prompt, the aim assist) */
  private retire(a: Animal): void {
    this.spawner?.retire(a);
  }
}
