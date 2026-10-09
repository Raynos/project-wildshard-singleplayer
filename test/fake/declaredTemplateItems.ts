import { App } from '../../src/engine/app/app';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import type { Actor } from '../../src/engine/combat/pipeline';
import type { Scope } from '../../src/engine/app/scope';
import type { Weapon } from '../../src/engine/combat/Weapon';
import type { AimCommand } from '../../src/engine/input/commands';
import type { ItemRuntime, ItemTarget } from '../../src/engine/combat/items';
import { installDeclaredItems, parseItems, type DeclaredItems } from '../../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../../src/game/systems/items/declared';
import { ITEMS } from '../../src/shards/_template/data/items';

interface TemplateItemFixture {
  app: App; scope: Scope; weapon: Weapon; runtime: ItemRuntime; service: EquipmentService; items: DeclaredItems;
  effects: string[]; swings: string[]; aim: AimCommand; step: (count?: number) => void; dispose: () => void;
}
export function declaredTemplateItems(app = new App(), targets: () => readonly ItemTarget[] = () => []): TemplateItemFixture {
  const scope = (app.levelScope ?? app.engineScope).child('declared-template-regression');
  const actor: Actor = { id: 'actor.player', tags: ['actor.player'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true, applyDamage: () => false };
  const aim = { origin: { x: 0, y: 1.68, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
  const effects: string[] = [], swings: string[] = [];
  if (!app.input.has('weapon.melee')) app.input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], keys: { attack: ['Mouse0'], heavy: ['Mouse2'] } }, scope);
  // The separate native template proofs exercise the admitted AS hooks; input regressions isolate trusted item contacts.
  const declaration = parseItems(ITEMS);
  for (const row of declaration.rows) row.hook = null;
  const items = installDeclaredItems(declaration, {
    scope, actorId: actor.id, input: app.input, aim: () => aim, families: declaredKitItemFamilies(),
    icon: (id) => { if (id === 'sword' || id === 'glyph') return id; throw new Error('Unknown fixture icon'); },
    runtime: () => ({ actor, combat: app.combat, targets, hook: null, effect: (_target, effect) => { effects.push(effect); },
      changed: (runtime, phase) => { if (phase === 'fire') swings.push(runtime.spec.id); } }),
  });
  const weapon = items.primary, runtime = items.runtimes.get('weapon.template-whip');
  if (weapon === null || runtime === undefined) throw new Error('Template whip missing');
  const service = new EquipmentService(weapon, { scope, events: app.events, input: { bind: (action, run, owner, allowed) => app.input.bind(action, run, owner, allowed) } });
  let tick = 0;
  const step = (count = 1): void => { for (let i = 0; i < count; i++) { items.step(++tick, 1 / 60); service.update(1 / 60, tick / 60); app.events.flush('fixed.post'); } };
  return { app, scope, weapon, runtime, service, items, effects, swings, aim, step, dispose: (): void => { scope.dispose(); } };
}
