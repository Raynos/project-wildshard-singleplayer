import type { AskMap as NativeAskMap } from '@wildshard/engine/events/maps';

declare module '@wildshard/engine/events/maps' {
  interface AskMap extends Pick<NativeAskMap, never> { 'weather.rain': readonly [{ readonly id: string; readonly rain: number }, { readonly id: string; readonly rain: number }]; }
}
