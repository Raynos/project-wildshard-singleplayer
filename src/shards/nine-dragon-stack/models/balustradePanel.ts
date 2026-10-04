/**
 * The balustrade's carved panel face (E281 round 2; E306 / E315 M4): a raised frame, two big ruyi scrolls curling in from
 * the ends, a lotus medallion, small scrolls in the corners — one geometry in its own frame (the face on z = 0 facing +z,
 * x across, y up from the panel's foot; ../world/square.ts `carvedPanel`) for every one of the square's ~56 faces, both
 * sides of every panel, each copy scaled to its gap. Past PANEL_LOD m (E283) the 2–5 cm scroll strokes are gone and the
 * frame and medallion stay. The balustrade's posts, rails and plinth are the square's own fabric (its kit).
 */
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { PANEL_LOD, carvedPanel } from '../world/square';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/balustradePanel.ts';

function panel(ctx: ModelContext, far: boolean): readonly ModelPart[] {
  const look = ndLook(ctx);
  const geometry = far ? ctx.once('nds:panel:far', () => carvedPanel(true)) : look.geo.get('set:balustrade-panel') ?? ctx.once('nds:panel', () => carvedPanel(false));
  return [{ geometry, material: need(look.mat, 'the Jiehua program') }];
}

export const balustradePanel = defineModel({
  id: 'nine-dragon-stack/balustrade-panel', name: 'Carved balustrade panel', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => panel(ctx, false),
  lods: [{ from: PANEL_LOD, build: (ctx) => panel(ctx, true) }],
});
