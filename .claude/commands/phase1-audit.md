# Phase 1 Enhanced Audit Command

Run a full audit with Phase 1 "Richer Findings" enhancements.

## Arguments

- `$1` — Repository to audit in `owner/repo` format

## What this does

This is identical to `/full-audit` but explicitly emphasizes the Phase 1 enhancements:

1. **Baseline Suppression** — Mark findings as new vs existing by comparing against previous audits
2. **Auto-fix Suggestions** — Generate exact diff patches for simple issues like console.log, unused deps, `: any` types
3. **Context-aware Severity** — Adjust severity based on file context to reduce false positives
4. **Cross-tool Deduplication** — Merge duplicate findings from different detection tools

## Usage

```bash
/phase1-audit owner/repo
```

## Implementation

Follow `agents/claude/full-audit.md` exactly — Phase 1 enhancements are already integrated into Step 6.