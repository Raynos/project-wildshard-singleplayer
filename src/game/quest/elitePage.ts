import * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { Player } from '@wildshard/engine/player/Player';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { CameraFX } from '@wildshard/engine/player/CameraFX';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { GroundTell, type Elites, type EliteScript } from '../Elite';
import { fxMaterial, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import { SpawnScript } from '../population/spawnScript';
import { EliteDecisions } from './eliteDecisions';
import { parseEliteFeature, type EliteFeatureRows } from '@wildshard/format/eliteFeature';

/** Private bounded dome presentation; all geometry, pool and style choices come from the admitted feature rows. */
class Puffs {
  private readonly items: { mesh: THREE.Mesh; mat: FxMaterial; t: number; life: number; r0: number; r1: number; alpha: number }[] = [];
  private next = 0;
  constructor(parent: THREE.Object3D, view: NonNullable<EliteFeatureRows['view']>) {
    const pool = view.puffPool, geometry = new THREE.SphereGeometry(1, pool.segments[0], pool.segments[1]);
    for (let i = 0; i < pool.capacity; i++) {
      const mat = fxMaterial(FX.dome, new THREE.Color(...view.puffColor), 0), mesh = new THREE.Mesh(geometry, mat);
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = pool.order; parent.add(mesh);
      this.items.push({ mesh, mat, t: 0, life: 0, r0: 0.5, r1: 3, alpha: 1 });
    }
  }
  burst(at: THREE.Vector3, r0: number, r1: number, life: number, alpha: number): void {
    const item = this.items[this.next]; if (item === undefined) return;
    this.next = (this.next + 1) % this.items.length; item.mesh.position.copy(at);
    item.t = 0; item.life = life; item.r0 = r0; item.r1 = r1; item.alpha = alpha;
    item.mesh.scale.setScalar(r0); item.mesh.visible = true;
  }
  update(dt: number, t: number): void {
    for (const item of this.items) {
      if (!item.mesh.visible) continue;
      item.t += dt; const k = Math.min(1, item.t / Math.max(0.001, item.life));
      item.mesh.scale.setScalar(item.r0 + (item.r1 - item.r0) * (1 - (1 - k) * (1 - k)));
      item.mat.uniforms.uAlpha.value = item.alpha * (1 - k) * Math.min(1, item.t * 12);
      item.mat.uniforms.uTime.value = t; if (k >= 1) item.mesh.visible = false;
    }
  }
}

/** Client-only presentation over the same v1 owner as native encounters. Every authority is an existing concrete service;
 * content contributes only rows and prepared models, with no shard callback, override or reflected path. */
export function installEliteFeaturePage(game: Game, animals: AnimalManager, player: Player, sky: SkyRig, elites: Elites,
  models: ReadonlyMap<string, THREE.Object3D>, input: unknown, seed: number, hud: HUD, god = false): {
  readonly elites: Elites; readonly update: (dt: number, t: number) => void; readonly force: (id: string, move: string) => void; readonly isElite: (body: Animal) => boolean;
} {
  const rows = parseEliteFeature(input), view = rows.view;
  if (view === undefined) throw new Error('Elite page needs declared presentation');
  for (const body of animals.animals.filter(candidate => rows.fights.some(row => row.kind === candidate.kind && row.variant === candidate.variant))) {
    const variants = rows.ordinary[body.kind]; if (variants === undefined) throw new Error('Missing ordinary encounter variants');
    const herd = body.herd, { x, z } = body.position, yaw = body.yaw; animals.retire(body);
    const ordinary = animals.spawn(body.kind, x, z, yaw, variants); ordinary.herd = herd;
    const group = herd >= 0 ? animals.herds[herd] : undefined;
    if (group !== undefined) { const index = group.members.indexOf(body); if (index === -1) group.members.push(ordinary); else group.members[index] = ordinary; }
  }
  const puffs = new Puffs(game.scene, view), color = new THREE.Color(...view.tellColor);
  const controllers = rows.fights.map(row => new EliteDecisions(row, SpawnScript.page(animals, row.program, game.app.physics), rows, seed));
  const point = new THREE.Vector3(), direction = new THREE.Vector3(), tells = new Map<string, GroundTell>();
  const bodyFor = (controller: EliteDecisions): Animal | null => {
    const body = controller.animal; if (body === null) return null;
    const real = animals.animals.find(row => row === body); if (real === undefined) throw new Error('Foreign elite page body'); return real;
  };
  for (const controller of controllers) {
    for (const slot of controller.row.program.slots) for (const kind of new Set((controller.row.program.strikes ?? []).flatMap(row => row.tell === undefined ? [] : [row.tell]))) {
      tells.set(`${controller.def.id}:${slot.handle}:${kind}`, new GroundTell(game.scene, kind, color));
    }
    const script: EliteScript = { def: controller.def, get animal() { return bodyFor(controller); },
      spawn: () => { controller.spawn(); }, despawn: () => { controller.despawn(); },
      tick: (dt, t, engaged, leashing) => { controller.tick(dt, t, engaged, leashing); },
      enterPhase2: () => { controller.enterPhase2(); }, reset: () => { controller.reset(); }, trophy: () => { controller.trophy(); hud.killFeed(`${controller.def.drop.trophyName ?? 'Felled'} — ${controller.def.name}`); },
      dropModel: () => {
        const id = controller.def.drop.skin, model = id === null ? undefined : models.get(id);
        if (model === undefined) throw new Error('Missing admitted elite drop model'); const clone = model.clone(true); clone.visible = true; return clone;
      },
    };
    const scope = game.app.levelScope;
    if (scope !== null) game.app.encounters.elite(script.def.id, Object.assign(script, { force: (move: string) => { controller.force(move); } }), scope);
    elites.add(script);
  }
  return {
    elites,
    isElite: body => controllers.some(controller => controller.animal === body),
    force: (id, move) => { controllers.find(controller => controller.def.id === id)?.force(move); },
    update: (dt, t) => {
      for (const controller of controllers) controller.frame(player.position, sky.dayNight?.dusk ?? 0, sky.dayNight?.night ?? 0, god, player.yaw);
      elites.update(dt, t);
      for (const controller of controllers) {
        const program = controller.program;
        for (const effect of program.drainEffects()) {
          if (effect.kind === 'hit') {
            if (god) continue;
            const body = program.body(effect.actor), health = game.app.player;
            if (body === null || health === null) continue;
            game.app.combat.hit({ source: body.combatActor(), sourceTags: [`creature.${body.kind}`, 'feel.blow', 'cover.checked'], target: health,
              amount: effect.hit.damage, point: body.position, dir: direction.set(0, 0, 0), throughWalls: effect.hit.throughWalls, cause: { kind: body.kind, label: body.label } });
            if (effect.hit.stun > 0) game.app.effects?.apply(health, 'effect.stun', undefined, { duration: effect.hit.stun });
            if (effect.hit.trauma > 0) CameraFX.for(game).addTrauma(effect.hit.trauma);
          } else if (effect.kind === 'cue') {
            const name = program.cue(effect.id), cue = view.cues.find(row => row.id === name), body = program.body(effect.actor);
            if (cue === undefined || body === null) continue;
            if (cue.signature === true) elites.signature(controller.def.id);
            if (cue.trauma !== undefined) CameraFX.for(game).addTrauma(cue.trauma);
            if (cue.voice !== undefined) animals.onSound?.(cue.voice, point.set(effect.at.x, effect.at.y, effect.at.z));
            const fx = cue.effect; if (fx === undefined) continue;
            if (fx.kind === 'puff') {
              if (fx.at === 'head') body.headWorld(point); else point.copy(body.position);
              point.y += fx.height * body.scale; puffs.burst(point, fx.speed, fx.size, fx.lifetime, fx.opacity);
            } else { point.copy(body.position); point.y += fx.height; direction.set(player.position.x - point.x, 0, player.position.z - point.z); Impacts.for(game).burst('dirt', point, direction, fx.count); }
          }
        }
        const active = new Set<string>();
        for (const strike of program.strikePresentation()) {
          if (strike.tell === undefined) continue;
          const key = `${controller.def.id}:${strike.actor}:${strike.tell}`, body = program.body(strike.actor); if (body === null) continue;
          active.add(key); let tell = tells.get(key);
          if (tell === undefined) { tell = new GroundTell(game.scene, strike.tell, color); tells.set(key, tell); }
          tell.setTime(t);
          if (strike.tell === 'lane' && strike.phase === 'windup') {
            const k = Math.min(1, strike.time / Math.max(0.001, strike.windup)); tell.lane(strike.x0, strike.z0, strike.x1, strike.z1, strike.width, 0.35 + 0.55 * k * (0.75 + 0.25 * Math.sin(t * 22)));
          } else if (strike.tell === 'lane' && strike.phase === 'active') tell.lane(strike.x0, strike.z0, strike.x1, strike.z1, strike.width, Math.max(0, 0.6 - strike.time * 1.2));
          else if (strike.tell === 'ring' && strike.phase === 'windup') { const k = Math.min(1, strike.time / Math.max(0.001, strike.windup)); tell.ring(body.position.x, body.position.z, strike.radius * (0.7 + 0.3 * k), 0.35 + 0.6 * k * (0.7 + 0.3 * Math.sin(t * 20))); }
          else tell.hide();
        }
        for (const [key, tell] of tells) if (key.startsWith(`${controller.def.id}:`) && !active.has(key)) tell.hide();
      }
      puffs.update(dt, t);
    },
  };
}
