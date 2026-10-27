export const titleQuarantine: Readonly<{owner:string;openedAt:string;expiresAt:string;failures:readonly string[]}>;
/** Expiry restores the original blocking capture automatically. */
export function quarantinedTitle(shard:string,mode:string,now?:number):boolean;
