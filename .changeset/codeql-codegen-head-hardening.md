---
"@avedon/compiler": patch
"@avedon/server": patch
---

Harden codegen and per-page head against CodeQL findings: component prop keys/values now use `\u003c`-safe literals (js/bad-code-sanitization), and the document `<title>` / `<meta name="description">` replacements use linear scanning instead of backtracking regexes (js/polynomial-redos).
