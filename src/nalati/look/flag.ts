/**
 * The Nalati look-v2 switch (docs/design/nalati/handoff/port-v2.md, NALATI.md Phase A2): the painted-panorama sky dome,
 * the panorama-coloured fog, the in-shader grade, the lighting cheat and the GPU grass rings.
 *
 * `?look=v2` turns it on, and only on the Nalati shard — Pine Hollow and Driftwood never see any of it. Read once at
 * module load (the URL does not change during a run). Every hook into a shared file is one line behind this flag.
 */
import { chunkSlugFromUrl } from '../../chunks/registry';

function read(): boolean {
  if (typeof location === 'undefined') return false;
  if (chunkSlugFromUrl(location.search) !== 'nalati-grasslands') return false;
  return new URLSearchParams(location.search).get('look') === 'v2';
}

export const LOOK_V2: boolean = read();
