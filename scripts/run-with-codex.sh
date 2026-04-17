#!/usr/bin/env bash
# Run a full audit using OpenAI Codex CLI.
# Usage: ./scripts/run-with-codex.sh [owner/repo]
# Requires: codex CLI installed and OPENAI_API_KEY set
set -euo pipefail

REPO="${1:-}"

if ! command -v codex &>/dev/null; then
  echo "Error: codex CLI not found. Install with: npm install -g @openai/codex" >&2
  exit 1
fi

if [ -z "$REPO" ]; then
  REPO=$(grep "^GITHUB_REPOS" .env 2>/dev/null | cut -d= -f2 | awk -F',' '{print $1}' | tr -d ' "' | tr -d "'")
fi

if [ -z "$REPO" ]; then
  echo "Usage: $0 owner/repo" >&2
  exit 1
fi

echo "==> Running full audit on $REPO using Codex CLI..."

codex "$(cat agents/codex/full-audit.md)

The target repository is: $REPO"

# Clean up the cloned repo after the audit completes
REPO_SLUG=$(echo "$REPO" | tr '/' '_')
WORKSPACE="${WORKSPACE_DIR:-./workspace}/$REPO_SLUG"
if [ -d "$WORKSPACE" ]; then
  echo "==> Removing workspace: $WORKSPACE"
  rm -rf "$WORKSPACE"
fi
