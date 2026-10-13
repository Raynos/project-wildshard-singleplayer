import { gridPage } from '@wildshard/game/shard/runtimeVariant';

/** G180 / G187 (Jake, E450): Pine's memory trim ships on in the grid and off standalone (SF61 retired its Debug row):
 *  the invisible RGB9_E5 sky keys (look/skyKeyFormat.ts) and the visible B1 / B2 / B4 / B5 cuts (pineSetCap,
 *  boot/gpuTable.ts, look/skyBackdrop.ts, life/index.ts) with view distance B (look/viewDistance.ts). */
export const pineMemoryTrim = (): boolean => gridPage();
/** B1: the largest edge of Pine's building / Poly Haven PBR sets: 512² on the phone (a tier cap ≤ 1024) with the trim on,
 *  a quarter of the 1024² bytes; else the tier's own cap */
export const pineSetCap = (tierCap: number): number => (tierCap <= 1024 && pineMemoryTrim() ? Math.min(512, tierCap) : tierCap);
