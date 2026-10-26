import { KING_FIELDS } from './kingDecision';
/** Mutable native continuations use the template state contract; the platform owns their durable writes. */
export const PINE_STATE: { readonly version: 1; readonly sharedOwner: "host"; readonly playerKey: "actorId"; readonly player: readonly []; readonly shared: readonly [...{ id: number; name: string; type: "f64"; privacy: "public"; default: number; min: number; max: number; }[], { readonly id: 1; readonly name: "pine.lodge"; readonly type: "string"; readonly privacy: "host"; readonly default: "null"; }, { readonly id: 2; readonly name: "pine.loadout"; readonly type: "string"; readonly privacy: "host"; readonly default: "{}"; }, { readonly id: 3; readonly name: "pine.bosses"; readonly type: "string"; readonly privacy: "host"; readonly default: "{}"; }, { readonly id: 4; readonly name: "pine.elites"; readonly type: "string"; readonly privacy: "host"; readonly default: "{}"; }, { readonly id: 5; readonly name: "pine.feat-counts"; readonly type: "string"; readonly privacy: "host"; readonly default: "{}"; }]; } = { version: 1, sharedOwner: 'host', playerKey: 'actorId', player: [], shared: [
  ...KING_FIELDS,
  { id: 1, name: 'pine.lodge', type: 'string', privacy: 'host', default: 'null' },
  { id: 2, name: 'pine.loadout', type: 'string', privacy: 'host', default: '{}' },
  { id: 3, name: 'pine.bosses', type: 'string', privacy: 'host', default: '{}' },
  { id: 4, name: 'pine.elites', type: 'string', privacy: 'host', default: '{}' },
  { id: 5, name: 'pine.feat-counts', type: 'string', privacy: 'host', default: '{}' },
] } as const;
