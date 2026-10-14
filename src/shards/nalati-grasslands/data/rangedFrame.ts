/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  magazine: {clock:'frame',fovWhen:'active',recoil:{decay:14,attack:60,recovery:9},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true},
} as const;
