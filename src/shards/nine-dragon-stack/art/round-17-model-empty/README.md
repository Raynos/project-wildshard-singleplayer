# E201: portrait Model Explorer empty state

`live-empty.jpg` is a 390×844 capture of Nine Dragon Stack's previously blank Model Explorer. Both concepts are code-native overlays on that capture, so text and spacing are exact and editable:

- `a-catalog-state.jpg` / `.html`: full catalog panel, honest zero count, and an Explore the World action. **Implemented** as the default empty state in `src/explore/Explore.ts` and `src/ui/styles/explore.css`.
- `b-world-first.jpg` / `.html`: smaller centered panel that leaves more of the city visible and offers World Explorer and Explore Hub actions. This is a visual alternative only.

`mockup.css` styles the two HTML sources. The mockups are portrait iOS PWA layouts, with no browser chrome or landscape version.
