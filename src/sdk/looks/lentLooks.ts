import * as platform from '@wildshard/game/shardfile/lentLooks';

/** The game owns shared look lends; runtime facades preserve the defining API. */
export type LentLooks = platform.LentLooks;
export const lendLooks: typeof platform.lendLooks = platform.lendLooks;
export const lentLooksOf: typeof platform.lentLooksOf = platform.lentLooksOf;
export const hasLentLook: typeof platform.hasLentLook = platform.hasLentLook;
export const lentLook: typeof platform.lentLook = platform.lentLook;
export const lentMappedLook: typeof platform.lentMappedLook = platform.lentMappedLook;
export const setLentParam: typeof platform.setLentParam = platform.setLentParam;
export const setLentTexture: typeof platform.setLentTexture = platform.setLentTexture;
export const lentToon: typeof platform.lentToon = platform.lentToon;
export const pushLentParams: typeof platform.pushLentParams = platform.pushLentParams;
