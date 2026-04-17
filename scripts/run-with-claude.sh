#!/usr/bin/env bash
# Run a full audit using Claude Code CLI (claude).
# Usage: ./scripts/run-with-claude.sh [owner/repo]
# Requires: claude CLI installed and authenticated
set -euo pipefail

REPO="${1:-}"
INSTRUCTIONS="agents/claude/full-audit.md"

if ! command -v claude &>/dev/null; then
  echo "Error: claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code" >&2
  exit 1
fi

if [ -z "$REPO" ]; then
  # Read first repo from .env
  REPO=$(grep "^GITHUB_REPOS" .env 2>/dev/null | cut -d= -f2 | awk -F',' '{print $1}' | tr -d ' "' | tr -d "'")
fi

if [ -z "$REPO" ]; then
  echo "Usage: $0 owner/repo" >&2
  echo "Or set GITHUB_REPOS in .env" >&2
  exit 1
fi

echo "==> Running full audit on $REPO using Claude Code..."
echo "==> Instructions: $INSTRUCTIONS"
echo ""

# Run Claude as a non-interactive agent with the full audit instructions
claude --print \
  "Read the full audit agent instructions from $INSTRUCTIONS and execute every step for the repository: $REPO. Read all reference docs in docs/ before beginning each audit category." \
  2>&1

echo ""
echo "==> Audit complete. Check reports/ for output."

# Clean up the cloned repo — audit data stays in reports/, source code does not
REPO_SLUG=$(echo "$REPO" | tr '/' '_')
WORKSPACE="${WORKSPACE_DIR:-./workspace}/$REPO_SLUG"
if [ -d "$WORKSPACE" ]; then
  echo "==> Removing workspace: $WORKSPACE"
  rm -rf "$WORKSPACE"
fi
