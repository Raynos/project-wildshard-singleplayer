import { worldSceneWeldRows } from '@wildshard/sdk/worldScenes';
import type { NineWorldScenes } from './worldScenes';
import primary from '../data/heldPrimary.json' with { type: 'json' };

export const NINE_HELD_CARDS = 'models/held-cards.json';

interface NineExplorerDeclarations {
  readonly catalogue: { version: 1; entries: { kind: 'held'; item: string; cards: string }[] };
  readonly sets: { kind: 'world.sets'; rows: { id: string; name: string; file: string; place: string; pois: string[]; x: number; z: number; r: number }[] };
}
/** The weld remains the registration owner. Declare its exact existing groups
 * for catalogue readers without placing, drawing or registering them twice. */
export function nineExplorerDeclarations(scenes: NineWorldScenes): NineExplorerDeclarations {
  const fabric = scenes.LAYOUT_PLACEMENT_BLOBS.find(blob => blob.file.name === 'world/fabric.json');
  if (fabric === undefined) throw new Error('Missing Nine fabric declaration');
  const weld = worldSceneWeldRows(JSON.parse(new TextDecoder().decode(fabric.bytes)));
  const rows = weld.sets.map(row => {
    if (row.place === undefined) throw new Error('Nine set requires its named place');
    return { id: row.id, name: row.name, file: row.file, place: row.place, pois: row.members, x: 0, z: 0, r: 0 };
  });
  return { catalogue: { version: 1, entries: [{ kind: 'held', item: primary.primary.item, cards: NINE_HELD_CARDS }] },
    sets: { kind: 'world.sets', rows } };
}
