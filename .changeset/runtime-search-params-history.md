---
'@avedon/runtime': patch
---

Make `searchParamsSignal()` follow patched `history.pushState` / `replaceState` (same as `pathnameSignal`), not only `popstate`.
