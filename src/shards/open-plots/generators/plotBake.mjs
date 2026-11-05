// Every declared open plot is a tiled world; no retired showroom inputs.
import declared from '../outputs.json' with { type: 'json' };
import { tiledWorldBytes } from './tiledPlot.mjs';

export const ideas = declared.outputs;

/** Refuse missing layouts before reading any art or geometry. */
export async function ideaWorld(idea, read, tools) {
  if ('placeholder' in idea) throw new Error('open-plots: placeholder worlds are retired');
  if (idea.layout === undefined) throw new Error('open-plots: a plot needs its tiled layout');
  const bytes = await tiledWorldBytes(read, tools, idea);
  return bytes;
}
