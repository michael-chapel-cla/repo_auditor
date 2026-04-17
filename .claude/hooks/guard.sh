#!/usr/bin/env bash
# Pre-tool guard: block dangerous patterns before Bash tool executes.
# Reads the proposed command from CLAUDE_TOOL_INPUT env var (JSON).

set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-}"
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "")

# Block force pushes to main/master
if echo "$COMMAND" | grep -qE "git push.*(--force|-f).*(main|master)"; then
  echo "BLOCKED: Force push to main/master is not allowed." >&2
  exit 1
fi

# Block rm -rf on paths outside the project
if echo "$COMMAND" | grep -qE "rm -rf /(?!Users/mwchapel/repo_auditor)"; then
  echo "BLOCKED: rm -rf outside project directory." >&2
  exit 1
fi

# Block commits with --no-verify
if echo "$COMMAND" | grep -qE "git commit.*--no-verify"; then
  echo "BLOCKED: Skipping git hooks is not allowed." >&2
  exit 1
fi

exit 0
