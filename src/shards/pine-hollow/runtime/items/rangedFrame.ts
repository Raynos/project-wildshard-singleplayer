/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  lever: {clock:'frame',fovWhen:'active',recoil:{decay:10,attack:30,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true,readout:{range:150,mask:3,held:true,posed:false}},
} as const;

/** Existing flight/hitscan tracer allocations and source-clock expiry. */
export const RANGED_TRACE = {
  segment: {mode:'segment',points:2,width:3,color:[1,0,0],order:1200,lifetime:.5,fade:1,markerScale:0},
} as const;

export const RANGED_FLASH = {
  lever: {size:.2,y:0,z:-.02,secondaryZ:-.06,secondaryScale:[1.5,.55,1],lightY:.03,lightZ:.1},
} as const;

export const RANGED_HIT = {lever:{muzzle:[0,0,0]}} as const;
export const RANGED_BRASS = {lever:{velocity:[['up',2.6,.6],['right',.8,.5],['forward',-.6,.2]],spin:[[18,0,12],[0,-.5,8],[0,-.5,8]],rotation:[1,0,0,-Math.PI/2],floorOffset:.006}} as const;
