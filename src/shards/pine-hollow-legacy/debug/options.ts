/** Pine's phone building sets keep the selected 512-pixel cap. */
export const pineSetCap = (tierCap: number): number => tierCap <= 1024 ? Math.min(512, tierCap) : tierCap;
