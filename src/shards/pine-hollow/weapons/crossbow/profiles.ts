export interface CrossbowProfile {
  family: 'crossbow'; quiver: number; speed: number; gravity: number; drag: number; radius: number; bury: number;
  reload: number; autoReload: number; cooldown: number; kick: number; adsBlend: number; adsMotion: number;
  maxFlying: number; maxStuck: number;
}
export const CROSSBOW_PROFILE: CrossbowProfile = {
  family: 'crossbow', quiver: 30, speed: 62, gravity: 9.8, drag: 0.012, radius: 0.03, bury: 0.08,
  reload: 1.35, autoReload: 1.4, cooldown: 0.3, kick: 0.8 * (Math.PI / 180), adsBlend: 0.18, adsMotion: 0.3,
  maxFlying: 8, maxStuck: 200,
};
