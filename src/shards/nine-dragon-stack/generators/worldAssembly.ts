import * as v from 'valibot';
import { WorldAssemblySchema } from '@wildshard/format/worldAssembly';
import shardfile from './product';
import { nineBuildBlocks } from './worldEntry';
import { MOVER_STAGES } from './moversView';
import { NINE_WORLD_SCENES } from './worldScenes';

/** E264: the fabric's static geometry keeps only its positions (and index) in JS once it is on the GPU */
const STATIC_GEOMETRY = 'Nine Dragon static geometry (only the positions stay in JS)';

/**
 * Nine Dragon Stack's world as world-assembly rows (game/shardfile/worldAssembly, the client plan's world.assembly): every
 * entry block in the build's order under one root, then one stage per mover (placed and lent to the movers view module,
 * generators/moversView.ts), its loading steps as checkpoints (the labels and fractions the build showed, a drawn frame
 * where it paused, a work slice where it sliced) and its static geometry GPU-only. Each deck ending is a construction
 * variant: `capped` played alone, `open` in a grid cell.
 */
export function nineWorldAssembly(): v.InferOutput<typeof WorldAssemblySchema> {
  const blocks = nineBuildBlocks();
  const entry = (id: string, label: string) => {
    const rows = blocks[id]; if (rows === undefined) throw new Error(`Missing Nine build block ${id}`);
    return { kind: 'entry' as const, id, label, rows };
  };
  const mover = (id: string) => ({ kind: 'entry' as const, id, label: 'movers', rows: [{ kind: 'place' as const, id }, { kind: 'attach' as const, id: `${id}.root`, as: 'object' as const }],
    object: { as: 'object' as const, part: `${id}.root` } });
  const looks = Object.keys(shardfile.look.materials);
  const progress = (label: string, done: number) => ({ kind: 'progress' as const, label, done });
  const lastMover = MOVER_STAGES[MOVER_STAGES.length - 1]; if (lastMover === undefined) throw new Error('Nine has no movers');
  // the banyan crown's parts, when the layout bake drew a crown (the dressing step publishes them)
  const dressing = NINE_WORLD_SCENES.steps.find(step => step.id === 'dressing'), crown = ['crown-cards', 'crown-core'].filter(id => dressing?.publish[id] !== undefined);
  return v.parse(WorldAssemblySchema, {
    construction: {
      looks: { unbound: looks, bound: looks }, root: { id: 'nine.root', name: 'nine-dragon-stack' }, variant: { standalone: 'capped', cell: 'open' },
      seed: shardfile.identity.seed,
      progress: { kind: 'checkpoints', total: 100, start: 'paint + fonts', finish: 'world ready', budgetMs: 30 },
      checkpoints: [
        { stage: 'portals', at: 'before', actions: [progress('layout: square', 15), progress('layout: baked', 20)] },
        { stage: 'portals', at: 'after', actions: [progress('signs', 30), { kind: 'build-yield' }, progress('geometry conversion', 40), { kind: 'build-yield' }, progress('canopy', 52)] },
        { stage: 'sets', at: 'after', actions: [{ kind: 'slice' }] },
        { stage: 'kits', at: 'after', actions: [{ kind: 'slice' }] },
        { stage: 'lanterns', at: 'after', actions: [progress('facade batches', 56)] },
        { stage: 'facade', at: 'after', actions: [{ kind: 'slice' }, progress('streaks + dressing', 60)] },
        { stage: 'cards', at: 'after', actions: [{ kind: 'slice' }] },
        { stage: 'wall', at: 'after', actions: [{ kind: 'slice' }] },
        { stage: lastMover, at: 'after', actions: [{ kind: 'slice' }, progress('crowd models', 75)] },
        { stage: 'figures', at: 'after', actions: [{ kind: 'slice' }, progress('light volume', 90), progress('culling', 95), progress('world ready', 100)] },
      ],
      gpu: { label: STATIC_GEOMETRY, roots: [
        ...crown.map(id => ({ kind: 'scene-part' as const, as: 'mesh' as const, id: `dressing.${id}` })),
        { kind: 'scene-part', as: 'object', id: 'fabric.root' },
        { kind: 'scene-part', as: 'object', id: 'fixed-capped.root', when: { variant: 'capped' } },
        { kind: 'scene-part', as: 'object', id: 'fixed-open.root', when: { variant: 'open' } },
      ] },
    },
    stages: [
      entry('portals', 'portals'), entry('canopy', 'canopy'), entry('dressing', 'dressing'), entry('lions', 'lions'), entry('sets', 'sets'),
      entry('kits', 'fabric'), entry('lanterns', 'lanterns'), entry('facade', 'facade batches'), entry('cards', 'streaks + dressing'), entry('wall', 'wall kit'),
      ...MOVER_STAGES.map(mover), entry('figures', 'crowd models'),
    ],
  });
}
