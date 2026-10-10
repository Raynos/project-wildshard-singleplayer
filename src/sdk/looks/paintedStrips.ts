import { loadPaintedStrips as platformLoadPaintedStrips } from '@wildshard/game/systems/looks/paintedStrips';

/** Seamless 360° painted sky strips as sRGB textures, all or nothing (null when any is missing; the loaded ones are freed). */
export const loadPaintedStrips: typeof platformLoadPaintedStrips = platformLoadPaintedStrips;
