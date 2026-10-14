/** Native rest contracts; the author recipe supplies only named part and anchor rows. */
export const PLACE_BINDINGS = {
  caravan:{root:'group',colliders:'colliders',logbookAt:'vector',lampAt:'vector'},
  well:{root:'group',colliders:'colliders',bucket:'group',rope:'mesh',jar:'mesh',crankAt:'vector',jarAt:'vector',drop:'number'},
  tower:{root:'group',colliders:'colliders',fire:'group',light:'point-light',brazierAt:'vector',deckY:'number'},
  brazier:{root:'group',colliders:'colliders',fire:'group',oil:'mesh',bowlAt:'vector',glowAt:'vector'},
} as const;
