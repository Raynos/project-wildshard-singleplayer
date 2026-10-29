/**
 * The page's visited-product cache (src/game/shardfile/product.ts `browserProductCache`). It outlives every build:
 * scripts/app-build/serviceWorker.ts writes this name into src/engine/pwa/sw.js's KEEP list, so a deploy never wipes it.
 */
export const PRODUCT_CACHE_NAME = 'ws-shardfile-products-v2';

/** MF1/MF4: immutable code, content and versioned metadata, keyed by exact absolute URL. */
export const ASSET_CACHE_NAME = 'ws-assets-v1';
