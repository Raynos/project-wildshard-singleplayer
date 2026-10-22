import * as v from 'valibot';
import { WorldUpdatesSchema, type WorldUpdatesRows } from '@wildshard/format/worldUpdates';
import { withOwner } from '@wildshard/engine/app/ownership';
import { updateWind } from '@wildshard/engine/world/wind';
import type { ShardContext } from '../plugin/context';
import { followToonLook } from '../looks/toonLook';
import { toonLightingOf } from '../looks/toonLighting';
import { entryOwner } from './entryOwners';
import { lentToon } from './lentLooks';
import { boundResidentWorldScope } from './hybridPresentation';

/** Entered native updates over the original construction owners. Resolve every
 * loan before registering anything; frame callbacks keep their old order and
 * primitive methods, including the rope's awake/alpha short circuit. */
export function installWorldUpdates(ctx: ShardContext, input: WorldUpdatesRows): void {
  const rows = v.parse(WorldUpdatesSchema, input), scope = ctx.scope, runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null) throw new Error('World updates require their native world');
  const bound = boundResidentWorldScope(scope), construction = bound ?? scope, game = world.game;
  const live = (): void => {
    if (scope.disposed || scope.disposing || construction.disposed || construction.disposing || !scope.belongsTo(construction)
      || boundResidentWorldScope(scope) !== bound || ctx.game.runtime !== runtime || runtime.world !== world || world.game !== game) throw new Error('World update owner left or changed');
  };
  live();
  if (new Set(rows.map(row => row.system)).size !== rows.length) throw new Error('Repeated world update system');
  const checks: (() => boolean)[] = [];
  const updates = rows.map(row => {
    let run: (dt: number) => void;
    if (row.kind === 'wind') run = dt => { updateWind(dt); };
    else if (row.kind === 'rope-deck') {
      const deck = entryOwner(scope, 'rope-deck', row.deck), chain = entryOwner(scope, 'chain', row.chain);
      checks.push(() => entryOwner(scope, 'rope-deck', row.deck) === deck && entryOwner(scope, 'chain', row.chain) === chain);
      run = () => { if (chain.awake) deck.setPoses(chain, game.alpha); };
    } else if (row.kind === 'toon-look') {
      const toon = withOwner(construction, () => lentToon(row.look)), lightingId = ctx.product.section('look/toon').lighting.id, lighting = toonLightingOf(lightingId);
      const follow = withOwner(construction, () => followToonLook(ctx.product, row.look));
      checks.push(() => withOwner(construction, () => lentToon(row.look)) === toon && toonLightingOf(lightingId) === lighting);
      run = () => { follow(); };
    } else {
      const life = entryOwner(scope, 'buildings', row.owner);
      checks.push(() => entryOwner(scope, 'buildings', row.owner) === life);
      run = dt => { life.update(dt); };
    }
    return { id: row.system, phase: 'update' as const, before: [...row.before], run };
  });
  live(); if (checks.some(check => !check())) throw new Error('World update loans changed');
  for (const system of updates) { live(); ctx.system(system); }
}
