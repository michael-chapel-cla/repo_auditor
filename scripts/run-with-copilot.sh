#!/usr/bin/env bash
# Trigger a GitHub Actions audit workflow using the GitHub CLI + Copilot.
# Usage: ./scripts/run-with-copilot.sh [owner/repo] [target-repo-to-audit]
# Requires: gh CLI authenticated, GitHub Actions workflow exists
set -euo pipefail

THIS_REPO="${1:-}"  # The repo_auditor repo itself (where the workflow lives)
TARGET_REPO="${2:-}"  # The repo to audit

if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI not found. Install from https://cli.github.com/" >&2
  exit 1
fi

if [ -z "$THIS_REPO" ]; then
  THIS_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
fi

if [ -z "$TARGET_REPO" ]; then
  TARGET_REPO=$(grep "^GITHUB_REPOS" .env 2>/dev/null | cut -d= -f2 | awk -F',' '{print $1}' | tr -d ' "' | tr -d "'")
fi

if [ -z "$THIS_REPO" ] || [ -z "$TARGET_REPO" ]; then
  echo "Usage: $0 <auditor-repo> <target-repo>" >&2
  echo "Example: $0 myorg/repo-auditor myorg/my-app" >&2
  exit 1
fi

echo "==> Triggering audit workflow on $THIS_REPO for target $TARGET_REPO..."

gh workflow run audit.yml \
  --repo "$THIS_REPO" \
  --field target_repo="$TARGET_REPO"

echo "==> Workflow triggered. Check Actions tab on GitHub."
echo "==> Or watch with: gh run watch --repo $THIS_REPO"
