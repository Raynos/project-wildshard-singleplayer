/**
 * Kurgan balbal — the Golden King's phase-II adds (elites-and-bosses.md: "two balbals step out of the wall niches, 2.5 m,
 * 220 hp each, amber cracks, the sabre breaks them").
 *
 * B13 (the boss row) built a minimal stone warrior here, kind `kurgan-balbal`, until B11's balbal existed. It does now:
 * the King's adds ARE the shard's balbal warriors — `src/entities/species/balbal.ts` (kind `balbal`), which reads the same
 * spawn fields the fight sets (`mem.floorY`, `mem.emergeT`, the chamber bounds `mem.minX / maxX / minZ / maxZ`) and runs
 * the niche step-out + the stalk / slam inside the chamber. This file only keeps the old import working:
 * `KURGAN_BALBAL` names that species, so src/nalati/kurganBoss.ts spawns `animals.spawn(KURGAN_BALBAL, x, z, yaw, 'warrior')`
 * unchanged. (The Golden Bow's ×2 / ×3 already recognises both kind strings.)
 */
export { BALBAL as KURGAN_BALBAL } from './balbal';
