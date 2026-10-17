import * as v from 'valibot';
import { Color, MeshStandardMaterial, type Vector3 } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { ANIMAL_STATES } from '@wildshard/engine/entities/AnimalSim';
import { variantDef } from '@wildshard/engine/entities/species/registry';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { parsePopulationWaves } from '@wildshard/format/populationWaves';
import type { DirectorLane } from '../plugin/director';
import { PopulationWaveDirector } from './waves';

/** Ordered presentation/quest effects. They are applied by the page after its population step, without lending callbacks. */
export type PopulationPageEffect = { kind: 'voice'; name: string; at: Vector3 } | { kind: 'burst'; at: Vector3 } | { kind: 'complete' };
/** Native owner adapter for the page's AnimalManager and declared encounter table. No shard callback crosses this host. */
export class PagePopulationWaves {
  private readonly brain: PopulationWaveDirector<Animal>;
  private readonly pending: PopulationPageEffect[] = [];
  private night = 0;
  private errand = false;
  constructor(lane: DirectorLane, animals: AnimalManager, input: unknown, maximum: number) {
    const rows = parsePopulationWaves(input);
    const { rule } = rows, scripted = v.parse(v.picklist(ANIMAL_STATES), rule.state);
    const tint = new Color(rule.tint[0] ?? 1, rule.tint[1] ?? 1, rule.tint[2] ?? 1);
    const spawn = (kind: string, x: number, z: number, yaw: number): Animal => {
      const real = variantDef(kind, rule.variant).id === rule.variant;
      const actor = animals.spawn(kind, x, z, yaw, real ? rule.variant : rule.fallback[kind]);
      if (!real) {
        actor.label = rule.label;
        const material = Array.isArray(actor.mesh.material) ? actor.mesh.material[0] : actor.mesh.material;
        if (material instanceof MeshStandardMaterial) material.color.multiply(tint);
      }
      return actor;
    };
    const scope = app.levelScope, spawner = scope === null ? null : app.encounters.spawn(rule.table, scope, {
      create: (entry, point) => spawn(entry.kind, point.x, point.z, point.yaw),
      retire: actor => { animals.retire(actor); },
    });
    this.brain = new PopulationWaveDirector(lane, {
      night: () => this.night, errand: () => this.errand, onErrandDone: () => { this.pending.push({ kind: 'complete' }); },
      stream: { next: Math.random }, ground: { heightAt: terrainHeight },
      spawn: (kind, x, z, yaw) => {
        if (spawner === null) return spawn(kind, x, z, yaw);
        const actor = spawner.spawn({ kind, tags: ['night'] }, { x, z, yaw }, () => { throw new Error('Fixed population table must not consume a random draw'); })[0];
        if (actor === undefined) throw new Error('Population table returned no actor');
        return actor;
      },
      own: actor => { actor.herd = -1; actor.state = scripted; actor.scripted = true; },
      release: actor => { actor.scripted = false; if (actor.alive && actor.state === scripted) actor.state = 'alert'; },
      retire: actor => { if (spawner === null) animals.retire(actor); else spawner.retire(actor); },
      shot: (name, actor) => { this.pending.push({ kind: 'voice', name, at: actor.position.clone() }); },
      // The manager parks a retired page body below the world. Capture the burst before retirement moves it.
      burst: actor => { this.pending.push({ kind: 'burst', at: actor.position.clone() }); },
    }, { ...rows.spec, max: maximum }, rows.stages, rows.tuning);
  }
  get count(): number { return this.brain.count; }
  effects(): readonly PopulationPageEffect[] { return this.pending; }
  force(point: { x: number; y: number; z: number }, errand: boolean): void {
    this.pending.length = 0; this.errand = errand; this.brain.force(point);
  }
  advance(dt: number, point: { x: number; y: number; z: number }, night: number, errand: boolean): void {
    this.pending.length = 0; this.night = night; this.errand = errand; this.brain.advance(dt, point);
  }
}
