import { imagesFirstPlayingBytes } from '../grid/runtimeCost';
import { consumeTravelHandoff } from '../travel/travel';
import { type StepRunner, createBootPlan } from '@wildshard/engine/boot/plan';
import { prepareShardAssets } from '../shard/load';
import type { SessionContext } from './context';
import { currentOwner } from '@wildshard/engine/app/ownership';
import { app } from '@wildshard/engine/app/runtime';
import { declareTotals, installByteCounter } from '@wildshard/engine/boot/bytes';
import { bootFiles, extraFetches, startAudioPreload, startDeferredAudioPreload, startMenuPreload } from '@wildshard/engine/boot/extras';
import { registerGpuFiles, setTexturePolicy } from '@wildshard/engine/boot/gpuFiles';
import { packFor, streamPack } from '@wildshard/engine/boot/pack';
import { bootFetches, prefetch, prefetchAfter, whenPrefetched } from '@wildshard/engine/boot/prefetch';
import { useShardSteps } from '@wildshard/engine/boot/steps';
import { startViewmodelTextures } from '@wildshard/engine/combat/view/ranged';
import { TIER } from '@wildshard/engine/core/tier';
import { Loading } from '@wildshard/engine/ui/Loading';
import { resumeProgress, resumeScreen } from '@wildshard/engine/ui/Resume';

async function buildData(ctx: SessionContext) {
  const { manifest, stage, boot, session } = ctx;

  // level.data consumes the per-tab intent before any expensive build can fail.
  boot.handoff = consumeTravelHandoff(manifest.slug);
  if (boot.handoff !== null) session.arrival = { slug: boot.handoff.to, mode: boot.handoff.mode };
  setTexturePolicy(manifest.tiers?.[TIER]?.textures, manifest.slug, imagesFirstPlayingBytes(manifest.runtimeCost));
  const loading = new Loading({ id: manifest.slug, name: manifest.name, trace: manifest.boot?.phone?.trace === true });
  app.setState('loading');
  // The boot plan: DOWNLOAD = bytes read / bytes declared, SETUP = weighted steps (src/engine/boot/plan.ts).
  // Declared bytes come from the chunk's file list; every /assets fetch is counted on its way in.
  // the RESUMING screen's brand (E99): the shard's name + title art, while its URL is still the served file (the menu
  // preload swaps it for an in-memory blob: that one would not survive a recovery reload)
  const brand = (): void => { resumeScreen().brand(manifest.name, manifest.card.portrait); };
  brand();
  await stage('ktx2', () => prepareShardAssets(manifest, registerGpuFiles));
  const audioProfile = await stage('audio.preload', () => manifest.audio?.preload?.());
  const files = bootFiles(manifest, undefined, audioProfile); // + the title / explore art and every audio file (project/archive/2026-09-23-preload-offline.md)
  useShardSteps(manifest.slug, manifest.boot?.steps, manifest.boot?.bytes); // the shard's own loading nouns + weights (src/engine/boot/steps.ts)
  const bootSteps: Record<string, number> = {}; // each step's wall ms (the host's timings: what a build / rebuild spends where)
  const plan = createBootPlan((view) => { loading.paint(view); resumeProgress(view.setup); for (const r of view.rows) if (r.state === 'ok') bootSteps[r.key] = Math.round(r.ms); }, { totals: declareTotals(files) });
  installByteCounter(plan, files);
  // a boot that throws shows WHY: the loading panel's foot line + the uncaught-exception modal (src/engine/ui/ErrorModal.ts)
  (currentOwner() ?? app.engineScope).listen(window, 'unhandledrejection', (e) => plan.fail(`BOOT FAILED · ${String((e.reason as { message?: string } | null | undefined)?.message ?? e.reason)}`.slice(0, 300)));
  (currentOwner() ?? app.engineScope).listen(window, 'error', (e) => plan.fail(`BOOT FAILED · ${e.message} @ ${e.filename.split('/').pop()}:${e.lineno}`.slice(0, 300)));
  const step: StepRunner = (key, work) => stage(key, () => plan.step(key, work).then((p) => p.value));
  boot.worldHook = manifest.boot?.stagedWorld === true ? (work) => work() : (work) => step('props', (p) => { boot.progress = p; return work(); });
  // let the service worker take control first (≤ 2.5 s, never fatal) so the first visit's bytes are cached (a shard built
  // later in the page finds it long settled)
  await window.__ws_sw?.ready;
  // this shard's files in flight now, in step order; each step builds as its files land — as one pack when the build has
  // one (src/engine/boot/pack.ts), else file by file (src/engine/boot/prefetch.ts); anything the pack lacks still goes file by file
  const pack = packFor(manifest);
  const packed = new Set(pack ? pack.files.map(([p]) => p) : []);
  const packStreamed = pack ? streamPack(pack, plan, files) : Promise.resolve();
  const worldFetches = bootFetches(manifest, files).filter((p) => !packed.has(p));
  prefetch(worldFetches);
  // then the title art and ALL audio (project/archive/2026-09-23-preload-offline.md), after the pack so they do not split the pipe with the
  // world's files; the selected style + set are decoded as their bytes land — nothing is fetched after the bar.
  // A level may hold extras behind its complete world file queue.
  const extrasBarrier = manifest.boot?.barrier === true
    ? Promise.all([packStreamed, ...worldFetches.map(whenPrefetched)]) : packStreamed;
  prefetchAfter(extraFetches(files), extrasBarrier);
  // High-peak builds may defer extras decoding until their later loading steps.
  const deferExtras = manifest.boot?.phone?.deferExtras === true && TIER === 'phone';
  const menuLoad = deferExtras ? null : startMenuPreload(files, manifest);
  const audioLoad = deferExtras ? null : startAudioPreload(files, manifest, audioProfile);
  const deferredAudio = deferExtras ? startDeferredAudioPreload(files, manifest, audioProfile) : null;
  startViewmodelTextures(manifest.boot?.viewmodelSets ?? false); // the crossbow's + rifle's textures, drawn in a worker while the world builds
  const fieldModels = manifest.fieldModels?.() ?? null;
  return { ...ctx, loading, audioProfile, files, bootSteps, plan, step, menuLoad, audioLoad, deferredAudio, fieldModels };
}

export const dataStage: typeof buildData = buildData;
