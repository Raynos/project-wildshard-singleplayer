import * as THREE from 'three';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import { FINISH_CARDS } from '../const';
import * as v from 'valibot';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { codePart } from '../world/codeParts';

/** Pine's authored material finishes and legendary sources; application and ownership are generic. */
export type SkinId = 'ghost-stag' | 'hollow-ash' | 'ironhide' | 'scarback-furnace' | 'blackpaw' | 'imperial' | 'warden';

const finishId = v.picklist(['ghost-stag', 'hollow-ash', 'ironhide', 'scarback-furnace', 'blackpaw', 'imperial', 'warden']);
const finite = v.pipe(v.number(), v.finite()), text = v.pipe(v.string(), v.maxLength(512));
const override = v.strictObject({ color: v.exactOptional(finite), emissive: v.exactOptional(finite), emissiveIntensity: v.exactOptional(finite),
  roughness: v.exactOptional(finite), metalness: v.exactOptional(finite), envMapIntensity: v.exactOptional(finite), plain: v.exactOptional(v.boolean()) });
const finish = v.strictObject({ id: finishId, weapon: v.picklist(['crossbow', 'rifle']), name: text, blurb: text,
  dropsFrom: v.exactOptional(v.strictObject({ kind: text, variant: text })), mats: v.record(text, override) });
/** Exact finish identities; values are material data, never callbacks or executable recipes. */
export const FinishRowsSchema = v.strictObject({ 'ghost-stag': finish, 'hollow-ash': finish, ironhide: finish,
  blackpaw: finish, imperial: finish, warden: finish, 'scarback-furnace': finish });
type SkinRows = Record<SkinId, SkinDef & { id: SkinId; weapon: 'crossbow' | 'rifle' }>;
let admitted: SkinRows | null = null;
/** The page and cold Explorer prepare the same named rows before creating any finished material. */
export async function loadPineFinishes(product: ShardProduct): Promise<void> {
  const rows = v.parse(FinishRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file('loadout/finishes.json'))));
  const entries = Object.entries(rows);
  for (let i = 0; i < 7; i++) {
    const entry = entries[i];
    if (entry === undefined || entry[0] !== entry[1].id) throw new Error('Pine finish key differs from its identity');
  }
  admitted = { ...rows, 'ghost-stag': { ...rows['ghost-stag'], extras: (root, mat) => antlerTines(root, mat('xbow-prod') ?? mat('xbow-iron')) } };
}
export async function preparePineFinishes(): Promise<void> { await loadPineFinishes(await loadFirstPartyProduct('pine-hollow')); }
/** Refuse access before admission; an absent table never produces an empty or default finish roster. */
export function pineSkins(): SkinRows { if (admitted === null) throw new Error('Pine finishes are not admitted'); return admitted; }
export const pineSkinRows = (): readonly SkinDef[] => Object.values(pineSkins());
/** This small card identity list is needed to list Explorer variants before product admission. */
export const PINE_FINISH_VARIANTS = Object.keys(FinishRowsSchema.entries).map(id => {
  const card = FINISH_CARDS.find(row => row.id === id);
  if (card === undefined) throw new Error('Pine finish has no pre-admission variant card');
  return { id: card.id, name: card.name, weapon: card.icon === 'lever' ? 'rifle' as const : 'crossbow' as const };
});

/** Ghost Stag: antler tines growing up and back from the prod (the limb curve from Crossbow.ts) */
function antlerTines(root: THREE.Object3D, mat: THREE.Material | undefined): THREE.Object3D[] {
  if (!mat) return [];
  const mesh = new THREE.Mesh(codePart('ghost-stag-tines'), mat); mesh.name = 'skin-antlers';
  root.add(mesh);
  return [mesh];
}
