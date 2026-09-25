/**
 * The shared FX program: shader fx for ground tells, shafts, rings and beams (one program for every mode; `mode` picks
 * the look). It lives in Nalati's src/world/nalati/KurganDungeon.ts; Pine Hollow imports it from here (the remaster
 * ported a copy before the Nalati merge — now one source, one program).
 */
export { FX, fxMaterial, annulus, type FxMaterial, type FxMode } from './nalati/KurganDungeon';
