/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  magazine: {clock:'frame',fovWhen:'active',recoil:{decay:14,attack:60,recovery:9},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true,readout:{range:120,mask:3,held:true,posed:false}},
} as const;

/** Straight-shot style; the profile keeps its live tracer lifetime and roster. */
export const RANGED_TRACE = {
  segment: {mode:'segment',points:2,width:3,color:[1,0,0],order:1200,lifetime:.5,fade:1,markerScale:0},
} as const;

export const RANGED_FLASH = {
  magazine: {y:.002,z:-.02,secondaryZ:-.06,secondaryScale:[1.4,.6,1],lightY:.03,lightZ:.1},
} as const;
export const RANGED_RELOAD = {magazine:{mode:'magazine'}} as const;

export const RANGED_HIT = {magazine:{muzzle:[0,.004,0]}} as const;
export const RANGED_BRASS = {magazine:{velocity:[['right',2.2,.8],['up',1.6,.6],['forward',-.4,.3]],spin:[[0,-.5,30],[0,-.5,30],[0,-.5,30]],rotation:[0,1,0,Math.PI/2],floorOffset:.005}} as const;
