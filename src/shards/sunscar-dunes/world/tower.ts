import { addFire, addLampGlow } from './fireFx';
import { KEEPER_LAMP, SIGNAL_FIRE } from '../data/fire';
import { type Group, PointLight, Vector3 } from 'three';
import { placeScene } from './places';
import REST_SCENES from '../data/restScenes.generated.json' with { type:'json' };
import type { BakedWorld } from './baked';

export interface TowerParts { root: Group; colliders: ReturnType<typeof placeScene>['colliders']; fire: Group; light: PointLight; brazierAt: Vector3; deckY: number }

/**
 * The signal tower: its steel frame, stair and colliders are an offline bake (SHARD-PLATFORM SF72, `generators/tower.ts`);
 * here are its live parts on the baked anchors: the keeper's lit glass with its halo and flame, the deck brazier (the
 * generated model) and the signal fire, hidden until lit.
 */
export function buildTower(baked: BakedWorld): TowerParts {
  const row = REST_SCENES.places.tower, made = placeScene(row,baked), {root,colliders} = made, {deckY,lampY} = row.anchors;
  // The keeper's lantern (round 8, mockup dusk-fire: a lamp burns in the tower's top before the signal is lit; the council: an
  // empty cage): a lit glass in the baked iron cage, its small halo (fireFx addLampGlow)
  // (round 8 first cut: a 0.3 m glass under the frame read as a pale dot against the bright afterglow at 145 m)
  const keeperLamp = made.group('live.keeper-lamp'), flame = made.group('live.lamp-flame'), fire = made.group('live.fire');
  if (keeperLamp === null || flame === null || fire === null) throw new Error('Missing declared tower anchors');
  addLampGlow(keeperLamp, 1.1, () => deckY - lampY); // round 12: 2.6 m read as a wash, not a lamp
  addFire(flame, KEEPER_LAMP); // round 10 (R9B-8): the open flame over the cap (inside the glass it read as a pale box) // its flame (a lit glass alone read as a pale dot)
  // The brazier (round 1, R1C-1 / R1B-12: the H4 view's subject): the generated one, deck-sized, its fire hidden until
  // the signal is lit. A model that did not load stands undrawn (a page fault, world/meshes.ts), as the places' do.
  const brazierAt = new Vector3(...row.anchors.brazier);
  // The signal fire: the brightest thing in the level, its column visible from the spawn (P2 #8, `fireFx.ts`).
  addFire(fire, SIGNAL_FIRE);
  const light = new PointLight(0xff8a3a, 0, 40, 1.6); light.position.set(0, 1.0, 0); fire.add(light);
  fire.visible = false;
  return { root, colliders, fire, light, brazierAt, deckY };
}
