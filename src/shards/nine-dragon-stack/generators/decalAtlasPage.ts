import * as v from 'valibot';
import { paintCanvasAtlas, type CanvasAtlasRow } from '@wildshard/game/plugin/geometry';
import { isJsonData } from '@wildshard/format/json';
import decals from '../data/decals.json' with { type: 'json' };
import plumbing from '../data/plumbing.json' with { type: 'json' };

interface DecalRaster { readonly width: number; readonly height: number; readonly png: string; readonly rgba: string }
declare global { interface Window { bakeNineDecal: (tier: 'phone' | 'desktop') => DecalRaster } }

/** Retain the old native canvas raster at each declared tier scale. */
window.bakeNineDecal = tier => {
  const row = v.parse(v.custom<CanvasAtlasRow>(isJsonData), decals.JIAN_DECALS);
  const scale = plumbing.knobs.find(knob => knob.id === 'nine.decalScale')?.[tier];
  if (scale === undefined) throw new Error('Missing authored decal scale');
  const texture = paintCanvasAtlas(row, scale), image: unknown = texture.image;
  if (!(image instanceof HTMLCanvasElement)) throw new Error('Decal painter did not return its canvas');
  const context = image.getContext('2d');
  if (context === null) throw new Error('Decal canvas has no context');
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let raw = '';
  for (let i = 0; i < pixels.length; i += 16384) raw += String.fromCodePoint(...pixels.subarray(i, i + 16384));
  const result = { width: image.width, height: image.height, png: image.toDataURL('image/png'), rgba: btoa(raw) };
  texture.dispose();
  return result;
};
