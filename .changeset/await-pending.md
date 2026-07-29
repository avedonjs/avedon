---
'@avedon/runtime': patch
'@avedon/compiler': patch
---

`{#await}` pending UI: keep the first block until `{:then}` / `{:catch}`; streaming SSR can show pending HTML inside the OOO placeholder.
