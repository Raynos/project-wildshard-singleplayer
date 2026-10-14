// SHARD-PLATFORM W2 C2 (look-family rows): the Blender cove's numbers as data (world/BlenderIsland.ts builds it; its
// terrain, props and clip GLSL stay trusted runtime in runtime/looks/islandLook.ts, G306): the tiers' files, tile counts
// and reaches, and the tier-free LOD, simplification, splat, file and placement-name rows.

/**
 * The tiers' numbers. Tiles per side: the casters (palms, rocks, logs; near + far copies) and the ground cover.
 * `cover`: ground cover thins out plant by plant instead of its tile blinking off (E117): every plant inside `near` stands;
 * past it each plant has its own edge in [near + grow, far], takes on the ground's colour and shade over the `grow` m
 * before it and is gone past it (E156), measured from its base. `big`: E156, the bushes, flowering bushes, hibiscus and
 * ferns keep their reach far longer on the phone (Jake's video, 2026-09-25, by the pier: "they still pop in").
 * `share`: the phone builds 70 % of the small cover (the palms, rocks and logs always build; the file is a prefix).
 */
export const ISLAND_TIERS = {
  phone: { casterTiles: 6, coverTiles: 8, share: 0.7, cover: { near: 16, far: 40, grow: 6 }, big: { near: 50, far: 80, grow: 10 }, coverUrl: '/assets/models/driftwood-blender/island-cover.phone.bin' },
  desktop: { casterTiles: 3, coverTiles: 4, share: 1, cover: { near: 100, far: 148, grow: 12 }, big: { near: 100, far: 148, grow: 12 }, coverUrl: '/assets/models/driftwood-blender/island-cover.desktop.bin' },
};

/**
 * The tier-free numbers. `lod`: past this (m, camera to the tile's rect) a caster tile draws its far copy (E90: the palms
 * keep their full model to 110 m on the phone too, and every far copy casts). `far`: E117, a caster's far copy is its near
 * one simplified to `ratio` of the triangles, never past `error` of its size (~8 cm on a palm). `coverDepth`: how much of
 * the cover the splat turns into optical depth. `coverFile`: the baked splat's magic ('WSIC') and version. `names`: which
 * placements set apart (E114: the shore boulders are Boulders.ts's, the small rocks rockKit's), which kinds cast, which
 * cover is big. `protoPrefix`: the prototypes' mesh names in island.glb.
 */
export const ISLAND_LOOK = {
  lod: 110,
  far: { ratio: 0.25, error: 0.01 },
  coverDepth: 0.6,
  coverFile: { magic: 0x43495357, version: 1 },
  names: { casterKinds: ['palm', 'rock', 'prop'], skip: '^rockb?\\d+$', apart: '^smallrock\\d+$', big: '^(bush|flowerbush|hibiscus|fern)\\d+$' },
  protoPrefix: 'proto_',
  meshPrefix: 'island-',
  coverKeys: { cover: 'island-cover', big: 'island-cover-big' },
  palmCell: 8,
};
