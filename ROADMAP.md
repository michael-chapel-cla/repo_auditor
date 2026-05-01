# Repo Auditor — Roadmap

This document tracks planned enhancements by phase. Each phase builds on the previous; phases within the same tier can run in parallel.

---

## Phase 1 — Richer Findings

**Goal:** reduce false positives, make every finding immediately actionable

| # | Feature | Description |
|---|---------|-------------|
| 1.1 | Baseline suppression | Compare findings against the previous audit run. Mark each finding `new` or `existing`. Focus developer attention on regressions, not noise. |
| 1.2 | Auto-fix suggestions with diffs | For low-complexity findings (unused deps, `console.log`, `: any`), generate the exact patch to apply — not just prose. |
| 1.3 | Context-aware severity | Suppress known-safe patterns: `Math.random()` in a test file is not a security issue. Apply file-path rules before emitting findings. |
| 1.4 | Cross-tool deduplication | If Claude and Semgrep both flag the same line, merge into one finding with `sources: ["ai", "semgrep"]` rather than two separate entries. |

---

## Phase 2 — Trend Tracking

**Goal:** turn point-in-time snapshots into a continuous health timeline

| # | Feature | Description |
|---|---------|-------------|
| 2.1 | Score history chart | Plot overall score and per-category scores across audit runs over time (Recharts line chart; data already exists in `reports/`). |
| 2.2 | Finding lifecycle | Mark findings `open \| acknowledged \| resolved` with timestamps. Surface mean time to resolve (MTTR) per severity on the dashboard. |
| 2.3 | Regression alerts | When a new audit score drops > 10 points vs. the previous run, emit a GitHub issue or Slack/Teams webhook notification automatically. |
| 2.4 | Per-contributor risk attribution | Cross-reference findings with `git blame` to show which contributor introduced each flagged line — informational, not punitive. Shown as a chart on the Contributors page. |

---

## Phase 3 — Extended CWE Coverage ✅ **COMPLETED**

**Goal:** expand security detection beyond the current 31 CWEs to cover 12 additional high-impact vulnerabilities

**🎉 STATUS: All 12 priority CWEs successfully implemented (January 2025)**

| # | CWE | Feature | Severity | Status |
|---|-----|---------|----------|--------|
| 3.1 | CWE-918 | SSRF Detection | CRITICAL | ✅ **DONE** — S32 rule added |
| 3.2 | CWE-1336 | SSTI Detection | HIGH | ✅ **DONE** — S33 rule added |
| 3.3 | CWE-601 | Open Redirect | HIGH | ✅ **DONE** — S34 rule added |
| 3.4 | CWE-611 | XXE Detection | HIGH | ✅ **DONE** — S35 rule added |
| 3.5 | CWE-502 | Unsafe Deserialization | HIGH | ✅ **DONE** — S36 rule added |
| 3.6 | CWE-434 | File Upload Validation | HIGH | ✅ **DONE** — S37 rule added |
| 3.7 | CWE-400 | DoS Patterns | HIGH | ✅ **DONE** — S38 rule added |
| 3.8 | CWE-915 | Mass Assignment | HIGH | ✅ **DONE** — S39 rule added |
| 3.9 | CWE-312 | Cleartext Storage | HIGH | ✅ **DONE** — S40 rule added |
| 3.10 | CWE-319 | HTTP Transmission | HIGH | ✅ **DONE** — S41 rule added |
| 3.11 | CWE-20 | Input Validation | HIGH | ✅ **DONE** — S42 rule added |
| 3.12 | CWE-285 | Authorization RBAC | HIGH | ✅ **DONE** — S43 rule added |

**Impact:** Security coverage expanded from **31 to 43 unique CWEs** (+38% increase)

---

## Phase 4 — Broader Language Support

**Goal:** audit non-JS/TS repos without changing the core agent architecture

| # | Feature | Description |
|---|---------|-------------|
| 4.1 | Python | `bandit` for security, `ruff`/`pylint` for quality, `pip-audit` for dep vulnerabilities, `safety` for supply chain. |
| 4.2 | Go | `gosec` for security, `staticcheck` for quality, `govulncheck` for vulnerabilities. |
| 4.3 | Language auto-detection | Inspect the cloned repo's primary language(s) and route to the appropriate tool set automatically. |
| 4.4 | Docker / Terraform / IaC | `trivy` for container image vulnerabilities, `tfsec` / `checkov` for Terraform and Kubernetes manifests. |

---

## Phase 5 — Developer Workflow Integration

**Goal:** shift auditing left — surface findings before code reaches main

| # | Feature | Description |
|---|---------|-------------|
| 5.1 | PR-diff audit mode | Audit only the files changed in a PR instead of the full repo. Much faster; catches regressions at review time. |
| 5.2 | GitHub PR comment bot | Post findings as inline PR review comments on the exact line, with severity badge and fix suggestion. |
| 5.3 | Pre-commit hook generator | After an audit, generate a `.pre-commit-config.yaml` or `husky` hook config tailored to the finding types found. |
| 5.4 | VS Code extension | Surface active audit findings as editor diagnostics, linked to the most recent report for the open repo. |

---

## Phase 6 — Deeper AI Capabilities

**Goal:** make the AI analysis smarter and more autonomous

| # | Feature | Description |
|---|---------|-------------|
| 6.1 | Cross-file dataflow analysis | Trace user input from route handler → service → DB call across multiple files. Flag injection risks that span file boundaries — something grep cannot do. |
| 6.2 | Architecture diagram generation | Produce a Mermaid dependency graph from import analysis. Highlight circular dependencies and layer violations. |
| 6.3 | Auto-remediation PRs | For well-understood finding types (outdated npm deps, missing `helmet`, stray `console.log`), open a GitHub PR with the fix already applied. |
| 6.4 | Natural language Q&A | Ask questions like "Why did the security score drop this week?" and get an answer derived from the diff between two audit runs. |
| 6.5 | Custom rule authoring | Let users describe a rule in plain English ("flag any function that calls the payment API without logging the result") and have Claude generate the detection pattern automatically. |

---

## Phase 7 — Enterprise & Org Scale

**Goal:** audit at organisation level, enforce policy, satisfy compliance requirements

| # | Feature | Description |
|---|---------|-------------|
| 7.1 | Multi-repo org dashboard | Aggregate scores across all repos in a GitHub org. Rank by risk level. Drill down to individual repo findings. |
| 7.2 | Policy enforcement | Define org-wide gates (`no critical findings before merge`, `coverage ≥ 85%`) and fail CI automatically if violated. |
| 7.3 | SBOM generation | Produce a Software Bill of Materials (CycloneDX or SPDX format) as a standard audit artifact alongside `results.json`. |
| 7.4 | Compliance mapping | Tag findings against OWASP Top 10, SOC 2, PCI-DSS, and NIST controls. Generate a compliance gap report exportable as PDF. |
| 7.5 | Audit trail integrity | Sign `results.json` with a SHA-256 hash on write. Verify on read. Detect any tampering with historical audit results. |

---

## Suggested sequence

```
Phase 1 ──► Phase 2 ──► Phase 5     ← highest immediate developer value
                │
                └──► Phase 6        ← requires stable Phase 1/2 data first

Phase 3 ────────────────────────── ← critical security gaps; AI-focused CWEs

Phase 4 ────────────────────────── ← independent; start when JS/TS coverage is solid

Phase 7 ────────────────────────── ← when the tool is used across multiple teams
```

Phases 1, 2, and 5 together deliver the most visible improvement to the daily developer experience. **Phase 3 is critical** — the 10 new CWEs include AI-specific threats (SSRF, SSTI) that are first-class risks for agentic systems. Phase 4 and 6 are higher investment but unlock new audiences. Phase 7 is the enterprise tier.

---

## Contributing a roadmap item

1. Pick an item from the table above
2. Open an issue referencing the phase and feature number (e.g. `[4.1] PR-diff audit mode`)
3. Implement in a branch, add or update the relevant agent instruction file and/or frontend page
4. Run a self-audit: `./scripts/run-with-claude.sh <owner>/repo-auditor` — the platform should find no new critical/high findings in its own code
