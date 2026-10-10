import rock from './rock.graph.json' with { type: 'json' };
import edge from './edge.post.json' with { type: 'json' };

/**
 * The ink / cel valley (SF59's second G169 fixture, `art/grid/round-19-art-styles/C-ink-cel-valley-inside.jpg`): the terrain
 * binds `ground`, an engine-owned toon preset reference in sage green; every prop binds `rock`, an authored cel graph
 * (`rock.graph.json`: paper albedo with face-border ink, the sun in three hard bands with a flat ink-wash shade, a
 * silhouette line, a light posterise and the outline stage's inverted hull). `look.post` is its one authored pass
 * (`edge.post.json`, the (2b) edge post): depth and normal-crease edges inked over the tone-mapped colour, faded with
 * distance; it reads colour, depth and the normal pre-pass. With Settings ▸ Debug ▸ Look ▸ "Graph materials" off the
 * ground draws its toon family, the rock its plain fallback, and the post stack is not built. A paper sky, a warm sun
 * and a teal-paper fog keep the frame a printed page.
 */
export const INK_LOOK = {
  families: ['toon'],
  materials: {
    ground: { family: 'graph', preset: { family: 'toon', colour: [0.56, 0.61, 0.37] }, version: 1 },
    rock: { family: 'graph', graph: rock },
  },
  post: [{ graph: edge }],
  grade: { exposure: 0, saturation: 1, contrast: 1, lut: null }, clock: 'engine',
  day: { minutes: 12, start: 0.45, maxElevation: 55, azimuth: 35 }, dayOverride: null,
  keys: [{ time: 0, sky: { zenith: [0.9, 0.86, 0.74], horizon: [0.96, 0.92, 0.82] },
    fog: { colour: [0.78, 0.82, 0.76], density: 0, near: 90, far: 280 },
    sun: { colour: [1, 0.95, 0.86], intensity: 1.7 },
    ambient: { sky: [0.62, 0.7, 0.74], ground: [0.5, 0.52, 0.4], intensity: 0.75 },
  }],
};
