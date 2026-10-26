interface ShelterPlaces {
  readonly rows: readonly {
    readonly colliders: readonly {
      readonly hw: number;
      readonly hd: number;
      readonly yTop: number;
      readonly yBottom: number;
      readonly x: number;
      readonly z: number;
    }[];
  }[];
}

/** Derive the original ordered native shelter circles from caller-owned placed colliders. */
export function nalatiNativeShelters(places: ShelterPlaces): [number, number, number][] {
  const shelters: [number, number, number][] = [];
  for (const place of places.rows) for (const row of place.colliders) {
    if (Math.abs(row.hw - row.hd) > .01 || row.hw < 2.2 || row.hw > 3.6 || row.yTop - row.yBottom < 2.5) continue;
    if (shelters.some(([x, z]) => Math.abs(x - row.x) < .1 && Math.abs(z - row.z) < .1)) continue;
    shelters.push([row.x, row.z, row.hw / .93]);
  }
  return shelters;
}
