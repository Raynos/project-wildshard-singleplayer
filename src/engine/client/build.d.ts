/** Vite's compiled author-dev mode. Production/native builds always substitute false. */
declare const __DEVSERVER__: boolean;
/** A proof build runs the page on the worker client (P1-E5.3 I6, J126); no shipped build sets it. */
interface ImportMetaEnv { readonly VITE_WORKER_CLIENT?: string }
