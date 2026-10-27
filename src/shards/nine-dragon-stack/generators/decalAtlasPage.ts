import { canvasAtlasRows, paintCanvasAtlas } from '@wildshard/sdk/bake/canvasAtlas';
import decals from '../data/decals.json' with { type: 'json' };
import plumbing from '../data/plumbing.json' with { type: 'json' };

interface DecalRaster { readonly width: number; readonly height: number; readonly png: Uint8Array<ArrayBuffer>; readonly rgba: Uint8ClampedArray<ArrayBuffer> }
declare global { interface Window { bakeNineDecal: (tier: 'phone' | 'desktop') => Promise<DecalRaster> } }

/** Retain the old native canvas raster at each declared tier scale. */
window.bakeNineDecal = async tier => {
  const row = canvasAtlasRows(decals.JIAN_DECALS);
  const scale = plumbing.knobs.find(knob => knob.id === 'nine.decalScale')?.[tier];
  if (scale === undefined) throw new Error('Missing authored decal scale');
  const texture = paintCanvasAtlas(row, scale);
  try {
    const image: unknown = texture.image;
    if (!(image instanceof HTMLCanvasElement)) throw new Error('Decal painter did not return its canvas');
    const context = image.getContext('2d');
    if (context === null) throw new Error('Decal canvas has no context');
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const blob = await new Promise<Blob>((_resolve, reject) => {
      image.toBlob(value => {
        if (value === null) reject(new Error('Decal PNG encoding failed')); else _resolve(value);
      }, 'image/png');
    });
    return { width: image.width, height: image.height, png: new Uint8Array(await blob.arrayBuffer()), rgba: pixels };
  } finally { texture.dispose(); }
};
