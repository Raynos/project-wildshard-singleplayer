import { Vector3 } from 'three';
import type { Events } from '../events/events';
import type { Scope } from '../app/scope';
import type { CombatPipeline, CombatTag, DeathCause } from '../combat/pipeline';
import type { PlayerHealth } from '../combat/health';
import { hardFallHit } from '../player/fall';

export interface HurtPlayer {
  position: Vector3; yaw: number;
  shove: (x: number, z: number, strength: number) => void;
}
export interface PlayerHurtPorts {
  player: HurtPlayer;
  directional: () => boolean;
  flash: () => void; toast: (text: string) => void;
  combat: (value: number) => void; hurt: (strength: number, pan: number) => void; land: (hard: boolean) => void;
  arc: (x: number, z: number, position: Vector3, yaw: number, damage: number) => void;
  trauma: (value: number) => void;
}
/** The damage event owns presentation; health/rules stay in the simulation service. */
export class PlayerHurt {
  private readonly combat: CombatPipeline;
  private readonly health: PlayerHealth;
  private readonly ports: PlayerHurtPorts;
  constructor(events: Events, scope: Scope, combat: CombatPipeline, health: PlayerHealth, ports: PlayerHurtPorts) {
    this.combat = combat; this.health = health; this.ports = ports;
    events.on('damage.dealt', ({ req, dealt }) => {
      if (req.target !== health) return;
      ports.flash();
      if (req.sourceTags.includes('feel.blow')) {
        const p = ports.player, at = req.point;
        ports.combat(0.9);
        if (ports.directional()) {
          ports.arc(at.x, at.z, p.position, p.yaw, dealt);
          ports.trauma(Math.min(0.85, 0.3 + dealt / 40));
        }
        p.shove(at.x, at.z, 5 + Math.min(4, dealt * 0.15));
        const dx = at.x - p.position.x, dz = at.z - p.position.z, d = Math.hypot(dx, dz);
        ports.hurt(dealt / 20, d > 0.3 ? ((dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) / d) * 0.7 : 0);
      } else if (req.sourceTags.includes('feel.jolt')) {
        if (req.toast !== undefined && req.toast !== '') ports.toast(req.toast);
        ports.land(true);
      }
    }, scope);
  }
  creature(a: { kind: string; label: string; position: Vector3 }, amount: number): void {
    this.combat.hit({ source: 'env', sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'],
      target: this.health, amount, point: a.position.clone(), dir: new Vector3(), cause: { kind: a.kind, label: a.label } });
  }
  jolt(tag: CombatTag, amount: number, cause: DeathCause, toast?: string): void {
    this.combat.hit({ source: 'env', sourceTags: [tag, 'feel.jolt', 'cover.checked'],
      target: this.health, amount, point: this.ports.player.position.clone(), dir: new Vector3(), cause,
      ...(toast === undefined ? {} : { toast }) });
  }
  fall(hard: boolean): void {
    this.ports.land(hard);
    if (hard) this.combat.hit(hardFallHit(this.health, this.ports.player.position));
  }
}
