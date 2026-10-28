import type { bakePinePainted } from './paintedPage';
import type { bakePineUndergrowth } from './undergrowthPaintPage';

declare global {
  interface Window {
    readonly PinePainted: { readonly bakePinePainted: typeof bakePinePainted };
    readonly PineUndergrowth: { readonly bakePineUndergrowth: typeof bakePineUndergrowth };
  }
}
