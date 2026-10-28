import { build } from 'vite';
import { devices, webkit, type BrowserContextOptions, type Page } from 'playwright';

/** Setup operations required from a native reference page. */
export interface NativeRasterPage {
  readonly setContent: (html: string) => Promise<unknown>;
  readonly addScriptTag: (input: { content: string; type?: string }) => Promise<unknown>;
}
/** Explicit author browser factory; alternate hosts preserve the same setup and cleanup contract. */
export interface NativeRasterHost<P extends NativeRasterPage> {
  readonly launch: (options: { headless: true }) => Promise<{
    readonly newContext: (options: BrowserContextOptions | undefined) => Promise<{ readonly newPage: () => Promise<P> }>;
    readonly close: () => Promise<void>;
  }>;
}
/** A native author reference page; the caller holds browser-lane and owns its finite lifetime. */
export interface NativeRasterSession<P extends NativeRasterPage = Page> {
  readonly page: P;
  readonly dispose: () => Promise<void>;
}
/** A bundled painter and its original document. Module tags are opt-in, as for native addScriptTag. */
export interface NativeRasterInput {
  readonly html: string;
  readonly source: string;
  readonly module?: boolean;
}

const nativeHost: NativeRasterHost<Page> = { launch: options => webkit.launch(options) };

/** Open the existing phone WebKit reference raster without installing a page/game service.
 * Snapshot input before yielding; release the browser if any preparation step refuses. */
export function openNativeRaster(input: NativeRasterInput): Promise<NativeRasterSession>;
/** Open an explicitly supplied author host with the same page lifetime. */
export function openNativeRaster<P extends NativeRasterPage>(input: NativeRasterInput, host: NativeRasterHost<P>): Promise<NativeRasterSession<P>>;
export function openNativeRaster<P extends NativeRasterPage>(input: NativeRasterInput, host?: NativeRasterHost<P>): Promise<NativeRasterSession<P> | NativeRasterSession> {
  return host === undefined ? prepareNativeRaster(input, nativeHost) : prepareNativeRaster(input, host);
}

async function prepareNativeRaster<P extends NativeRasterPage>(input: NativeRasterInput, host: NativeRasterHost<P>): Promise<NativeRasterSession<P>> {
  const { html, source, module } = input;
  const browser = await host.launch({ headless: true });
  try {
    const context = await browser.newContext(devices['iPhone 16 Pro']);
    const page = await context.newPage();
    await page.setContent(html);
    await page.addScriptTag(module === true ? { type: 'module', content: source } : { content: source });
    return { page, dispose: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/** Explicit native-reference bundle settings; painters and publication remain caller-owned. */
export interface NativeRasterBundle {
  readonly root: string;
  readonly entry: string;
  readonly format: 'es' | 'iife';
  readonly name?: string;
  readonly fileName?: string;
  readonly discardModuleSideEffects?: boolean;
}

/** Bundle one native reference page with the original offline target and split policy.
 * Missing code stays undefined so the author retains its defining refusal. No Vite plugin is installed. */
export async function bundleNativeRaster(input: NativeRasterBundle): Promise<string | undefined> {
  const { root, entry, format, name, fileName, discardModuleSideEffects } = input;
  const result = await build({ configFile: false, logLevel: 'silent', publicDir: false, root,
    build: { write: false, target: 'esnext', minify: false,
      lib: { entry, formats: [format], ...(name === undefined ? {} : { name }), ...(fileName === undefined ? {} : { fileName }) },
      rolldownOptions: { ...(discardModuleSideEffects === true ? { treeshake: { moduleSideEffects: false } } : {}), output: { codeSplitting: false } } } });
  return (Array.isArray(result) ? result : [result]).flatMap(bundle => 'output' in bundle ? bundle.output : []).find(chunk => chunk.type === 'chunk')?.code;
}
