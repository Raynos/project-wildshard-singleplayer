/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  crossbow: {clock:'frame',fovWhen:'always',recoil:{decay:9,attack:40,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true},
  lever: {clock:'frame',fovWhen:'active',recoil:{decay:10,attack:30,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true},
} as const;

/** Existing flight/hitscan tracer allocations and source-clock expiry. */
export const RANGED_TRACE = {
  trail: {mode:'trail',roster:8,points:2048,width:8,color:[1,0,0],order:1200,lifetime:6,fade:1.5,markerScale:.32},
  segment: {mode:'segment',points:2,width:3,color:[1,0,0],order:1200,lifetime:.5,fade:1,markerScale:0},
} as const;
