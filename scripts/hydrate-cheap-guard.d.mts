/** Generate absent build-time JSON from the immutable archive's registered
 * source, requiring complete output files and a genuine cold run below 30 s. */
export function hydrateCheapGuardData(root:string):Promise<void>;
