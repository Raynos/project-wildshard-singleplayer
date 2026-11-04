// Open-plot world bytes: tiled layouts, plus the generic inactive placeholder.
import declared from '../outputs.json' with { type: 'json' };
import { Document, WebIO } from '@gltf-transform/core';
import { ACCENTS } from '@wildshard/format/accent';
import { Soup } from './kit.mjs';
import { tiledWorldBytes } from './tiledPlot.mjs';

export const ideas = declared.outputs;
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/** Build only a declared tiled layout or the generic placeholder; no retired showroom inputs. */
export async function ideaWorld(idea, read, tools) {
  if (idea.placeholder === true) return placeholderWorld(idea);
  if (idea.layout === undefined) throw new Error('open-plots: a plot needs its tiled layout');
  const bytes = await tiledWorldBytes(read, tools, idea);
  return bytes;
}

/** Build a real walkable placeholder without reading nonexistent theme art.
 * @param {import('./plotBake.mjs').PlotIdea} idea */
function placeholderWorld(idea) {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('plot');
  const colour = ACCENTS[idea.accent];
  if (colour === undefined) throw new Error('open-plots: unknown placeholder accent');
  const tint = linear(colour);
  const material = doc.createMaterial('Floor').setBaseColorFactor([...tint, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const kerbMaterial = doc.createMaterial('Kerb').setBaseColorFactor([0.5, 0.56, 0.64, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const floor = new Soup(), kerb = new Soup(), solid = new Soup();
  floor.quad('Floor', [-250, 0, -250], [-250, 0, 250], [250, 0, 250], [250, 0, -250]);
  solid.quad('Solid', [-250, 0, -250], [-250, 0, 250], [250, 0, 250], [250, 0, -250]);
  // Same four 30 m entries and kerb extents as the original placeholder scaffold.
  for (const side of [-1, 1]) for (const [lo, hi] of [[-240, -15], [15, 240]]) {
    const boxes = [ [[lo, 0, side > 0 ? 238 : -240], [hi, 0.5, side > 0 ? 240 : -238]],
      [[side > 0 ? 238 : -240, 0, lo], [side > 0 ? 240 : -238, 0.5, hi]] ];
    for (const [min, max] of boxes) { kerb.box('Kerb', min, max); solid.box('Solid', min, max); }
  }
  const node = (name, part, surface = material) => {
    const primitive = doc.createPrimitive().setMaterial(surface);
    for (const [attribute, size, values] of [['POSITION', 'VEC3', part.positions], ['NORMAL', 'VEC3', part.normals], ['COLOR_0', 'VEC3', part.colours]]) {
      primitive.setAttribute(attribute, doc.createAccessor().setType(size).setArray(new Float32Array(values)).setBuffer(buffer));
    }
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  };
  node('ws_terrain_floor', floor.part('Floor')); node('draw_kerb', kerb.part('Kerb'), kerbMaterial);
  node('far_placeholder', floor.part('Floor')); node('collide_plot', solid.part('Solid'));
  return new WebIO().writeBinary(doc);
}
