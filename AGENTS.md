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
- Ask before modifying `README.md`, unless the user explicitly requests that change.
- `npx -y @adobe/aem-cli up`: local code, previewed content.
- Merging `main` ships code; content publishes separately.
- A PR without a `{branch}--{repo}--{owner}.aem.page/{path}` link is rejected.
- All committed files are served. Use `.hlxignore`.
- Skills: `/plugin marketplace add adobe/skills`, then `aem-edge-delivery-services` (24 skills, incl. `docs-search`).

## DataLayer (`scripts/gtm.js`, `scripts/consent-check.js`)
- Manage `SITE_VERSION_NUMBER` in `scripts/gtm.js` as the DataLayer's own SemVer
  (`MAJOR.MINOR.PATCH`), independent of `package.json`.
- Choose the bump from the actual DataLayer changes: MAJOR for incompatible payload
  or event changes, MINOR for backward-compatible additions, PATCH for fixes that
  preserve the existing contract.
- Documentation, tests, and refactors with no payload or behavior changes do not
  require a version bump.
- When bumping the DataLayer version, update `SITE_VERSION_DATE` to the current date
  (`YYYY-MM-DD`). The v2 payload emits `page.site_version` as `<semver>-<MMDDYY>`;
  do not emit the legacy `release_date` field.
