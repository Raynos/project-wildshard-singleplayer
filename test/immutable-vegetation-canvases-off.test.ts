// @vitest-environment happy-dom
import { it } from 'vitest';
import { vegetationCanvasLifetime } from './fixtures/vegetationCanvases';

it('keeps real vegetation pixels after upload and rebuilds fresh on entry, Memory saver OFF', () => { vegetationCanvasLifetime(false); });
