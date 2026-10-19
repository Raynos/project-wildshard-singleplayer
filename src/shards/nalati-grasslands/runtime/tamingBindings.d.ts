import type * as THREE from 'three';
/** A live horse identity; rendering and native collision ownership stay with the caller. */
export interface TamingHorse {
  readonly entityId: string; kind: string; scale: number; alive: boolean; yaw: number;
  readonly position: THREE.Vector3; readonly mem: Record<string, number>;
  readonly headWorld: (out: THREE.Vector3) => THREE.Vector3; readonly setMotion: (yaw: number, speed: number, rate: number) => void;
}
/** The actual shipping herd's trust, alert, stallion and driven-away laws. */
export interface TamingHerd<A extends TamingHorse> {
  readonly stallion: A | null; stallionState: string; cx: number; cz: number; trust: number; alert: number; alertOwned: boolean; mode: string;
  readonly addTrust: (value: number) => void; readonly leadAway: (x: number, z: number) => void; readonly releaseStallion: () => void;
}
/** The shipping taming HUD values are observations of the law, never decisions. */
export interface TamingObservation { trust: number | null; alert: number; ear: THREE.Vector3 | null; round: number | null; balance: number; danger: boolean; offer: boolean }
/** Only Nalati's own page/native adapters supply the horse, rider, camera observations and random draws. */
export interface NalatiTamingPorts<A extends TamingHorse, H extends TamingHerd<A>> {
  readonly programs: RidingPrograms;
  readonly bond: { readonly read: () => string | null; readonly write: (value: string) => void };
  readonly player: { readonly position: THREE.Vector3; crouching: boolean; yaw: number; pitch: number; readonly keys: ReadonlySet<string>;
    readonly camera: { readonly position: THREE.Vector3; readonly getWorldDirection: (out: THREE.Vector3) => THREE.Vector3 } };
  readonly mount: { readonly mounted: boolean; readonly horse: A | null; breakShake: number; breakRoll: number;
    readonly mount: (horse: A, breaking?: boolean) => boolean; readonly dismount: (thrown?: boolean) => void; readonly addMountable: (horse: A, name: string) => void; readonly removeMountable: (horse: A) => void };
  readonly hud: { readonly offer: boolean; readonly lean: number };
  readonly herds: () => readonly H[]; readonly rest: { x: number; z: number; face: { x: number; z: number } };
  readonly wind: () => { x: number; z: number; strength: number }; readonly random: () => number;
  readonly spawnBonded: (x: number, z: number, yaw: number, argymaq: boolean) => A; readonly hideStallion: (horse: A) => void; readonly retireBonded: (horse: A) => void;
  readonly hurt: (damage: number) => void; readonly toast?: (text: string) => void;
}
/** Admitted v1 projections and their numeric continuation defaults. */
export interface RidingPrograms { approach: unknown; breaking: unknown; riding: unknown; initial: Record<string, number> }
