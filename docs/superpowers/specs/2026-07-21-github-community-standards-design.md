# GitHub Community Standards Design

**Date:** 2026-07-21  
**Status:** Approved (design sections confirmed)

## Summary

Bring the `hocestnonsatis/vexjs` repository to GitHub Community Standards checklist readiness with a standard open-source community package (not minimal-only, not heavy OSS automation).

Current health: ~28% (README only). Target: all checklist files present and linked from README.

## Decisions

| Topic | Choice |
|-------|--------|
| License | MIT, Copyright (c) 2026 Anıl ÖZ |
| Doc language | English |
| Security channel | GitHub private vulnerability reporting only |
| Scope | Standard package (approach 2) |

## Goals

- Satisfy GitHub Community Standards: README, License, Code of Conduct, Contributing, Security policy, Issue templates
- Add PR template and SUPPORT.md for a clear contributor path
- Keep docs short and actionable; match existing English README tone

## Non-goals

- CODEOWNERS, triage/release workflows, Discussion category bootstrap beyond SUPPORT mentions
- Translating community docs to Turkish
- Changing product code, package licenses beyond root MIT, or CI

## Files to add

```
LICENSE
CODE_OF_CONDUCT.md
CONTRIBUTING.md
SECURITY.md
SUPPORT.md
.github/PULL_REQUEST_TEMPLATE.md
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/feature_request.yml
.github/ISSUE_TEMPLATE/config.yml
```

## Content requirements

### LICENSE

Standard MIT text. Copyright holder: Anıl ÖZ. Year: 2026.

### CODE_OF_CONDUCT.md

Contributor Covenant 2.1. Enforcement contact: GitHub maintainers / `@hocestnonsatis` (no public email in this file).

### CONTRIBUTING.md

- Prerequisites: Node >= 20, pnpm >= 9
- Setup: `pnpm install && pnpm build`
- Verify: `pnpm test && pnpm test:smoke` (mention `pnpm test:e2e` when touching end-to-end paths)
- Dev: `pnpm -F example dev`
- PRs target `main`; describe intent; prefer tests for behavior changes
- Point to Code of Conduct and Security policy

### SECURITY.md

- Do not open public issues for vulnerabilities
- Report via GitHub Security Advisories / private vulnerability reporting on the repository
- Supported versions: current `main` (pre-1.0; no LTS matrix yet)

### SUPPORT.md

- Bugs and feature requests → GitHub Issues (use templates)
- Usage questions → Discussions if enabled, otherwise Issues
- Docs → `docs/` and README

### Issue templates

- `bug_report.yml`: description, reproduction steps, expected vs actual, environment (OS, Node, pnpm)
- `feature_request.yml`: problem, proposed solution, alternatives
- `config.yml`: blank issues enabled; contact links to SECURITY.md and SUPPORT.md / Discussions

### PULL_REQUEST_TEMPLATE.md

- Summary
- Test plan checklist (`pnpm build`, `pnpm test`, `pnpm test:smoke` as applicable)

### README.md (edit only)

Add a short bottom section with links: Contributing, Code of Conduct, Security, License, Support. Do not rewrite existing README body.

## Success criteria

- Files above exist at the listed paths
- Content matches Decisions and Content requirements
- README links to the community docs
- No product/package source changes beyond README link section

## Out of scope for this change

- Enabling GitHub Discussions or private vulnerability reporting in the GitHub UI (operator step; SECURITY.md documents the intended channel)
- Committing unless the maintainer asks
