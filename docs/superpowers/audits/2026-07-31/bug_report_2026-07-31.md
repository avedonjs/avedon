# Bug Fix Report - avedon

**Date:** 2026-07-31  
**Analyzer:** Cursor agent (comprehensive repository analysis)  
**Repository:** `/home/anilo/Projeler/avedon`  
**Commit (baseline):** `64c09e6a75dde144eb5fd329214f419e151da581`  
**Branch:** `main`

## Overview

| Metric | Value |
|--------|------:|
| Total bugs fixed (this pass) | 8 |
| Dependency vulnerabilities (`pnpm audit`) | 0 |
| Unit tests after fixes | 778+ passed |
| Focus | Claim-hydrate WIP + security follow-up from explorers |

## Fixed

| ID | Severity | Summary |
|----|----------|---------|
| BUG-301 | HIGH | Adjacent text/`{expr}` HTML coalescing → empty `<!---->` separators |
| BUG-302 | HIGH | Claim mismatch leaked effects/lifecycle; destroy before soft-remount |
| BUG-303 | HIGH | Set-Cookie CRLF via name/path/domain → reject control chars |
| BUG-304 | HIGH | Streaming redirect XSS (`</script>` in Location) → `\u003c` escape |
| BUG-305 | HIGH | Static SSR text not HTML-escaped → claim entity mismatch |
| BUG-306 | HIGH | `Child.destroy()` wiped shared parent → remove `__owned` nodes only |
| BUG-307 | MEDIUM | Attr names with `"` allowed in SSR → reject invalid names |
| BUG-308 | MEDIUM | Nested hydrate cleared entire claim stack → pop to `__claimBase` depth |

## Deferred → Closed (2026-08-07)

| ID | Notes |
|----|-------|
| DEF-001 | Closed by claim hydrate v1.1 (slotted / `{@html}` claim) |
| DEF-002 | Closed by streaming `{#await}` claim + identity labs |
| DEF-003 | Closed: playground `evalMockServer` moved to worker |
| DEF-004 | Closed: scaffold CORS guidance; rate-limit `trustForwarded` docs |
| DEF-005 | Closed: Node static `Content-Type` + `nosniff` |

## Testing

```bash
pnpm test   # 196 files, 778+ tests passed
```

Follow-up from explorers [Explore critical packages](cd8af0ae-7a1b-4d26-93a2-cfb237ced62b) and [Continue bug hunt](e49415d0-50a6-4b74-9b56-b3cdf9a1aa20).
