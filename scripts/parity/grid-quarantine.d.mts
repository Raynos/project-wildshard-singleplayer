export const gridQuarantine: Readonly<{owner:string;openedAt:string;expiresAt:string;failure:string;sha:string}>;
/** Expiry restores the original blocking grid case automatically. */
export function quarantinedGrid(mode:string,now?:number):boolean;
