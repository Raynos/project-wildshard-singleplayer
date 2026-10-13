/** Stable wildlife identities shared by authored shapes and the native pose tail. */
export const KIND = { raven: 0, owl: 1, woodpecker: 2, hare: 4 } as const;
/** One of Pine Hollow's four authored wildlife shapes. */
export type WildKind = (typeof KIND)[keyof typeof KIND];
/** Vertex part identities interpreted by the unchanged wildlife shader. */
export const P = { body: 0, wingL: 1, wingR: 2, head: 3, legs: 4, tail: 5, hBody: 10, hHead: 11, hEars: 12, hHind: 13, hFore: 14 } as const;
/** A local-space point or direction in the authored model. */
export type V3 = readonly [number, number, number];
/** The hare's neck: its ears turn with the head about this point. */
export const HARE_NECK: V3 = [0, 0.235, 0.15];
/** Model order in the legacy word blocks and the authored GLB. */
export const WILD_BAKE_KINDS: readonly WildKind[] = [KIND.raven, KIND.owl, KIND.woodpecker, KIND.hare];
/** The retained legacy transport's counts and content identity. */
export interface WildRows {
  bin: string;
  bytes: number;
  kinds: { kind: WildKind; vertices: number; indices: number }[];
}
