/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  magazine: {clock:'frame',fovWhen:'active',recoil:{decay:14,attack:60,recovery:9},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true},
} as const;

/** Straight-shot style; the profile keeps its live tracer lifetime and roster. */
export const RANGED_TRACE = {
  segment: {mode:'segment',points:2,width:3,color:[1,0,0],order:1200,lifetime:.5,fade:1,markerScale:0},
} as const;
