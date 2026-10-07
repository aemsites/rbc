# RBC Products & Offers

DA library plugin for inserting structured product links and offer analytics
identities. Plain ES modules; no build step. DA configuration is managed manually.

## Registration

Add this entry to the DA site configuration's library sheet:

| title | path | experience |
| --- | --- | --- |
| RBC Products & Offers | `https://main--rbc--aemsites.aem.live/tools/product-picker/product-picker.html` | `fullsize-dialog` |

Opening that URL directly does not connect to the editor: launch through DA.

The plugin fetches same-origin `/products/query-index.json`, including all index
pages. Verify that endpoint is available before registering.
Product links always point to main, regardless of where the plugin is hosted.
Only the `aemsites/rbc` DA context is accepted.

## Products

Place the cursor in a product-reference cell, open the plugin, select a product,
review the exact output, and click **Insert Product**. The picker sends a link and
stays open for further selections and insertions:

```html
<a href="https://main--rbc--aemsites.aem.live/products/signature-no-limit">/products/signature-no-limit</a>
```

This references the structured record, not its public `productPage` or application
URL. The visible text is the indexed relative path; the destination is the full
EDS URL. Product variants remain separate records.

Product references are supported by `product-summary`, `cards (product)`,
`product-rail`, the visitor-facing `product-picker` block, `account-selector`,
and `account-comparison`. Insert into the intended product-reference cell:

| Block | Product-reference placement |
| --- | --- |
| `product-summary` | First row |
| `cards (product)` | First cell of each product row; one product per row |
| `product-rail` | A block containing only the product reference |
| `product-picker` | First cell of each product row; one product per row |
| `account-selector` | Explicit product-reference links in the block |
| `account-comparison` | One product per header cell after the first label cell |

The plugin inserts one reference at the cursor; it does not create surrounding
rows or columns. Create the required cells before inserting.

## Offers

Create a Section Metadata row named `promo` or `offer` and put the cursor in its
value cell. Choose **Offers**, select an association, and click **Insert Offer**.
Only plain text is sent, and the dialog stays open:

```text
Test offer name for signature no limit:test_offer_sig_no_limit
```

This indexed example is test data, not an approved business identity. Both name
and ID must be nonblank strings. Names can contain colons; IDs cannot. Neither can
contain line breaks. Incomplete offers remain inspectable but cannot be inserted.
No identity is inferred from headlines, badges, URLs, or product codes.

The plugin does not create metadata rows, hero copy, or CTAs. Metadata applies to
heroes in that section. Avoid configuring both aliases: if both are present, the
analytics implementation requires matching name/ID pairs; malformed or conflicting
values prevent hero promotion tracking. Cards and product rails read identity
from their product records instead.

Offer insertion is a snapshot. Updating the index does not update previously
inserted text. Start/end dates are displayed without enforcing eligibility.
The separate promotion-analytics implementation must be deployed for hero tracking.

## Finding records

Content language defaults to French for `/fr/` documents and English otherwise;
authors can switch explicitly. Mode-specific authoring instructions appear in a
collapsed-by-default **Usage instructions: supported blocks and where to insert**
accordion above the results. Expand it to read the guidance before selection.
No cross-language fallback is performed. Search
matches names, short names, paths, product codes, and offer identities. Category
and persona filters include variants. Selecting a product or offer reveals a
floating bottom action bar with the Insert button, alongside a ready-to-insert
status or the reason insertion is unavailable. The selected value uses a code
style to distinguish it from the status label: the relative product path or the
offer's `Name:ID`. The bar stays visible while
scrolling, and content space is reserved so it does not cover the list or details.
Use Arrow Up/Down to select visible results, then Tab to reach Insert for a valid
selection; Enter/Space activate native buttons.

**Clear filters** resets search, category, and persona without reloading the
catalog or changing the content language, Products/Offers mode, or selection.
Switching between Products and Offers also resets search, category, and persona,
and clears the selection; the content language is preserved in both directions.
Invalid product records are reported under **Skipped index records**. Loading
failures show **Retry loading**, not an empty catalog. Retrying reloads the index
and clears the selection. SDK insertion is a message to the editor, not an
acknowledged save; confirm the result in the document.

Insert is disabled while loading or sending an insertion, without a selection,
or when the selected offer identity is invalid. It is enabled again after the
insertion attempt if the selection is valid. Close the dialog manually when done.
The picker does not validate the cursor location or enforce offer dates.

## Development

The index currently uses flat `offer*` fields. The normalizer adapts these to zero
or one entries in `product.offers`; UI selection already handles multiple entries.
A future external multi-offer schema needs an agreed adapter change, not an
unannounced schema guess.
