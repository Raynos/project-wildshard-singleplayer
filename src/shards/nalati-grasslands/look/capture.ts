import { staticCaptureUniforms } from '@wildshard/game/looks/staticCapture';
import rows from '../boot/staticCapture.generated.json' with { type: 'json' };

/** the static capture's shade, read by the painted ground and the grass (game/looks/painterlyLook PainterlyWorld captures it) */
export const bakeUniforms = staticCaptureUniforms(rows);
