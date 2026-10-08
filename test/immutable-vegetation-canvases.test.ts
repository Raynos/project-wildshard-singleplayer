// @vitest-environment happy-dom
import { it } from 'vitest';
import { vegetationCanvasLifetime } from './fixtures/vegetationCanvases';

it('retires real vegetation pixels after upload and rebuilds fresh on entry, Memory saver ON', () => { vegetationCanvasLifetime(true); });
