import { Color } from 'three';
import { WALKER_DYES } from './casts';

/** The crowd table's explicit instance-colour keys. White selects the original
 * dark palette, zero selects the untinted light palette, actual RGB dyes retain
 * their old values. This contract applies only to geometry with a light-colour
 * table; the ordinary kit's instance colours keep their original meaning. */
export const CROWD_LIGHT_OWN = [0, 0, 0] as const;
const paper = new Color(WALKER_DYES.paper.color);
/** Match at the vertex input's actual Float32 precision, before interpolation. */
export const CROWD_LIGHT_DYE = [Math.fround(paper.r), Math.fround(paper.g), Math.fround(paper.b)] as const;

/** Preserve every original placement and dye, selecting only its palette row. */
export function crowdPaletteColor(group: 'walkers' | 'sitters', variant: string): readonly [number, number, number] {
  if (variant === 'light') return CROWD_LIGHT_OWN;
  if (variant === 'dark') return [1, 1, 1];
  if (group === 'sitters') throw new Error('Unknown sitter palette');
  const dye = variant === 'paper' ? WALKER_DYES.paper : variant === 'blue' ? WALKER_DYES.blue : variant === 'oxblood' ? WALKER_DYES.oxblood : undefined;
  if (dye === undefined) throw new Error('Unknown walker palette');
  const color = new Color(dye.color); return [color.r, color.g, color.b];
}
