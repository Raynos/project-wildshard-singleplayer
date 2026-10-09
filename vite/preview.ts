import type { UserConfig } from 'vite';
import { pwaPlugin } from './pwa-plugin';
import { rapierPreviewPlugin } from './rapier';

/** Serve an existing build with production headers and WASM compression, without running asset generators again. */
export function previewConfig(): UserConfig {
  return { plugins: [pwaPlugin('preview'), rapierPreviewPlugin()] };
}
