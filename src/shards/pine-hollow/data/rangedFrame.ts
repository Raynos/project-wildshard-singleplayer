/** Authored held-camera timing; reload/contact/flight remain authoritative weapon phases. */
export const RANGED_FRAME = {
  crossbow: {clock:'frame',fovWhen:'always',recoil:{decay:9,attack:40,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true},
  lever: {clock:'frame',fovWhen:'active',recoil:{decay:10,attack:30,recovery:6},lag:{gain:.5,clampYaw:.12,clampPitch:.1,k:220,c:20},clampAfter:true},
} as const;
