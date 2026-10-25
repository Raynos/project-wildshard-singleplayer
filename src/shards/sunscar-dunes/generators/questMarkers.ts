import { signalManifestMetadata } from './manifestGround';
import { SCOUT_AT } from './rows/flags';
import { BRAZIERS, TOWER, WELL } from "./layout";

export type QuestMarkers = Readonly<Record<string, {poi:'world';x:number;y:number;z:number}>>;
/** The original quest anchor fields, supplied by the same verified world bake as its scenes. */
export interface QuestWorld {
  readonly caravan: { readonly anchors: { readonly logbook: readonly number[] } };
  readonly well: { readonly anchors: { readonly y: number } };
  readonly tower: { readonly anchors: { readonly deckY: number } };
  readonly braziers: { readonly braziers: readonly { readonly y: number }[] };
}
/** Quest points retain every numeric addition in the original order. */
export function signalQuestMarkers(world: QuestWorld): QuestMarkers {
const { caravan, well, tower, braziers } = world;
const ground = signalManifestMetadata();

const [logX, logY, logZ] = caravan.anchors.logbook;
if (caravan.anchors.logbook.length !== 3 || logX === undefined || logY === undefined || logZ === undefined
  || !Number.isFinite(logX) || !Number.isFinite(logY) || !Number.isFinite(logZ)) throw new Error('Invalid authored logbook anchor');

return {
  scout: {poi:'world',x:SCOUT_AT.x,y:ground.heights.scout,z:SCOUT_AT.z},
  logbook: {poi:'world',x:logX,y:logY+0.4,z:logZ},
  well: {poi:'world',x:WELL.x,y:(well.anchors.y+1)+0.6,z:WELL.z},
  tower: {poi:'world',x:TOWER.x-0.4,y:(tower.anchors.deckY+1.1)+1,z:TOWER.z-0.5},
  ...Object.fromEntries(BRAZIERS.map((row,i)=>{const anchor=braziers.braziers[i];if(anchor===undefined)throw new Error('Missing authored waymark');return [`waymark.${String(i)}`,{poi:'world' as const,x:row.x,y:(anchor.y+1.6)+0.8,z:row.z}];})),
};

}
