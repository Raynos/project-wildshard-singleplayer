import { defineBakedModels } from '@wildshard/engine/models/model';
import { Group } from 'three';
import { buildWhipModel } from '../runtime/items/heldWhip';
import { buildTower } from '../world/tower';
import { lastBakedWorld } from '../world/baked';
import { buildBrazier, buildCaravan, buildWell } from '../world/places';
import { questNpcSpecimen } from '@wildshard/game/plugin/ui';
import source from '../runtime/source';
import { SIGNAL_QUEST_PAGE } from '../data/questPage';
import { duneMesh } from '../world/meshes';
import { BRAZIERS, CARAVAN, TOWER, WELL } from '../data/layout';
import caravanRows from '../data/caravan.json' with { type: 'json' };
import wellRows from '../data/well.json' with { type: 'json' };
import brazierRows from '../data/braziers.json' with { type: 'json' };
import { GEAR_MODEL_ROWS } from '../data/gearModels';

/** Native motion/material owners remain the actual Explorer builders. */
const centred = (root: Group, x: number, y: number, z: number): Group => { const group = new Group(); root.position.set(-x, -y, -z); group.add(root); return group; };
const caravanY = caravanRows.anchors.y, wellY = wellRows.anchors.y, brazierY = brazierRows.braziers[0]?.y ?? 0;
const builders = [
  () => { const parts = buildWhipModel(); parts.part('coil').visible = true; return parts.root; },
  () => {
    const parts = buildTower(lastBakedWorld() ?? new Map()), group = new Group();
    parts.root.position.set(-TOWER.x, TOWER.deck - parts.deckY, -TOWER.z); parts.fire.visible = true; group.add(parts.root); return group;
  },
  () => centred(buildCaravan(lastBakedWorld() ?? new Map(), () => caravanY).root, CARAVAN.x, caravanY, CARAVAN.z),
  () => centred(buildWell(lastBakedWorld() ?? new Map()).root, WELL.x, wellY, WELL.z),
  () => {
    const parts = buildBrazier(lastBakedWorld() ?? new Map(), 0, () => brazierY, []); parts.fire.visible = true; parts.oil.visible = true;
    return centred(parts.root, BRAZIERS[0]?.x ?? 0, brazierY, BRAZIERS[0]?.z ?? 0);
  },
  () => questNpcSpecimen(source, SIGNAL_QUEST_PAGE.npc, SIGNAL_QUEST_PAGE.model,
    { kind: 'mesh', read: () => duneMesh('caravan-scout') }),
] as const;
/** One declared catalogue; each original builder is resolved lazily by the shared model contract. */
export const GEAR_MODELS = defineBakedModels(GEAR_MODEL_ROWS, index => { const build = builders[index]; if (build === undefined) throw new Error('Missing declared Signal specimen builder'); return build(); });
