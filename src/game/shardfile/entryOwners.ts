import type { MountedArsenal } from '../loadout/mounted';
/** Client-only concrete loans between compiled entry capabilities. No shard
 * callbacks, reflected paths, clocks or continuation state live in this book. */
import type { Object3D, Vector3 } from 'three';
import type { ArenaScriptEncounter } from '../boss/arenaScript';
import type { ModelSiteLayout, Placed } from '@wildshard/engine/models/place';
import type { ForestWeatherRig } from '../weather/forest';
import type { FixedDraws } from '../models/fixedDraws';
import type { RopeDeckSite } from '../models/ropeDeckSite';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import type { QuestSpawnResult } from '../quest/chapterDirector';
import type { Scope } from '@wildshard/engine/app/scope';
import type { RopeChain } from '@wildshard/engine/physics/ropeChain';
import type { AmbientGroup } from '../ambient/flock';
import type { AmbientFlockDraw } from '../ambient/ambientFlock';
import type { CollectionCatalogue } from '../models/collectionDisplay';
import type { HeldClaims } from '../loadout/claims';
import type { QuestPageComposition } from '../quest/pageComposition';
import type { QuestPageReference } from '../quest/pageReference';
import type { CaveInterior } from './caveInterior';
import type { ForestPage } from './forestPage';
import type { SceneHandles } from './sceneHandles';
import type { LivingBuildings } from './livingBuildings';

/** A kind names a concrete platform owner, never an arbitrary shard result. */
export interface EntryOwnerTypes {
  scenes: SceneHandles;
  'world-weather': ForestWeatherRig;
  'world-point': Vector3 | null;
  'arena-script': ArenaScriptEncounter;
  buildings: LivingBuildings;
  forest: ForestPage;
  cave: CaveInterior;
  quest: QuestPageComposition;
  'quest-reference': QuestPageReference;
  object: Object3D;
  placed: readonly Placed[];
  site: ModelSiteLayout['anchors'];
  floor: ModelSiteLayout['floorHeightAt'];
  'fixed-draws': FixedDraws;
  chain: RopeChain;
  'rope-deck': ReturnType<RopeDeckSite['place']>;
  ambient: AmbientGroup;
  'ambient-draw': AmbientFlockDraw;
  collection: CollectionCatalogue;
  claims: HeldClaims;
  'mounted-arsenal': MountedArsenal;
  animals: AnimalManager;
  sounds: DeclaredSoundBank;
  'quest-spawns': QuestSpawnResult;
}
export type EntryOwnerKind = keyof EntryOwnerTypes;
interface Loan<T> { readonly owner: Scope; readonly value: T }
type Owners = { [K in EntryOwnerKind]: Map<string, Loan<EntryOwnerTypes[K]>> };
const books = new WeakMap<Scope, Owners>();

function check(scope: Scope, id: string): void {
  if (scope.disposed || scope.disposing) throw new Error('Entry owner scope has ended');
  if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,255}$/u.test(id)) throw new Error('Invalid entry owner id');
}
function book(scope: Scope): Owners {
  let value = books.get(scope);
  if (value === undefined) {
    value = { scenes: new Map(), 'world-weather': new Map(), 'world-point': new Map(), 'arena-script': new Map(), buildings: new Map(), forest: new Map(), cave: new Map(), quest: new Map(), 'quest-reference': new Map(),
      object: new Map(), placed: new Map(), site: new Map(), floor: new Map(), 'fixed-draws': new Map(), chain: new Map(), 'rope-deck': new Map(), ambient: new Map(), 'ambient-draw': new Map(), collection: new Map(), claims: new Map(), 'mounted-arsenal': new Map(),
      animals: new Map(), sounds: new Map(), 'quest-spawns': new Map() };
    books.set(scope, value);
  }
  return value;
}
function loan<K extends EntryOwnerKind>(scope: Scope, kind: K, id: string): Loan<EntryOwnerTypes[K]> {
  check(scope, id);
  const value = books.get(scope)?.[kind].get(id);
  if (value === undefined || value.owner.disposed || value.owner.disposing) throw new Error(`Missing live entry owner: ${kind}/${id}`);
  return value;
}
function publish<K extends EntryOwnerKind>(scope: Scope, kind: K, id: string, value: Loan<EntryOwnerTypes[K]>): void {
  check(scope, id);
  const entries: Map<string, Loan<EntryOwnerTypes[K]>> = book(scope)[kind];
  if (entries.has(id)) throw new Error(`Duplicate entry owner: ${kind}/${id}`);
  entries.set(id, value);
  let forgetOwner = (): void => undefined, forgetBorrower = (): void => undefined;
  const release = (): void => { entries.delete(id); forgetOwner(); forgetBorrower(); };
  forgetBorrower = scope.capture('disposers', release);
  if (value.owner !== scope) forgetOwner = value.owner.capture('disposers', release);
}
/** Called by the platform constructor after its data-backed resource is ready.
 * Publication lends the value; its original host alone disposes the resource. */
export function publishEntryOwner<K extends EntryOwnerKind>(scope: Scope, kind: K, id: string, value: EntryOwnerTypes[K]): void {
  publish(scope, kind, id, { owner: scope, value });
}
/** Entered capabilities borrow only from their own live construction ancestor.
 * The original owner survives transitive loans; either scope ending drops the
 * loan and both cleanup registrations without disposing a borrowed resource. */
export function lendEntryOwner(scope: Scope, source: Scope, kind: EntryOwnerKind, id: string): void {
  const value = loan(source, kind, id);
  if (scope === source || !scope.belongsTo(value.owner)) throw new Error('Entry loan requires its construction ancestor');
  publish(scope, kind, id, value);
}
/** Resolve a row id in one exact owner scope; there is no ambient/global fallback. */
export function entryOwner<K extends EntryOwnerKind>(scope: Scope, kind: K, id: string): EntryOwnerTypes[K] {
  return loan(scope, kind, id).value;
}
