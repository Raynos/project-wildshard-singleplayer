import type { LookComposeContext } from '@wildshard/engine/render/look';
import type { NdRenderHandle } from './render';
import { BLEED } from './render/jiehua';

/** Each composition owns its listeners and restores the studio's temporary air changes on unload. */
export function installRenderEvents(c: Pick<LookComposeContext, 'app' | 'scope'>, handle: Pick<NdRenderHandle, 'jiehua' | 'shared'>): void {
  let air: { base: number; depths: number[] } | null = null;
  const restore = (): void => {
    if (air === null) return;
    const u = handle.shared.u, saved = air;
    u.uFogBase.value = saved.base;
    u.uBands.value.forEach((band, i) => { band.z = saved.depths[i] ?? band.z; });
    air = null;
  };
  c.app.events.on('practice.active', (active) => {
    handle.jiehua.u.uRain.value.x = active ? 0 : BLEED.rain;
    handle.jiehua.blendMode.opacity.value = active ? 0 : 1;
  }, c.scope);
  c.app.events.on('explore.studio', (on) => {
    const u = handle.shared.u;
    handle.jiehua.u.uRain.value.x = on ? 0 : BLEED.rain;
    if (on && air === null) {
      air = { base: u.uFogBase.value, depths: u.uBands.value.map((band) => band.z) };
      u.uFogBase.value = 0;
      for (const band of u.uBands.value) band.z = 0;
    } else if (!on) restore();
  }, c.scope);
  c.scope.onDispose(restore);
}
