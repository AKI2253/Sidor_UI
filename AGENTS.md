# Repository guidance

## Code Review Rules

### Skin lifecycle

- Treat every DOM or CSS mutation, observer, event listener, timer, animation frame, and injected node as skin-owned state. Flag any path where partial `apply()` failure, disposal, repeated activation, or hot switching can leave state behind or remove another activation's state. Safe path: register cleanup before fallible work, retain exact original values and owned handles, and restore only what the current activation changed.

### Product compatibility

- This repository ships presentation-only UI enhancement (skin). Flag changes that alter DSH services, events, or model requests; require remote runtime assets; block native controls or overlays; or rely on unstable DOM selectors without a safe fallback. Safe path: scope CSS and DOM decoration to the SIDOR overlay and preserve native behavior across light and dark themes, narrow and wide sidebars, conversation and workspace views, and browser and desktop layouts.

### Distribution and attribution

- `lib/client.js` is committed distribution output generated from `src/sidor-fx-client.js` via `scripts/build-client.ps1`. Flag source changes without matching built output, generated bundles containing absolute machine paths or remote asset dependencies, or asset/license changes that break the LICENSE/NOTICE terms. Safe path: regenerate bundles only from repository inputs and update `LICENSE` or `NOTICE` whenever provenance changes.
