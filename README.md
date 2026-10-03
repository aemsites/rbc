# RBC Royal Bank on EDS
Edge Delivery Services implementation for rbcroyalbank.com

## Environments
- Preview: https://main--rbc--aemsites.aem.page
- Live: https://main--rbc--aemsites.aem.live

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## DataLayer v2 (non-commerce)

`scripts/gtm.js` implements the non-commerce payloads from RBC's
"Standard DataLayer GTM Implementation Guide" v2:

- Initial metadata is nested under `page`: `lob`, `page_type`, `content_group`,
  `site_section: 'public'`, `cms_type: 'aem'`, `page_language`, `business_line`, and
  `environment`, plus `site_version` and an optional `error_code`.
  Empty authored values remain omitted; language, business-line,
  and environment detection retain their existing defaults.
- The additional push before `page_view` includes `user` with explicit null
  `user_id`, `user_id_primary`, and `user_type`, and `login_status: 'guest'`.
  `marketing` replaces `utm`, preserving UTM/campaign fields and click ID
  selection (GCLID before FBCLID), with uppercase `click_id_type`. Empty
  marketing data remains omitted.
- `element_click` uses `element_url`, `element_text`, `element_section`, and
  `outbound`. Section classification remains the authored block name or
  `default-content-N` (1-based main section), falling back to `default-content`.
  The conflicting semantic-region table/tag-name example is not adopted.
  Capture-phase and middle-click tracking remain unchanged.

Implementation choices for the guide's unspecified details:

- `page.site_version` uses the repository's declared package version plus the
  manually maintained `RELEASE_DATE`, formatted as `<version>-MMDDYY`.
  The current value is `1.3.0-100226`. Keep `SITE_VERSION_NUMBER` synchronized
  with `package.json`; regression checks enforce this. The legacy top-level
  `release_date` is no longer emitted.
- The guide lists `error_code` alongside page attributes but omits it from its
  sample push. It is emitted as `page.error_code` when `window.isErrorPage` is
  true and `window.errorCode` is present. `404.html` already supplies those
  signals. Normal pages and error pages without a known code omit the field.
- Click regions retain the existing semantic block/section labels rather than
  the sample's `a`/`button` values. Metadata values are passed through rather
  than translated or restricted to the guide's example lists.

Consent fields and lifecycle are unchanged. Conductrics experimentation data is
included when available at initialization, with the raw arm identifier as
`variant_id` (`A`, `B`, `0`, or `1`) instead of a composite arm/agent ID.
Later consent changes and late-arriving experimentation data are not pushed by
this migration. GTM remains deferred, honors `?martech=off`, and has no added
noscript iframe. No ecommerce events or integration are included.
Coordinate the renamed fields with GTM consumers before release. Content authors
still need to populate `lob`, `page-type`, `content-group`, and `business-line`
through page metadata or the bulk metadata sheet.

Run the dependency-free regression suite (Node.js with VM module support):

```sh
npm run test:gtm
```

## Local development

1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `rbc` directory in your favorite IDE and start coding
