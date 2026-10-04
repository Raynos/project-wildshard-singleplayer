import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { Vector3 } from 'three';

/** Contact uses the shared chest query before preserving the directional feedback point. */
export function encounterHit(attacker: Animal, amount: number, tag: CombatTag, position: Vector3, throughWalls = false): boolean {
  const target = app.player;
  if (target === null || (!throughWalls && !canReach(attacker, position, app.physics))) return false;
  return app.combat.hit({ source: 'env', sourceTags: [tag, 'feel.blow', 'cover.checked'], target, amount,
    point: attacker.position, dir: new Vector3(), cause: { kind: attacker.kind, label: attacker.label } }) !== null;
}
