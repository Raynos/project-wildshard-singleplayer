/**
 * The Nalati look-v2 switch (docs/design/nalati/handoff/port-v2.md, NALATI.md Phase A2): the painted-panorama sky dome,
 * the panorama-coloured fog, the in-shader grade, the lighting cheat and the GPU grass rings.
 *
 * The default on the Nalati shard since step 7 (it beat v1 at all nine camp angles and passed the walk-around);
 * `?look=v1` brings the old path back for before / after shots (`?look=v2` still works). Pine Hollow and Driftwood never
 * see any of it. Read once at module load (the URL does not change during a run). Every hook into a shared file is one
 * line behind this flag.
 */
import { chunkSlugFromUrl } from '../../chunks/registry';

function read(): boolean {
  if (typeof location === 'undefined') return false;
  if (chunkSlugFromUrl(location.search) !== 'nalati-grasslands') return false;
  return new URLSearchParams(location.search).get('look') !== 'v1';
}

export const LOOK_V2: boolean = read();
