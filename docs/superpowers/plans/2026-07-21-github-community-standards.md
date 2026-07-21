# GitHub Community Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MIT license and standard community docs so the repo meets GitHub Community Standards.

**Architecture:** Root policy files plus `.github` issue/PR templates; README gains link-only footer. No product code changes.

**Tech Stack:** Markdown, GitHub issue forms (YAML), MIT license text, Contributor Covenant 2.1.

## Global Constraints

- License: MIT, Copyright (c) 2026 Anıl ÖZ
- Language: English only
- Security: GitHub private vulnerability reporting only (no public email)
- Scope: standard package from `docs/superpowers/specs/2026-07-21-github-community-standards-design.md`
- Do not commit unless the maintainer asks

---

### Task 1: Root policy files

**Files:**
- Create: `LICENSE`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`
- Create: `SUPPORT.md`

- [ ] **Step 1: Write LICENSE (MIT)**
- [ ] **Step 2: Write CODE_OF_CONDUCT.md (Contributor Covenant 2.1; enforcement via @avedonjs)**
- [ ] **Step 3: Write SECURITY.md and SUPPORT.md per spec**
- [ ] **Step 4: Verify all four files exist at repo root**

### Task 2: Contributing + GitHub templates

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Write CONTRIBUTING.md with pnpm commands from README/memories**
- [ ] **Step 2: Write PR template and issue form YAMLs**
- [ ] **Step 3: Verify `.github` tree**

### Task 3: README links

**Files:**
- Modify: `README.md` (append Community section only)

- [ ] **Step 1: Append Contributing / Code of Conduct / Security / Support / License links**
- [ ] **Step 2: Confirm existing README body unchanged**

### Task 4: Verification

- [ ] **Step 1: List required paths; ensure no product packages changed**
- [ ] **Step 2: Update `memories.md` status for community standards**
