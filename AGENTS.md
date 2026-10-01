# AGENTS.md

Edge Delivery Services. Read a block first. Omissions are in the repo or known.

## Avoid
- `scripts/aem.js` is vendored. Never edit.
- Markup comes from the backend. `curl localhost:3000/x.plain.html` first.
- `buildAutoBlocks` rewrites content before your block runs.
- Authors omit and add cells. Decorate defensively.
- No build step; devDependencies only.
- Scope CSS to `.blockname`; `-wrapper`/`-container` are section classes.
- `fragment/fragment.js` is the only cross-block import. Otherwise use `/scripts/`.
- `document.createElement` in block JS. Use `createElement` from `utils/dom.js`; existing blocks are pending refactor.
- Hand-built `<picture>`/`<source>`. Use `createOptimizedPicture` from `scripts/aem.js`.

## Outdated
- `fstab.yaml`, `helix-query.yaml`, `paths.json` are retired. Config lives at tools.aem.live.

## Remember
- `npx -y @adobe/aem-cli up`: local code, previewed content.
- Merging `main` ships code; content publishes separately.
- A PR without a `{branch}--{repo}--{owner}.aem.page/{path}` link is rejected.
- All committed files are served. Use `.hlxignore`.
- Skills: `/plugin marketplace add adobe/skills`, then `aem-edge-delivery-services` (24 skills, incl. `docs-search`).

## DataLayer (`scripts/gtm.js`, `scripts/consent-check.js`)
- Any edit to dataLayer-related code (`gtm.js`, `consent-check.js`, or anything feeding
  `window.dataLayer`) must bump `RELEASE_DATE` in `scripts/gtm.js` to the current date
  (`YYYY-MM-DD`). This is a manually-maintained field, not derived — update it yourself,
  don't skip it.
