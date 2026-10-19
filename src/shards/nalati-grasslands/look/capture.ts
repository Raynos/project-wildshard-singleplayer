import { StaticCapture, staticCaptureUniforms } from '@wildshard/game/looks/staticCapture';
import rows from '../boot/staticCapture.generated.json' with { type: 'json' };
import { TIER } from '@wildshard/engine/core/tier';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Scene, Texture } from 'three';

export const bakeUniforms = staticCaptureUniforms(rows);
export const PHONE_STATIC_OFF_CSM = rows.staticOffCsm[TIER];
export function createStaticCapture(renderer: Renderer, scene: Scene, height: Texture, scope: Scope): StaticCapture {
  return new StaticCapture(renderer, scene, height, scope, rows, bakeUniforms);
}
