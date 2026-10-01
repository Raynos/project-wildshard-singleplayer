/** Keep overlay gestures local even when their target resumes play during the same event. */
export function containMenuInput(root: EventTarget): void {
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click']) {
    root.addEventListener(type, (event) => { event.stopPropagation(); });
  }
}
