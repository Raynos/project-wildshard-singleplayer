import type { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import { bindPlayerEffects, type EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { LevelContext } from '@wildshard/engine/level/context';
import { StatusIcons } from './view';

type StatusMovement = Parameters<typeof bindPlayerEffects>[0]['movement'];
type StarterContext = Pick<LevelContext, 'app' | 'scope' | 'system' | 'on'> & { hud: Pick<LevelContext['hud'], 'widget'> };
/** An optional entered installer retires observers and icons while statuses remain player-owned. */
export function installStarterEffects(ctx: StarterContext, host: { player: StatusMovement & { position: Vector3 }; health: Actor | null; effects: EffectService | null },
  entered?: (install: (scope: Scope) => void) => void): void {
  const { player, health, effects } = host;
  if (health === null || effects === null) throw new Error('Starter effects need player health and effects services');
  if (entered === undefined) bindPlayerEffects({ effects, target: health, movement: player, combat: ctx.app.combat, position: () => player.position, scope: ctx.scope });
  let iconScope: Scope | undefined;
  let icons: StatusIcons | null = null;
  if (entered !== undefined) entered((scope) => {
    iconScope = scope;
    scope.onDispose(() => { icons?.root.remove(); icons = null; if (iconScope === scope) iconScope = undefined; });
  });
  ctx.system({ id: 'engine.effects.status', phase: 'update', run: () => {
    const active = effects.active(health);
    const status = active.some((effect) => effect.def.tags.some((tag) => tag.startsWith('status.')));
    if (status && icons === null) {
      icons = new StatusIcons();
      if (entered === undefined) ctx.hud.widget('band.3', icons.root, 80);
      else if (iconScope !== undefined) hudSlots.widget('band.3', icons.root, 80, iconScope);
    }
    if (icons !== null) { icons.update(active); icons.root.style.display = status ? '' : 'none'; }
  } });
  if (entered === undefined) ctx.on('player.died', ({ actor }) => {
    if (actor !== health) return;
    for (const effect of effects.active(health)) if (effect.def.tags.some((tag) => tag.startsWith('status.'))) effects.remove(health, effect.def.id);
  });
  ctx.scope.onDispose(() => { icons?.root.remove(); });
}
