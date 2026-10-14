/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  crossbow: {clock:'frame',fovWhen:'always',recoil:{decay:9,attack:40,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true,readout:{range:120,mask:3,held:false,posed:true}},
  lever: {clock:'frame',fovWhen:'active',recoil:{decay:10,attack:30,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true,readout:{range:150,mask:3,held:true,posed:false}},
} as const;

/** Existing flight/hitscan tracer allocations and source-clock expiry. */
export const RANGED_TRACE = {
  trail: {mode:'trail',roster:8,points:2048,width:8,color:[1,0,0],order:1200,lifetime:6,fade:1.5,markerScale:.32},
  segment: {mode:'segment',points:2,width:3,color:[1,0,0],order:1200,lifetime:.5,fade:1,markerScale:0},
} as const;

export const RANGED_FLASH = {
  lever: {size:.2,y:0,z:-.02,secondaryZ:-.06,secondaryScale:[1.5,.55,1],lightY:.03,lightZ:.1},
} as const;
export const RANGED_RELOAD = {crossbow:{mode:'quiver'}} as const;
