import type { LevelContext, EffectService, PlayerHealth, Player } from '#engine';
import { bindStarterEffects } from './bindings';
import { starterId, STARTER_CHOICES } from './starter';
import { StatusIcons } from './view';

export function installStarterEffects(ctx: LevelContext, host: { player: Player; health: PlayerHealth | null; effects: EffectService | null }): void {
  const { player, health, effects } = host;
  if (health === null || effects === null) throw new Error('Starter effects need player health and effects services');
  bindStarterEffects({ effects, target: health, movement: player, combat: ctx.app.combat, position: () => player.position, scope: ctx.scope });
  let pick = 'off', elapsed = 0, icons: StatusIcons | null = null;
  ctx.debugRow({ id: 'effects.apply', group: 'combat', label: 'Apply effect', initial: 'off',
    choices: STARTER_CHOICES.map((value) => ({ value, text: value === 'off' ? 'Off' : value[0]?.toUpperCase() + value.slice(1) })),
    change: (value) => { pick = value; elapsed = 0; }, note: 'E357 starter effects · applies to the player every 5 seconds' });
  ctx.system({ id: 'engine.effects.debug', phase: 'update', run: (dt) => {
    const id = starterId(pick);
    if (id !== null) { elapsed += dt; if (elapsed >= 5) { elapsed %= 5; effects.apply(health, id); } }
    const active = effects.active(health);
    const status = active.some((effect) => effect.def.tags.some((tag) => tag.startsWith('status.')));
    if (status && icons === null) { icons = new StatusIcons(); ctx.hud.widget('status', icons.root, 80); }
    if (icons !== null) { icons.update(active); icons.root.style.display = status ? '' : 'none'; }
  } });
  ctx.on('player.died', ({ actor }) => {
    if (actor !== health) return;
    for (const effect of effects.active(health)) if (effect.def.tags.some((tag) => tag.startsWith('status.'))) effects.remove(health, effect.def.id);
  });
  ctx.scope.onDispose(() => { icons?.root.remove(); });
}
