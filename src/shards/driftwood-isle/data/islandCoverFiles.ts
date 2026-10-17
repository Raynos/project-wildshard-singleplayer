/** Required immutable tier cover looks (generators/islandCover.ts `bakeFullIslandCover`): the cover map (half-float RGBA
 *  `texture`, sampled through `groundRect`), then per terrain its cover bytes, `parts` [offset, vertices]: the faceted
 *  ground first, then the island's terrain tiles in load order. */
export const ISLAND_COVER_FILES = {
  "phone": {"url":"/assets/driftwood-isle/baked/island-cover-af19c5925055abf015db6d775eeb8d0c63ef027d1790decf057a0aa37978d5ee.bin","hash":"af19c5925055abf015db6d775eeb8d0c63ef027d1790decf057a0aa37978d5ee","bytes":465723,"used":11949,"texture":{"width":102,"height":98},"groundRect":[0.5196078431372549,0.46938775510204084,0.0024509803921568627,0.002551020408163265],"parts":[[79968,65536],[407648,2850],[421898,2907],[436433,2900],[450933,2958]]},
  "desktop": {"url":"/assets/driftwood-isle/baked/island-cover-c9b6eb32cfb3f315cc609a8f1c2061001befeefa6aadf871c982e5c24569a3c3.bin","hash":"c9b6eb32cfb3f315cc609a8f1c2061001befeefa6aadf871c982e5c24569a3c3","bytes":635648,"used":16675,"texture":{"width":102,"height":98},"groundRect":[0.5196078431372549,0.46938775510204084,0.0024509803921568627,0.002551020408163265],"parts":[[79968,65536],[407648,11400],[464648,11400],[521648,11400],[578648,11400]]}
} as const;
