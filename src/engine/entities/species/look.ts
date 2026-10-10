import type * as THREE from 'three';
import type { SpeciesRow } from '../../ai/species';
import { registeredSpecies, validateCreatureBones, type SpeciesDef, type VariantDef, type BoneDef, type FurStyle } from './registry';
import type { SkyRig as Sky } from '../../world/skyRig';
import type { AnimalMaterial } from '../AnimalFactory';
import type { Scope } from '../../app/scope';

export interface EyeSpot { centre: THREE.Vector3; radius: number }
export interface CreatureHull {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  bones: BoneDef[]; overgrown: boolean; doubleSided?: boolean; fur?: Partial<FurStyle>;
}
export interface SpeciesLook extends Pick<SpeciesDef, 'rigContract' | 'fur' | 'build' | 'pose' | 'gait' | 'postPose' | 'rig' | 'animate' | 'damageMul' | 'eyeGlow' | 'eyeGlowIntensity'> {
  id: string; species: string; kind: string;
  /** creature memory a specimen is stood up with in the Model Explorer (a creature that waits hidden is shown risen) */
  standMem?: Readonly<Record<string, number>>;
  variants?: Readonly<Record<string, Pick<VariantDef, 'tint' | 'fur' | 'traits'>>>;
  material?: (sky: Sky, glow?: [number, number, number], intensity?: number) => AnimalMaterial;
  hasSkin?: (variant: VariantDef) => boolean;
  loadSkin?: (variant: VariantDef) => Promise<void>;
  preload?: () => Promise<void>;
  /** resolves once the work `skin` started for the hulls made so far is done (a coat painted in slices): a herd waits for
   *  it before it is shown */
  settle?: () => Promise<void>;
  skin?: (variant: VariantDef, bones: readonly BoneDef[], eyes: readonly EyeSpot[]) => CreatureHull | null;
}

/** The legacy view/body adapter is assembled at the factory boundary, after kit registration. */
export function speciesWithLook(row: SpeciesRow, look: SpeciesLook): SpeciesDef {
  const variant = (value: VariantDef): VariantDef => ({ ...value, ...look.variants?.[value.id] });
  return { ...look, ...row, variants: row.variants.map(variant),
    ...(row.spawnOnly === undefined ? {} : { spawnOnly: row.spawnOnly.map(variant) }) };
}

interface Scoped<T> { value: T; scope: Scope }
/** Row/look registrations are resident-owned; resolution and cached adapters follow the active level. */
export class SpeciesService {
  private readonly rows: Scoped<SpeciesRow>[] = [];
  private readonly looks: Scoped<SpeciesLook>[] = [];
  private cache = new WeakMap<Scope, Map<string, SpeciesDef>>();
  private readonly active: () => Scope | null;
  constructor(active: () => Scope | null) { this.active = active; }
  registerRow(value: SpeciesRow, scope: Scope): void { this.add(this.rows, value, scope); }
  registerLook(value: SpeciesLook, scope: Scope): void {
    validateCreatureBones(`${value.species} (${value.kind})`, value.rigContract.sockets);
    this.add(this.looks, value, scope);
  }
  private add<T extends { id: string }>(list: Scoped<T>[], value: T, scope: Scope): void {
    if (scope.disposed) throw new Error('Cannot register species on a disposed scope');
    if (list.some((entry) => entry.scope === scope && entry.value.id === value.id)) throw new Error(`Duplicate species row: ${value.id}`);
    const entry = { value, scope }; list.push(entry); this.cache = new WeakMap();
    scope.onDispose(() => { const i = list.indexOf(entry); if (i !== -1) list.splice(i, 1); this.cache = new WeakMap(); });
  }
  get(kind: string): SpeciesDef | undefined {
    const scope = this.active(); if (scope === null) return undefined;
    const cached = this.cache.get(scope)?.get(kind); if (cached !== undefined) return cached;
    const row = this.rows.slice().reverse().find((entry) => entry.scope.belongsTo(scope) && entry.value.kind === kind)?.value;
    const look = this.looks.slice().reverse().find((entry) => entry.scope.belongsTo(scope) && entry.value.kind === kind)?.value;
    if (row === undefined && look === undefined) return undefined;
    let resolved: SpeciesDef;
    if (row !== undefined && look !== undefined) resolved = speciesWithLook(row, look);
    else {
      const base = registeredSpecies(kind);
      resolved = row !== undefined ? speciesWithLook(row, { ...base, id: `default.look.${kind}`, species: row.id,
        variants: Object.fromEntries([...base.variants, ...(base.spawnOnly ?? [])].map((v) => [v.id, {
          ...(v.tint === undefined ? {} : { tint: v.tint }), ...(v.fur === undefined ? {} : { fur: v.fur }),
          ...(v.traits === undefined ? {} : { traits: v.traits }),
        }])) })
        : look !== undefined ? speciesWithLook({ ...base, id: kind }, look) : base;
    }
    const map = this.cache.get(scope) ?? new Map<string, SpeciesDef>(); map.set(kind, resolved); this.cache.set(scope, map);
    return resolved;
  }
  look(kind: string): SpeciesLook | undefined {
    const scope = this.active();
    return scope === null ? undefined : this.looks.slice().reverse().find((entry) => entry.scope.belongsTo(scope) && entry.value.kind === kind)?.value;
  }
  preloads(): readonly (() => Promise<void>)[] {
    const scope = this.active(); if (scope === null) return [];
    return [...new Set(this.looks.filter((entry) => entry.scope.belongsTo(scope)).flatMap((entry) => entry.value.preload ? [entry.value.preload] : []))];
  }
  /** The active level's looks' `settle` hooks (each once). */
  settles(): readonly (() => Promise<void>)[] {
    const scope = this.active(); if (scope === null) return [];
    return [...new Set(this.looks.filter((entry) => entry.scope.belongsTo(scope)).flatMap((entry) => entry.value.settle ? [entry.value.settle] : []))];
  }
  /** A registered model hull can be replaced by the look's procedural builder. */
  hasProceduralFallback(): boolean {
    const scope = this.active();
    return scope !== null && this.looks.some((entry) => entry.scope.belongsTo(scope) && entry.value.skin !== undefined);
  }
}
