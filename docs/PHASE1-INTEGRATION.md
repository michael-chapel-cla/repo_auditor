# Phase 1 "Richer Findings" — Multi-Agent Integration Guide

This document outlines how Phase 1 enhancements are integrated across all audit agents (Claude, Codex, and GitHub Copilot).

## Overview

Phase 1 delivers **"Richer Findings"** by reducing false positives and making every finding immediately actionable through four key enhancements:

1. **Baseline Suppression** — Mark findings as `new` vs `existing`
2. **Auto-fix Suggestions** — Generate exact diff patches  
3. **Context-aware Severity** — Suppress known-safe patterns
4. **Cross-tool Deduplication** — Merge duplicate detections

## Universal Integration

All enhancements are **agent-agnostic** and work consistently across:

- ✅ **Claude Code** (`agents/claude/full-audit.md`)
- ✅ **OpenAI Codex** (`agents/codex/full-audit.md`)  
- ✅ **GitHub Copilot** (`agents/copilot/audit-instructions.md`)
- ✅ **GitHub Actions** (`.github/workflows/audit.yml`)

## Implementation

### Core Utilities

Located in `utils/`:

- `baseline-suppression.js` — Compares against previous audit runs
- `auto-fix-generator.js` — Creates diff patches for simple fixes
- `context-aware-severity.js` — Adjusts severity based on file context
- `cross-tool-deduplication.js` — Merges findings from multiple sources
- `apply-phase1-enhancements.js` — **Orchestrator script** (runs all four)

### Agent Integration Points

Each agent calls the orchestrator after generating `results.json`:

```bash
# Universal integration command for all agents
node utils/apply-phase1-enhancements.js "$OUT_DIR/results.json" "$REPORTS_DIR" "$WORKSPACE"
```

### Schema Updates

`scripts/report-schema.json` includes new fields:

**Summary level:**
- `baselineComparison` — new/existing counts
- `autoFixSuggestions` — fixable finding count  
- `contextAwareSeverity` — adjustment statistics
- `crossToolDeduplication` — deduplication metrics

**Finding level:**
- `status: "new" | "existing"` — baseline suppression result
- `autofix: { type, description, patch }` — auto-fix suggestion
- `severityAdjusted: { originalSeverity, rule, reason }` — context adjustment
- `sources: ["ai", "semgrep"]` — multiple detection sources
- `deduplicated: { mergedFrom }` — deduplication metadata

## GitHub Copilot Integration

### Agent Instructions

`agents/copilot/audit-instructions.md` includes Phase 1 step:

```markdown
6. **Apply Phase 1 "Richer Findings" Enhancements**:

   After generating the initial `results.json`, run the Phase 1 enhancement utilities:

   ```bash
   node utils/apply-phase1-enhancements.js "$OUT_DIR/results.json" "$REPORTS_DIR" "$WORKSPACE"
   ```

   This applies all four Phase 1 enhancements:
   - **Baseline Suppression (1.1)** — Marks findings as `new` or `existing` vs previous audit
   - **Auto-fix Suggestions (1.2)** — Generates exact diff patches for simple issues  
   - **Context-aware Severity (1.3)** — Adjusts severity based on file context
   - **Cross-tool Deduplication (1.4)** — Merges duplicate findings from different tools
```

### GitHub Actions Workflow

`.github/workflows/audit.yml` includes Phase 1 step:

```yaml
- name: Apply Phase 1 Enhancements
  if: always() && steps.static.outputs.out_dir
  env:
    OUT_DIR: ${{ steps.static.outputs.out_dir }}
    WORKSPACE: ${{ steps.static.outputs.workspace }}
  run: |
    # Apply Phase 1 "Richer Findings" enhancements if results.json exists
    if [ -f "$OUT_DIR/results.json" ]; then
      echo "Applying Phase 1 enhancements to $OUT_DIR/results.json"
      node utils/apply-phase1-enhancements.js "$OUT_DIR/results.json" "reports/" "$WORKSPACE" || {
        echo "Phase 1 enhancements failed, continuing with basic results"
      }
    else
      echo "No results.json found, skipping Phase 1 enhancements"
    fi
```

## Example Usage

### Claude Code

```bash
/full-audit owner/repo           # Phase 1 enhancements included by default
/phase1-audit owner/repo         # Explicit Phase 1 audit command
```

### GitHub Copilot

Via Copilot Workspace or chat:

```
Run a full audit on owner/repo
```

Copilot reads `agents/copilot/audit-instructions.md` and applies Phase 1 automatically.

### GitHub Actions

```bash
gh workflow run audit.yml -f target_repo=owner/repo
```

The workflow runs static checks, AI analysis, and Phase 1 enhancements automatically.

## Testing

Verify Phase 1 integration with the test utility:

```bash
node utils/test-phase1.js
```

This creates mock audit data and validates all four enhancements work correctly.

## Benefits

Phase 1 delivers immediate value to developers:

- **Reduced noise** — Focus on new findings, not existing ones
- **Actionable fixes** — Exact patches for simple issues
- **Smart filtering** — Context-aware severity reduces false positives  
- **Clean reports** — No duplicate findings from multiple tools

## Migration

Existing audits continue working unchanged. Phase 1 enhancements are **additive** — they extend the schema without breaking compatibility.

## Troubleshooting

If Phase 1 enhancements fail:

1. Check Node.js ES module support (`"type": "module"` in package.json)
2. Verify utilities are executable (`chmod +x utils/*.js`)
3. Ensure workspace directory exists when running auto-fix
4. Check that `results.json` exists before applying enhancements

Phase 1 failures are **non-fatal** — the audit continues with basic results.