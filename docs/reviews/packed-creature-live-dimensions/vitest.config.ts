import {defineConfig} from 'vitest/config';
import {rapierAlias} from '../../../vite/rapier';
export default defineConfig({resolve:{alias:rapierAlias},assetsInclude:['**/*.bin','**/*.wasm'],test:{include:['docs/reviews/packed-creature-live-dimensions/candidate.test.ts'],maxWorkers:1,environment:'node',setupFiles:['test/setup.ts'],restoreMocks:true}});
