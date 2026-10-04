import { app, canReach, type Animal, type CombatTag } from '@wildshard/engine';
import { Vector3 } from 'three';

/** Contact uses the shared chest query before preserving the directional feedback point. */
export function encounterHit(attacker: Animal, amount: number, tag: CombatTag, position: Vector3, throughWalls = false): boolean {
  const target = app.player;
  if (target === null || (!throughWalls && !canReach(attacker, position))) return false;
  return app.combat.hit({ source: 'env', sourceTags: [tag, 'feel.blow', 'cover.checked'], target, amount,
    point: attacker.position, dir: new Vector3(), cause: { kind: attacker.kind, label: attacker.label } }) !== null;
}
