import * as v from 'valibot';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import { NPC_FIGURE } from './peopleLook';
import { NATIVE_VIEW } from './nativeView';
import { LEG_BONE_NAMES } from './npcSkin';
import skins from '../data/npcSkins.generated.json' with { type: 'json' };
import packed from '../data/codeParts.json' with { type: 'json' };
import metadata from '../data/explorerMetadata.generated.json' with { type: 'json' };

/** The live people and Explorer consume one set of baked figures and anchors. */
export const FIGURE_CATALOGUE = v.parse(FigureCatalogueSchema, {
  pack: { url: packed.url, rows: packed.rows },
  material: { name: 'ph-npc', roughness: 0.86, metalness: 0 },
  figures: Object.fromEntries((['ranger', 'miller', 'trader'] as const).map(kind => {
    const row = {
      id: `npc-${kind}`, name: `npc-${kind}`, feet: [0, 0, 0], yaw: 0,
      fallback: { geometry: 'body', material: 'body-material', glass: kind === 'ranger' ? 'glass' : null, glow: 'glow-material' },
      motion: NPC_FIGURE, talkHeight: NPC_FIGURE.talkHeight, collider: { kind: 'box', ...NPC_FIGURE.collider },
      rig: { skeleton: 'npc.legs.v1', clips: ['idle', 'idle.talk', 'idle.point', 'walk'], sockets: [] },
      joints: LEG_BONE_NAMES.map(bone => ({ id: `npc-${kind}.joint.${bone.toLowerCase()}`, bone })), sockets: [{ id: `npc-${kind}.hand`, joint: 'handR' }],
      visible: [], drawDistance: NPC_FIGURE.drawDistance,
      pointAt: [NATIVE_VIEW.KINGS_CLEARING.x, 0, NATIVE_VIEW.KINGS_CLEARING.z], points: kind === 'ranger',
    };
    const names = { ranger: 'ranger-hale', miller: 'miller-brandt', trader: 'trader-mott' };
    const surface = { name: `ph-npc-${kind}`, roughness: 0.85, metalness: 0, normalScale: [1, -1] };
    return [kind, { phone: { ...row, skin: { ...skins[kind].phone, surface } }, desktop: { ...row, skin: { ...skins[kind].desktop, surface } },
      body: packed.parts[`npc-${kind}`], glass: kind === 'ranger' ? packed.parts['npc-ranger-glass'] : null,
      card: { id: `pine-hollow/${names[kind]}`, name: metadata.names[kind], file: 'src/shards/pine-hollow/roster.ts', pipeline: ['hunyuan', 'code'], rig: { clips: ['idle', 'talk', 'point'] } } }];
  })),
});
