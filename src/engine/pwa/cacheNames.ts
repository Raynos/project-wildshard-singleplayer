/**
 * The page's visited-product cache (src/game/shardfile/product.ts `browserProductCache`). It outlives every build:
 * scripts/app-build/serviceWorker.ts writes this name into src/engine/pwa/sw.js's KEEP list, so a deploy never wipes it.
 */
export const PRODUCT_CACHE_NAME = 'ws-shardfile-products-v2';
