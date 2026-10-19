import type { readPracticePresentation } from './practicePresentation';

type Presentation = ReturnType<typeof readPracticePresentation>;

/** Explicit arena presentation only. Omission retains the original outdoor fill. */
export function practiceHemisphere(profile: Presentation['arenaLighting']): { sky: number; ground: number; intensity: number } | undefined {
  return profile === undefined ? undefined : { sky: profile.sky, ground: profile.ground, intensity: profile.intensity };
}

/** Optional contact-scale AO; an absent pass (the ordinary phone tier) stays absent. */
export function configurePracticeOcclusion(pass: { configuration: { aoRadius: number; intensity: number } } | null,
  profile: Presentation['arenaOcclusion']): void {
  if (pass === null || profile === undefined) return;
  pass.configuration.aoRadius = profile.radius;
  pass.configuration.intensity = profile.intensity;
}
