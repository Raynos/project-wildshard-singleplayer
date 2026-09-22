import type { CapacitorConfig } from '@capacitor/cli';

// The native shells (docs/plans/NATIVE-APPS.md). appId is the ANDROID application id — Android ids cannot contain
// '-' — and iOS carries its own bundle id, com.jakeverbaten.wildshard-singleplayer, in ios/App/App.xcodeproj
// (PRODUCT_BUNDLE_IDENTIFIER; `cap sync` never rewrites it). Both are permanent once a store has seen them.
const config: CapacitorConfig = {
  appId: 'com.jakeverbaten.wildshard_singleplayer',
  appName: 'Wildshard',
  webDir: 'dist-native',
  backgroundColor: '#11161b',
  ios: { contentInset: 'never', scrollEnabled: false },
  android: { allowMixedContent: false },
  server: {
    // stable local origins: saves (localStorage + the Preferences mirror) belong to this origin
    hostname: 'localhost', iosScheme: 'capacitor', androidScheme: 'https',
    errorPath: 'native-unavailable.html', // an outdated Android WebView gets an explanation, not a black screen
  },
  plugins: {
    SystemBars: { style: 'DARK', hidden: true, initialViewportFitValueHint: 'cover' }, // full-screen game; the HUD pads itself with env(safe-area-inset-*)
    // Signed self-hosted updates (src/native/ota.ts): the app drives the plugin by hand; Capgo's cloud is off.
    CapacitorUpdater: {
      autoUpdate: 'off', updateUrl: '', statsUrl: '', channelUrl: '', periodCheckDelay: 0,
      resetWhenUpdate: true, // a new store binary starts from its own bundle, never a stale OTA one
      appReadyTimeout: 120_000, // a bundle that doesn't reach the title (ws:ready → notifyAppReady) in 2 min is rolled back
      responseTimeout: 120, // seconds; on iOS it caps each whole per-file download (default 20 s is short for a 6 MB texture)
      autoDeletePrevious: true, autoDeleteFailed: true, autoSplashscreen: false,
      // no runtime knobs, preview channels or shake menus in a shipped game
      allowModifyUrl: false, allowModifyAppId: false, allowManualBundleError: false, allowPreview: false,
      shakeMenu: false, allowShakeChannelSelector: false, keepUrlPathAfterReload: false,
    },
  },
};

export default config;
