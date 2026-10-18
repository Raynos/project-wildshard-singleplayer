/** A failed Game owns and loses its WebGL context on disposal. Retry needs a fresh canvas. */
export function replacePracticeCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const replacement = canvas.ownerDocument.createElement('canvas');
  for (const attribute of canvas.attributes) replacement.setAttribute(attribute.name, attribute.value);
  canvas.replaceWith(replacement);
  return replacement;
}
