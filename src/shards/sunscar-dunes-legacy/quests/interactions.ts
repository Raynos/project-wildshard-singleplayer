import { parseInteractionRows } from '@wildshard/sdk/interactions';
import { BRAZIERS } from '../data/layout';
import { FLAG, SCOUT_FLAG } from '../data/flags';
import { brazierFlag } from './brazierFlag';

/** The script command actor that carries Signal's interactions (`{ kind: 'script', actorId, value: SIGNAL_ACT.* }`). */
export const SIGNAL_INTERACT = 'sunscar.interact';
/**
 * The acts a command's value names: the browser's [E] prompts (talk, logbook, well, one pour per waymark, the tower fire)
 * and the whip's cracks on the world (the crank's double crack, one per waymark bowl).
 */
export const SIGNAL_ACT = { talk: 0, logbook: 1, well: 2, pour: 3, fire: 6, crank: 100, light: 101 } as const;

const each = <T,>(row: (i: number) => T): T[] => BRAZIERS.map((_, i) => row(i));
const oiled = (i: number): string => `oiled.${String(i)}`, lit = (i: number): string => `lit.${String(i)}`;

/**
 * "The signal"'s interactions as declared rows (SF72, `@wildshard/sdk/interactions`), the rules the browser's interactables
 * and the renderer-free host both run: Sefa's talk raises the scout flag; the logbook reads once; a heavy crack on the
 * well's crank raises the bucket (raised from the start once the oil is taken), and only then is the oil jar taken; oil is
 * poured into each waymark's bowl by hand and lit with a light crack; the tower fire lights by hand once all three burn.
 * The bucket, the oiled bowls, the burning bowls and the fire are transient marks (exact continuation); a lit bowl is
 * always an oiled one. The browser's line of sight on the prompts is not modelled headless.
 */
export const SIGNAL_INTERACTIONS = parseInteractionRows({
  marks: [{ id: 'raised', initial: { all: [FLAG.oil] } }, { id: 'fire' }, ...each(i => [{ id: oiled(i) }, { id: lit(i) }]).flat()],
  never: each(i => ({ all: [lit(i)], none: [oiled(i)] })),
  rows: [
    { id: 'talk', act: SIGNAL_ACT.talk, at: 'scout', needs: [{ none: [SCOUT_FLAG], else: 'already' }], sets: [SCOUT_FLAG] },
    { id: 'logbook', act: SIGNAL_ACT.logbook, at: 'logbook', needs: [{ none: [FLAG.logbook], else: 'already' }], sets: [FLAG.logbook] },
    { id: 'well', act: SIGNAL_ACT.well, at: 'well', needs: [{ none: [FLAG.oil], else: 'already' }, { all: ['raised'], else: 'unraised' }], sets: [FLAG.oil] },
    ...each(i => ({ id: `pour.${String(i)}`, act: SIGNAL_ACT.pour + i, at: `brazier.${String(i)}`,
      needs: [{ none: [lit(i)], else: 'already' }, { all: [FLAG.oil], else: 'missing' }, { none: [oiled(i)], else: 'already' }], sets: [oiled(i)] })),
    { id: 'fire', act: SIGNAL_ACT.fire, at: 'fire', needs: [{ none: ['fire'], else: 'already' }, { all: each(lit), else: 'unlit' }], sets: ['fire', FLAG.lit] },
    // the double crack's first lash wraps the crank and its second pulls (world/build.ts); a light crack only rattles it
    { id: 'crank', act: SIGNAL_ACT.crank, at: 'crack.well.crank', crack: 'heavy', needs: [{ none: ['raised'], else: 'already' }], sets: ['raised'] },
    ...each(i => ({ id: `light.${String(i)}`, act: SIGNAL_ACT.light + i, at: `crack.brazier.${String(i)}`, crack: 'light',
      needs: [{ none: [lit(i)], else: 'already' }, { all: [oiled(i)], else: 'unoiled' }], sets: [lit(i), brazierFlag(i)] })),
  ],
});
