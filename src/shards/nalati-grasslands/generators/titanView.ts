import { ARENA_VIEW, arenaChainTell } from '@wildshard/format/arenaView';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import { TITAN_CLOCKS, TITAN_SCRIPT } from './stormTitanFight';

/**
 * Nalati zero R6: the Storm Titan's tells and pose as a view program (behaviour/titanView.as) at the fight's frame slot,
 * over the values the fight lends (format/arenaView): the pose's current bend, raise and castL, the tell snapshot's
 * fields (TITAN_SCRIPT's retained tell event, resolved to their bank names here), the spear's x and z, then per chain
 * landing its on, x and z (TITAN_CLOCKS). Its channels, in the order the module writes them: the eased pose and the aim
 * (cells), the spear and fork rings, then each landing's ring.
 */
export function nalatiTitanView(): ViewProgramRows {
  const tell = TITAN_SCRIPT.fight.retainEvents.tell, { sources, cells, tells } = ARENA_VIEW;
  const life = (['bend', 'bendRate', 'raise', 'raiseRate', 'castL', 'tell', 'ringRadius', 'ringAlpha', 'forkRadius', 'forkAlpha', 'chainRadius', 'chainAlpha', 'struck', 'alpha'] as const)
    .map(field => ({ kind: 'value' as const, source: sources.life, field: tell[field] }));
  const ring = (id: string) => (['x', 'z', 'radius', 'alpha'] as const).map(param => ({ kind: 'tell' as const, tell: id, param }));
  return { slot: ARENA_VIEW.slot, before: [], budget: { pages: 1, ioBytes: 4096, fuel: 50_000, targetMs: .2 },
    pools: [],
    samples: [...ARENA_VIEW.pose.map(field => ({ kind: 'value' as const, source: sources.pose, field })), ...life,
      ...ARENA_VIEW.spear.map(field => ({ kind: 'value' as const, source: sources.spear, field })),
      ...TITAN_CLOCKS.landings.flatMap(landing => [landing.on, landing.x, landing.z].map(field => ({ kind: 'value' as const, source: sources.clocks, field })))],
    channels: [...([cells.bend, cells.raise, cells.castL, cells.struck, cells.alpha]).map(cell => ({ kind: 'cell' as const, cell })),
      ...ring(tells.spear), ...ring(tells.fork), ...TITAN_CLOCKS.landings.flatMap((_, i) => ring(arenaChainTell(i)))],
    transforms: [], bounds: { translation: 0, scale: [1, 1], shear: 0 } };
}
