import { defineConfig } from 'vitest/config';
import { rapierAlias } from '../../../vite/rapier';
export default defineConfig({resolve:{alias:rapierAlias},assetsInclude:['**/*.bin','**/*.wasm'],test:{maxWorkers:1,testTimeout:30000,environment:'node',include:['art/driftwood-isle/approved-keelmaw/*.test.ts'],setupFiles:['test/setup.ts']}});
